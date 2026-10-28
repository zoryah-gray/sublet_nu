// Sublet reads for the public /browse path. Everything here goes through the
// public_sublets view, so exact location columns and non-public rows are
// unreachable by construction (see 1793032424185_add-public-safe-columns).
//
// SQL is assembled only from static fragments in this file. Caller-supplied
// values (search text, rents, place type, dates, paging, term ranges) are
// always bound parameters — never concatenated into the SQL text. Sort is
// allow-listed and selects one of the fixed ORDER BY fragments below.

import type { ClientBase } from 'pg';
import {
  MAX_SEARCH_LENGTH,
  YEAR_LONG_WINDOW_DAYS,
  buildTermsForDate,
  offeredTerms,
  termSelectionBounds,
  validateTermSelection,
  type AcademicCalendarYear,
  type Term,
  type TermSelectionResult,
} from '@sublet-nu/shared';

/** Anything that can run a parameterized query: a pg Client, PoolClient or Pool. */
export type Queryable = Pick<ClientBase, 'query'>;

export type SearchSort = 'new' | 'asc' | 'desc';
export type PlaceType = 'entire' | 'private';

/** One option per /browse filter (browse-filters-client.tsx), plus paging. */
export type SearchSubletsOptions = {
  minRent?: number;
  maxRent?: number;
  /**
   * 'asc' / 'desc' = by rent (overrides relevance); 'new' = newest first.
   * Omitted: relevance when there's search text, else newest first.
   */
  sort?: SearchSort;
  placeType?: PlaceType;
  /**
   * Requested stay, 'YYYY-MM-DD' move-in and move-out (both or neither).
   * Matches listings available for the whole stay.
   */
  availableFrom?: string;
  availableTo?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
  /**
   * Term ids such as ['fall-2026', 'winter-2027']: one contiguous run of
   * current/upcoming terms. Matches listings that count every selected term
   * (14+ days each; year-long rule — packages/shared/src/terms.ts).
   */
  terms?: string[];
  /** 'YYYY-MM-DD'; decides which terms are current. Defaults to today in Chicago. */
  today?: string;
};

export type PublicSubletSearchRow = {
  id: string;
  title: string;
  approximateStreet: string;
  city: string;
  monthlyRent: number;
  placeType: string;
  createdAt: Date;
  /** 'YYYY-MM-DD'. With moveOutDate, enough to derive term badges (termBadges). */
  startDate: string;
  /** 'YYYY-MM-DD', the move-out day (stored range upper bound − 1). */
  moveOutDate: string;
  /** ts_rank against the search text; null when no search text was given. */
  rank: number | null;
};

/** Matches ITEMS_PER_PAGE on the frontend's /browse page. */
export const DEFAULT_PAGE_SIZE = 6;
export const MAX_PAGE_SIZE = 100;
// Counted in code points after trimming; shared with the frontend search box.
export { MAX_SEARCH_LENGTH };

// C0 controls and DEL, except tab / LF / CR, which the parser treats as spaces.
// NUL in particular makes Postgres raise 22021 instead of searching.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type SearchInputField =
  | 'query' | 'minRent' | 'maxRent' | 'sort' | 'placeType' | 'availableFrom' | 'availableTo'
  | 'page' | 'pageSize' | 'terms' | 'today';

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Fixed fragments; the tiebreaker follows the rent direction so one
// (monthly_rent, id) index can serve both with a forward or backward scan.
const ORDER_BY: Record<SearchSort, string> = {
  new: 'created_at DESC, id',
  asc: 'monthly_rent ASC, id ASC',
  desc: 'monthly_rent DESC, id DESC',
};
const PLACE_TYPES: readonly PlaceType[] = ['entire', 'private'];
/** Longest requested stay accepted (2 years). */
const MAX_STAY_DAYS = 731;
const DAY_MS = 86_400_000;

const TERM_RULES: Record<Exclude<TermSelectionResult, { ok: true }>['reason'], string> = {
  'not-a-list': 'must be a list of term ids',
  empty: 'must not be empty',
  'too-many': 'must not list more terms than are offered',
  unknown: 'must be current or upcoming terms',
  duplicate: 'must not repeat a term',
  gap: 'must be consecutive terms',
};

/**
 * Invalid caller input, raised before any SQL is sent. The message names the
 * rule but never repeats the value, so it is safe to show to the user.
 */
export class SearchInputError extends RangeError {
  readonly field: SearchInputField;

  /** Records which input field broke which rule. */
  constructor(field: SearchInputField, rule: string) {
    super(`${field} ${rule}`);
    this.name = 'SearchInputError';
    this.field = field;
  }
}

type SearchRow = {
  id: string;
  title: string;
  approximate_street: string;
  city: string;
  monthly_rent: string;
  place_type: string;
  created_at: Date;
  start_date: string;
  move_out_date: string;
  rank: number | null;
};

/**
 * Full-text search over public listings' titles, combined with every /browse
 * filter (rent, place type, quarters, requested stay), sort and offset
 * pagination.
 *
 * Empty or whitespace-only `query` applies no search filter (newest first, like
 * unfiltered /browse). Otherwise the text goes through websearch_to_tsquery
 * ('english'): unquoted words are ANDed in any order, stopwords are dropped,
 * and a query of only stopwords or symbols matches nothing. Results are ordered
 * by ts_rank, with id as the tiebreaker so pages never overlap or skip rows.
 *
 * Throws SearchInputError (a RangeError) for invalid input — see
 * validateSearchInput and resolveTermFilter — before the listings query is
 * sent. A term filter first reads academic_calendar to validate against.
 */
export async function searchSublets(
  db: Queryable,
  query: string,
  options: SearchSubletsOptions = {},
): Promise<PublicSubletSearchRow[]> {
  validateSearchInput(query, options);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const termFilter = options.terms === undefined ? undefined : await resolveTermFilter(db, options.terms, options.today);

  const values: unknown[] = [];
  /** Binds a value and returns its placeholder ($1, $2, ...) — the only way a value enters the SQL. */
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  const searchText = query.trim();
  const where: string[] = [];
  let rank = 'NULL::real';
  let orderBy = 'created_at DESC, id';

  if (searchText !== '') {
    // Same column the GIN index is on (title_search), same config the column
    // was generated with ('english'); otherwise the index can't be used.
    const tsquery = `websearch_to_tsquery('english', ${bind(searchText)})`;
    where.push(`title_search @@ ${tsquery}`);
    rank = `ts_rank(title_search, ${tsquery})`;
    orderBy = 'rank DESC, id';
  }
  if (options.sort) orderBy = ORDER_BY[options.sort];
  if (options.minRent !== undefined) where.push(`monthly_rent >= ${bind(options.minRent)}`);
  if (options.maxRent !== undefined) where.push(`monthly_rent <= ${bind(options.maxRent)}`);
  if (options.placeType) where.push(`place_type = ${bind(options.placeType)}`);
  if (options.availableFrom && options.availableTo) {
    // Built with '[]' exactly like stored listings, so containment means the
    // listing's move-in is on/before the requested one and its move-out
    // on/after the requested one. Served by idx_sublets_date_range (GiST @>).
    where.push(`availability_date_range @> daterange(${bind(options.availableFrom)}::date, ${bind(options.availableTo)}::date, '[]')`);
  }
  if (termFilter) {
    // The term rule as plain bounds (termSelectionBounds), bound as values: the
    // planner estimates lower()/upper() comparisons from the expression
    // statistics in 1793123266286, so it can still walk the newest-first index
    // (report pass 6). The stored upper bound is move-out + 1.
    where.push(`lower(availability_date_range) <= ${bind(termFilter.startOnOrBefore)}::date`);
    where.push(`upper(availability_date_range) > ${bind(termFilter.moveOutOnOrAfter)}::date`);
    where.push(`upper(availability_date_range) - lower(availability_date_range) > ${bind(termFilter.minNights)}`);

    /** Days the listing (move-out not counted) overlaps a term, with the term's dates bound. */
    const overlap = (term: Term) =>
      `greatest(0, least(upper(availability_date_range) - 1, ${bind(term.end)}::date)`
      + ` - greatest(lower(availability_date_range), ${bind(term.start)}::date))`;
    const dropped: string[] = [];
    if (termFilter.firstNextYear) dropped.push(`${overlap(termFilter.firstNextYear)} > ${overlap(termFilter.first)}`);
    if (termFilter.lastPrevYear) dropped.push(`${overlap(termFilter.lastPrevYear)} >= ${overlap(termFilter.last)}`);
    // A year-long lease counts a repeated quarter only at its end with more
    // days (earlier on a tie), so it can't match a selection whose first or
    // last term is the end it gives up. The nights range (a safe superset of
    // every year-long lease, 352–374) comes first: it has planner statistics,
    // so the planner sees this clause removes almost nothing.
    if (dropped.length) {
      const anniversary = `(lower(availability_date_range) + interval '1 year')::date`;
      where.push(`NOT (upper(availability_date_range) - lower(availability_date_range)`
        + ` BETWEEN ${bind(365 - YEAR_LONG_WINDOW_DAYS.before)}::int AND ${bind(366 + YEAR_LONG_WINDOW_DAYS.after + 2)}::int`
        // ::int, or Postgres reads date − $n as date − date.
        + ` AND upper(availability_date_range) - 1 BETWEEN ${anniversary} - ${bind(YEAR_LONG_WINDOW_DAYS.before)}::int`
        + ` AND ${anniversary} + ${bind(YEAR_LONG_WINDOW_DAYS.after)}::int`
        + ` AND (${dropped.join(' OR ')}))`);
    }
  }

  const text = `
    SELECT id, title, approximate_street, city, monthly_rent, place_type, created_at,
           lower(availability_date_range)::text AS start_date,
           (upper(availability_date_range) - 1)::text AS move_out_date,
           ${rank} AS rank
      FROM public_sublets
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${orderBy}
     LIMIT ${bind(pageSize)} OFFSET ${bind((page - 1) * pageSize)}`;

  const result = await db.query<SearchRow>(text, values);
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    approximateStreet: row.approximate_street,
    city: row.city,
    monthlyRent: Number(row.monthly_rent),
    placeType: row.place_type,
    createdAt: row.created_at,
    startDate: row.start_date,
    moveOutDate: row.move_out_date,
    rank: row.rank,
  }));
}

// The calendar changes once a year, by migration, but a term filter needs it on
// every search: cached per process so filtered searches don't pay an extra
// round trip. A failed read isn't cached. Deploys restart the process anyway.
const CALENDAR_TTL_MS = 60 * 60 * 1000;
let calendarCache: { loadedAt: number; calendar: Promise<AcademicCalendarYear[]> } | undefined;

/** Drops the cached calendar (tests, or after a calendar migration in a long-lived process). */
export function clearAcademicCalendarCache(): void {
  calendarCache = undefined;
}

/** The academic calendar, read at most once per CALENDAR_TTL_MS. */
function cachedAcademicCalendar(db: Queryable): Promise<AcademicCalendarYear[]> {
  if (!calendarCache || Date.now() - calendarCache.loadedAt > CALENDAR_TTL_MS) {
    const calendar = loadAcademicCalendar(db);
    calendarCache = { loadedAt: Date.now(), calendar };
    // Only evict this read's own entry, never a newer one that replaced it.
    calendar.catch(() => {
      if (calendarCache?.calendar === calendar) clearAcademicCalendarCache();
    });
  }
  return calendarCache.calendar;
}

/** Reads every academic_calendar row (a few rows; changes once a year). */
export async function loadAcademicCalendar(db: Queryable): Promise<AcademicCalendarYear[]> {
  const result = await db.query<{
    academic_year: number;
    fall_exams_end: string | null;
    winter_exams_end: string | null;
    spring_exams_end: string | null;
  }>(
    // ::text keeps dates as 'YYYY-MM-DD' instead of JS Dates shifted by the server's time zone.
    `SELECT academic_year, fall_exams_end::text, winter_exams_end::text, spring_exams_end::text
       FROM academic_calendar ORDER BY academic_year`,
  );
  return result.rows.map((row) => ({
    academicYear: row.academic_year,
    fallExamsEnd: row.fall_exams_end,
    winterExamsEnd: row.winter_exams_end,
    springExamsEnd: row.spring_exams_end,
  }));
}

/** Today's date in Chicago as 'YYYY-MM-DD' — the campus calendar day. */
function chicagoToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/**
 * Validates term ids against the current calendar and returns the selection's
 * first and last terms with its date bounds. Throws SearchInputError('terms')
 * for an invalid selection.
 */
async function resolveTermFilter(db: Queryable, ids: string[], today = chicagoToday()) {
  const terms = buildTermsForDate(await cachedAcademicCalendar(db), today);
  const result = validateTermSelection(ids, offeredTerms(terms, today));
  if (!result.ok) throw new SearchInputError('terms', TERM_RULES[result.reason]);
  return {
    first: result.terms[0],
    last: result.terms[result.terms.length - 1],
    ...termSelectionBounds(result.terms, terms),
  };
}

/** Whether a value is a real 'YYYY-MM-DD' date (Date.parse rolls '2026-02-31' to Mar 3, so round-trip it). */
function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Requested stay: both dates or neither, real dates, move-out after move-in, at most MAX_STAY_DAYS. */
function validateStayDates(from: unknown, to: unknown): void {
  if (from !== undefined && !isIsoDate(from)) throw new SearchInputError('availableFrom', 'must be a YYYY-MM-DD date');
  if (to !== undefined && !isIsoDate(to)) throw new SearchInputError('availableTo', 'must be a YYYY-MM-DD date');
  if (from === undefined && to === undefined) return;
  if (from === undefined) throw new SearchInputError('availableFrom', 'is required with availableTo');
  if (to === undefined) throw new SearchInputError('availableTo', 'is required with availableFrom');
  const days = (Date.parse(to as string) - Date.parse(from as string)) / DAY_MS;
  if (days <= 0) throw new SearchInputError('availableTo', 'must be after availableFrom');
  if (days > MAX_STAY_DAYS) throw new SearchInputError('availableTo', `must be within ${MAX_STAY_DAYS} days of availableFrom`);
}

/**
 * Rejects input that would otherwise surface as a raw Postgres error (NUL,
 * non-numeric rents) or silently return nothing (NaN / Infinity rents).
 * Runtime checks, not just types: callers pass values parsed from the URL.
 */
function validateSearchInput(query: unknown, options: SearchSubletsOptions): void {
  if (typeof query !== 'string') throw new SearchInputError('query', 'must be a string');
  if ([...query.trim()].length > MAX_SEARCH_LENGTH) {
    throw new SearchInputError('query', `must be at most ${MAX_SEARCH_LENGTH} characters`);
  }
  if (CONTROL_CHARACTERS.test(query)) throw new SearchInputError('query', 'must not contain control characters');

  for (const field of ['minRent', 'maxRent'] as const) {
    const rent: unknown = options[field];
    if (rent !== undefined && !(typeof rent === 'number' && Number.isFinite(rent) && rent >= 0)) {
      throw new SearchInputError(field, 'must be a finite number >= 0');
    }
  }

  if (options.terms !== undefined && !Array.isArray(options.terms)) {
    throw new SearchInputError('terms', TERM_RULES['not-a-list']);
  }
  if (options.today !== undefined && !isIsoDate(options.today)) {
    throw new SearchInputError('today', 'must be a YYYY-MM-DD date');
  }

  const sort: unknown = options.sort;
  if (sort !== undefined && !(typeof sort === 'string' && Object.hasOwn(ORDER_BY, sort))) {
    throw new SearchInputError('sort', `must be one of ${Object.keys(ORDER_BY).join(', ')}`);
  }
  const placeType: unknown = options.placeType;
  if (placeType !== undefined && !PLACE_TYPES.includes(placeType as PlaceType)) {
    throw new SearchInputError('placeType', `must be one of ${PLACE_TYPES.join(', ')}`);
  }
  validateStayDates(options.availableFrom, options.availableTo);

  const page: unknown = options.page ?? 1;
  if (!Number.isInteger(page) || (page as number) < 1) {
    throw new SearchInputError('page', 'must be an integer >= 1');
  }
  const pageSize: unknown = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > MAX_PAGE_SIZE) {
    throw new SearchInputError('pageSize', `must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }
}
