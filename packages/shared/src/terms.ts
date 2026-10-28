// Academic terms derived from Northwestern Registrar dates. The single source
// for which quarters a listing covers, used by searchSublets (as SQL
// parameters), the mock /browse filter, card badges and the listing form.
//
// User assumption (Z, 10/27/26): the current user assumption is that quarter filtering is a user looking for listings with availability in the selected quarters.
// Every rule below serves that intent; revisit them together if it changes.
//
// Rules v2 (decided by Z, 10/27/26):
// - Fall Y = [Sep 1 Y, day after Fall exams end). Winter and Spring start the
//   day after the previous quarter's exams end; Summer runs from the day after
//   Spring exams end to Aug 31. Terms tile the calendar with no gaps.
// - A listing's end date is the move-out day and is not counted.
// - A listing covers a term if they overlap by at least MIN_TERM_OVERLAP_DAYS.
// - Year-long leases (move-out from 14 days before to 7 days after the 1-year
//   anniversary): when the same quarter is covered at both ends, only the end
//   with more days counts; a tie keeps the earlier one.
// - A selection (one contiguous run) matches a listing that counts every
//   selected term.
// - A missing calendar date falls back to the previous year's date + 1 year.
//
// Dates are ISO 'YYYY-MM-DD' strings throughout; ranges are [start, end).

import type { Quarter } from './index';

export const MIN_TERM_OVERLAP_DAYS = 14;

/** Move-out window around the 1-year anniversary that makes a lease "year-long". Mirrored in SQL by searchSublets and the sublets_availability_year_long statistics. */
export const YEAR_LONG_WINDOW_DAYS = { before: 14, after: 7 } as const;

/** Fall starts on this month-day every year; Summer ends the day before. */
export const FALL_STARTS = '09-01';

const DAY_MS = 86_400_000;

/** One academic year's Registrar anchors. 2026 = the 2026–27 academic year. */
export interface AcademicCalendarYear {
  academicYear: number;
  fallExamsEnd: string | null;
  winterExamsEnd: string | null;
  springExamsEnd: string | null;
}

export interface Term {
  /** e.g. 'fall-2026', 'winter-2027'. */
  id: string;
  quarter: Quarter;
  academicYear: number;
  /** Year in the label: Fall Y, then Winter/Spring/Summer Y+1. */
  labelYear: number;
  /** e.g. 'Winter 2027'. */
  label: string;
  start: string;
  /** Exclusive. */
  end: string;
}

/** What a card or form shows for a covered term. */
export type TermBadge = Pick<Term, 'id' | 'quarter' | 'label'>;

export type TermSelectionResult =
  | { ok: true; terms: Term[] }
  | { ok: false; reason: 'not-a-list' | 'empty' | 'too-many' | 'unknown' | 'duplicate' | 'gap' };

type Anchor = Exclude<keyof AcademicCalendarYear, 'academicYear'>;

/** Shifts an ISO date by whole days (UTC, so no DST drift). */
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Shifts an ISO date by whole years, clamping Feb 29 to Feb 28 the way
 * Postgres `date + interval '1 year'` does (JS Date would roll to Mar 1), so
 * year-long checks agree between TypeScript and SQL.
 */
function addYears(iso: string, years: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year + years}-${pad(month)}-${pad(Math.min(day, lastDayOfMonth))}`;
}

/** Days in the overlap of two [start, end) ranges; 0 when they don't overlap. */
function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return end > start ? (Date.parse(end) - Date.parse(start)) / DAY_MS : 0;
}

/**
 * Builds the ordered, contiguous term list from calendar rows, projecting any
 * missing anchor — or whole missing year, up to `throughAcademicYear` — from
 * the previous year + 1 year. Terms before the earliest row are left out.
 *
 * Building stops before the first term whose start isn't before its end
 * (e.g. Spring exams typo'd past Sep 1, which no per-row CHECK relates to the
 * next Fall): an inverted term would break the contiguity every rule relies on.
 */
export function buildTerms(calendar: AcademicCalendarYear[], options: { throughAcademicYear?: number } = {}): Term[] {
  if (calendar.length === 0) return [];
  const byYear = new Map(calendar.map((row) => [row.academicYear, row]));
  const years = calendar.map((row) => row.academicYear);
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years, options.throughAcademicYear ?? -Infinity);

  /** The anchor for `year`, or the previous year's + 1 year when it isn't entered. */
  const anchor = (year: number, key: Anchor): string | null => {
    if (year < firstYear) return null;
    const value = byYear.get(year)?.[key];
    if (value) return value;
    const previous = anchor(year - 1, key);
    return previous ? addYears(previous, 1) : null;
  };

  const terms: Term[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    const fallStart = `${year}-${FALL_STARTS}`;
    const fallEnd = anchor(year, 'fallExamsEnd');
    const winterEnd = anchor(year, 'winterExamsEnd');
    const springEnd = anchor(year, 'springExamsEnd');
    const nextFallStart = `${year + 1}-${FALL_STARTS}`;
    const bounds: [Quarter, string | null, string | null][] = [
      ['Fall', fallStart, fallEnd && addDays(fallEnd, 1)],
      ['Winter', fallEnd && addDays(fallEnd, 1), winterEnd && addDays(winterEnd, 1)],
      ['Spring', winterEnd && addDays(winterEnd, 1), springEnd && addDays(springEnd, 1)],
      ['Summer', springEnd && addDays(springEnd, 1), nextFallStart],
    ];
    for (const [quarter, start, end] of bounds) {
      // Unresolvable bounds only occur in the earliest row (nothing to project
      // from): skip until the list starts, then stop rather than leave a gap.
      if (!start || !end) {
        if (terms.length > 0) return terms;
        continue;
      }
      if (start >= end) return terms;
      const labelYear = quarter === 'Fall' ? year : year + 1;
      terms.push({
        id: `${quarter.toLowerCase()}-${labelYear}`,
        quarter,
        academicYear: year,
        labelYear,
        label: `${quarter} ${labelYear}`,
        start,
        end,
      });
    }
  }
  return terms;
}

/**
 * Terms for everything a user can see on `today`: built two academic years
 * ahead, so a calendar that hasn't been updated still yields (projected)
 * current and upcoming terms, and every offered term has its same-quarter
 * neighbor one year later for the year-long rule.
 */
export function buildTermsForDate(calendar: AcademicCalendarYear[], today: string): Term[] {
  return buildTerms(calendar, { throughAcademicYear: Number(today.slice(0, 4)) + 2 });
}

/** Terms a user can filter on: the current one through the end of the next academic year. */
export function offeredTerms(terms: Term[], today: string): Term[] {
  const current = terms.find((term) => term.end > today);
  if (!current) return [];
  return terms.filter((term) => term.end > today && term.academicYear <= current.academicYear + 1);
}

/** Whether a lease's move-out falls in the year-long window around its 1-year anniversary. */
export function isYearLong(startDate: string, endDate: string): boolean {
  const anniversary = addYears(startDate, 1);
  return endDate >= addDays(anniversary, -YEAR_LONG_WINDOW_DAYS.before)
    && endDate <= addDays(anniversary, YEAR_LONG_WINDOW_DAYS.after);
}

/**
 * The terms a listing [startDate, endDate) — endDate being move-out — counts:
 * every term with at least MIN_TERM_OVERLAP_DAYS of overlap, except that a
 * year-long lease counting the same quarter at both ends keeps only the end
 * with more days (earlier on a tie).
 */
function countedTerms(startDate: string, endDate: string, terms: Term[]): Term[] {
  const days = new Map(terms.map((term) => [term, overlapDays(startDate, endDate, term.start, term.end)]));
  const covered = terms.filter((term) => days.get(term)! >= MIN_TERM_OVERLAP_DAYS);
  if (!isYearLong(startDate, endDate)) return covered;
  return covered.filter((term) => !covered.some((other) =>
    other !== term
    && other.quarter === term.quarter
    && (days.get(other)! > days.get(term)! || (days.get(other) === days.get(term) && other.start < term.start))));
}

/** Ids of every term the listing counts, in calendar order. */
export function coveredTermIds(startDate: string, endDate: string, terms: Term[]): string[] {
  return countedTerms(startDate, endDate, terms).map((term) => term.id);
}

/** Badges for every term the listing counts, in calendar order. */
export function termBadges(startDate: string, endDate: string, terms: Term[]): TermBadge[] {
  return countedTerms(startDate, endDate, terms).map(({ id, quarter, label }) => ({ id, quarter, label }));
}

/** Whether a listing counts every term of a validated, contiguous selection. */
export function matchesTermSelection(startDate: string, endDate: string, selection: Term[], terms: Term[]): boolean {
  if (selection.length === 0) return false;
  const counted = new Set(countedTerms(startDate, endDate, terms).map((term) => term.id));
  return selection.every((term) => counted.has(term.id));
}

/**
 * matchesTermSelection rewritten as plain bounds plus one year-long exclusion,
 * which is what searchSublets sends to SQL: comparisons on lower()/upper() get
 * real planner estimates from the expression statistics in 1793123266286,
 * where overlap arithmetic doesn't.
 *
 * Derivation, with N = MIN_TERM_OVERLAP_DAYS, first term [fs, fe), last term
 * [ks, ke), listing [s, e) (e = move-out):
 * - covers the first term ⇔ s ≤ fe − N, e ≥ fs + N, e − s ≥ N
 * - covers the last term  ⇔ e ≥ ks + N (s ≤ ke − N already follows), and a
 *   continuous listing then covers every term between.
 * - year-long exclusion: the first term is dropped iff the same quarter one
 *   year later has strictly more days; the last term iff the same quarter one
 *   year earlier has at least as many. Only the ends of a ~1-year lease can
 *   repeat a quarter, so only the selection's ends can be dropped.
 * Verified against matchesTermSelection by a property test over 80k+ cases.
 */
export function termSelectionBounds(selection: Term[], terms: Term[]): {
  startOnOrBefore: string;
  moveOutOnOrAfter: string;
  minNights: number;
  firstNextYear?: Term;
  lastPrevYear?: Term;
} {
  const first = selection[0];
  const last = selection[selection.length - 1];
  return {
    startOnOrBefore: addDays(first.end, -MIN_TERM_OVERLAP_DAYS),
    moveOutOnOrAfter: addDays(last.start, MIN_TERM_OVERLAP_DAYS),
    minNights: MIN_TERM_OVERLAP_DAYS,
    firstNextYear: terms.find((term) => term.quarter === first.quarter && term.academicYear === first.academicYear + 1),
    lastPrevYear: terms.find((term) => term.quarter === last.quarter && term.academicYear === last.academicYear - 1),
  };
}

/**
 * Checks untrusted term ids (from the URL) against the offered terms: a
 * non-empty list of known, distinct ids forming one contiguous run. Returns
 * the terms sorted in calendar order.
 */
export function validateTermSelection(ids: unknown, offered: Term[]): TermSelectionResult {
  if (!Array.isArray(ids)) return { ok: false, reason: 'not-a-list' };
  if (ids.length === 0) return { ok: false, reason: 'empty' };
  // A valid selection can't be longer than what's offered; don't scan a huge one.
  if (ids.length > offered.length) return { ok: false, reason: 'too-many' };
  const positions: number[] = [];
  for (const id of ids) {
    const position = typeof id === 'string' ? offered.findIndex((term) => term.id === id) : -1;
    if (position === -1) return { ok: false, reason: 'unknown' };
    if (positions.includes(position)) return { ok: false, reason: 'duplicate' };
    positions.push(position);
  }
  positions.sort((a, b) => a - b);
  if (positions[positions.length - 1] - positions[0] !== positions.length - 1) return { ok: false, reason: 'gap' };
  return { ok: true, terms: positions.map((position) => offered[position]) };
}
