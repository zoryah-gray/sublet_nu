// Pure tests for the shared academic-term rules (packages/shared/src/terms.ts).
// No database. The same rules run in SQL (searchSublets), the mock /browse
// filter and the card badges, so the expected results here are Z's decided
// examples (rules v2, 10/27/26), verified against the Registrar calendar with
// an independent SQL computation.

import {
  MIN_TERM_OVERLAP_DAYS,
  YEAR_LONG_WINDOW_DAYS,
  buildTerms,
  coveredTermIds,
  isYearLong,
  matchesTermSelection,
  offeredTerms,
  termSelectionBounds,
  validateTermSelection,
  type AcademicCalendarYear,
  type Term,
} from '@sublet-nu/shared';

const CALENDAR: AcademicCalendarYear[] = [
  { academicYear: 2025, fallExamsEnd: '2025-12-13', winterExamsEnd: '2026-03-21', springExamsEnd: '2026-06-12' },
  { academicYear: 2026, fallExamsEnd: '2026-12-12', winterExamsEnd: '2027-03-20', springExamsEnd: '2027-06-11' },
  { academicYear: 2027, fallExamsEnd: '2027-12-11', winterExamsEnd: '2028-03-18', springExamsEnd: '2028-06-09' },
  { academicYear: 2028, fallExamsEnd: '2028-12-09', winterExamsEnd: null, springExamsEnd: null },
];
const TODAY = '2026-10-27';

const terms = buildTerms(CALENDAR);
const offered = offeredTerms(terms, TODAY);

/** The term with this id; fails the test if it doesn't exist. */
function term(id: string): Term {
  const found = terms.find((t) => t.id === id);
  if (!found) throw new Error(`no term ${id}`);
  return found;
}

/** Selected terms by id, in the given order. */
function selection(...ids: string[]): Term[] {
  return ids.map(term);
}

/** ISO date `days` after `base`. */
function iso(base: string, days: number): string {
  return new Date(Date.parse(base) + days * 86_400_000).toISOString().slice(0, 10);
}

describe('buildTerms', () => {
  test('2026–27 terms tile the year: Fall starts Sep 1, the rest start the day after the previous exams end', () => {
    expect(selection('summer-2026', 'fall-2026', 'winter-2027', 'spring-2027', 'summer-2027').map(({ id, label, start, end }) => ({ id, label, start, end }))).toEqual([
      { id: 'summer-2026', label: 'Summer 2026', start: '2026-06-13', end: '2026-09-01' },
      { id: 'fall-2026', label: 'Fall 2026', start: '2026-09-01', end: '2026-12-13' },
      { id: 'winter-2027', label: 'Winter 2027', start: '2026-12-13', end: '2027-03-21' },
      { id: 'spring-2027', label: 'Spring 2027', start: '2027-03-21', end: '2027-06-12' },
      { id: 'summer-2027', label: 'Summer 2027', start: '2027-06-12', end: '2027-09-01' },
    ]);
  });

  test('terms are contiguous: each ends where the next starts', () => {
    for (let i = 1; i < terms.length; i++) expect(terms[i].start).toBe(terms[i - 1].end);
  });

  test('a missing anchor falls back to the previous year\'s date + 1 year', () => {
    // 2028 has no winter/spring exam dates.
    expect(selection('winter-2029', 'spring-2029', 'summer-2029').map(({ start, end }) => [start, end])).toEqual([
      ['2028-12-10', '2029-03-19'],
      ['2029-03-19', '2029-06-10'],
      ['2029-06-10', '2029-09-01'],
    ]);
  });

  test('a whole missing year is projected from the year before', () => {
    const withoutFall2027 = buildTerms(CALENDAR.filter((row) => row.academicYear !== 2027));

    expect(withoutFall2027.find((t) => t.id === 'fall-2027')).toMatchObject({ start: '2027-09-01', end: '2027-12-13' });
  });
});

describe('offeredTerms', () => {
  test('current term through the end of the next academic year; past terms are hidden', () => {
    expect(offered.map((t) => t.id)).toEqual([
      'fall-2026', 'winter-2027', 'spring-2027', 'summer-2027',
      'fall-2027', 'winter-2028', 'spring-2028', 'summer-2028',
    ]);
  });
});

describe('coveredTermIds (14-day minimum, move-out day not counted)', () => {
  test('13 days into a term does not count; 14 does', () => {
    // Winter 2027 starts 2026-12-13. Move-out on 12-26 → nights 12-13..12-25 = 13 days.
    expect(coveredTermIds('2026-10-01', '2026-12-26', terms)).toEqual(['fall-2026']);
    expect(coveredTermIds('2026-10-01', '2026-12-27', terms)).toEqual(['fall-2026', 'winter-2027']);
    expect(MIN_TERM_OVERLAP_DAYS).toBe(14);
  });

  test('moving out on a term\'s first day is not part of that term', () => {
    expect(coveredTermIds('2027-06-12', '2027-09-01', terms)).toEqual(['summer-2027']);
  });

  test('moving in on a term\'s first day counts that term', () => {
    expect(coveredTermIds('2026-12-13', '2027-03-21', terms)).toEqual(['winter-2027']);
  });
});

describe('year-long leases (move-out 14 days before to 7 days after the 1-year anniversary)', () => {
  test.each([
    ['2027-09-05', false, 'anniversary − 15'],
    ['2027-09-06', true, 'anniversary − 14'],
    ['2027-09-20', true, 'on the anniversary'],
    ['2027-09-27', true, 'anniversary + 7'],
    ['2027-09-28', false, 'anniversary + 8'],
  ])('start 2026-09-20, move-out %s → year-long %p (%s)', (moveOut, expected) => {
    expect(isYearLong('2026-09-20', moveOut)).toBe(expected);
    expect(YEAR_LONG_WINDOW_DAYS).toEqual({ before: 14, after: 7 });
  });

  test('a Feb 29 start has its anniversary on Feb 28, like Postgres date + interval \'1 year\'', () => {
    expect(isYearLong('2028-02-29', '2029-03-07')).toBe(true);
    expect(isYearLong('2028-02-29', '2029-03-08')).toBe(false);
  });

  test.each([
    ['2027-09-27', ['fall-2026', 'winter-2027', 'spring-2027', 'summer-2027'], 'year-long: Fall 2027 (26 days) loses to Fall 2026 (84)'],
    ['2027-09-28', ['fall-2026', 'winter-2027', 'spring-2027', 'summer-2027', 'fall-2027'], 'not year-long: Fall 2027 (27 days) counts'],
  ])('start 2026-09-20, move-out %s covers %p (%s)', (moveOut, expected) => {
    expect(coveredTermIds('2026-09-20', moveOut, terms)).toEqual(expected);
  });

  test('a tie keeps the earlier end; one more day flips it', () => {
    // Fall 2026 from Oct 23 = 51 days. Move-out Oct 22, 2027 → Fall 2027 also 51 days.
    expect(coveredTermIds('2026-10-23', '2027-10-22', terms)).toEqual(['fall-2026', 'winter-2027', 'spring-2027', 'summer-2027']);
    expect(coveredTermIds('2026-10-23', '2027-10-23', terms)).toEqual(['winter-2027', 'spring-2027', 'summer-2027', 'fall-2027']);
  });
});

describe('matchesTermSelection (Z\'s matrix, rules v2)', () => {
  const listings: Record<string, [string, string]> = {
    A: ['2026-09-20', '2026-12-18'],
    B: ['2026-09-20', '2027-03-12'],
    C: ['2026-09-20', '2027-09-20'],
    D: ['2026-09-20', '2026-11-25'],
    E: ['2026-10-01', '2026-12-01'],
    F: ['2026-07-01', '2026-12-20'],
    G: ['2026-09-01', '2026-12-18'],
    H: ['2027-05-01', '2027-08-20'],
    I: ['2027-01-05', '2028-01-03'],
    J: ['2026-08-15', '2027-08-10'],
    K: ['2026-09-20', '2027-09-25'],
  };
  const selections: Record<string, string[]> = {
    'Su26': ['summer-2026'],
    'F26': ['fall-2026'],
    'W27': ['winter-2027'],
    'Sp27': ['spring-2027'],
    'Su27': ['summer-2027'],
    'F27': ['fall-2027'],
    'Su26+F26': ['summer-2026', 'fall-2026'],
    'F26+W27': ['fall-2026', 'winter-2027'],
    'W27+Sp27': ['winter-2027', 'spring-2027'],
    'Sp27+Su27': ['spring-2027', 'summer-2027'],
    'F26..Sp27': ['fall-2026', 'winter-2027', 'spring-2027'],
    'F26..Su27': ['fall-2026', 'winter-2027', 'spring-2027', 'summer-2027'],
    'F26..F27': ['fall-2026', 'winter-2027', 'spring-2027', 'summer-2027', 'fall-2027'],
    'Su27+F27': ['summer-2027', 'fall-2027'],
  };
  const FALL_THROUGH_SUMMER = ['F26', 'W27', 'Sp27', 'Su27', 'F26+W27', 'W27+Sp27', 'Sp27+Su27', 'F26..Sp27', 'F26..Su27'];
  const expected: Record<string, string[]> = {
    A: ['F26'],
    B: ['F26', 'W27', 'F26+W27'],
    C: FALL_THROUGH_SUMMER,
    D: ['F26'],
    E: ['F26'],
    F: ['Su26', 'F26', 'Su26+F26'],
    G: ['F26'],
    H: ['Sp27', 'Su27', 'Sp27+Su27'],
    I: ['W27', 'Sp27', 'Su27', 'F27', 'W27+Sp27', 'Sp27+Su27', 'Su27+F27'],
    J: FALL_THROUGH_SUMMER,
    K: FALL_THROUGH_SUMMER,
  };

  test.each(Object.keys(listings))('listing %s matches exactly its expected selections', (name) => {
    const [start, end] = listings[name];
    const matched = Object.keys(selections).filter((key) =>
      matchesTermSelection(start, end, selection(...selections[key]), terms),
    );

    expect(matched).toEqual(expected[name]);
  });
});

describe('validateTermSelection', () => {
  test('accepts a contiguous run in any order and returns it sorted', () => {
    const result = validateTermSelection(['winter-2027', 'fall-2026'], offered);

    expect(result).toEqual({ ok: true, terms: selection('fall-2026', 'winter-2027') });
  });

  test.each([
    [[], 'empty'],
    [['fall-2026', 'spring-2027'], 'gap'],
    [['fall-2026', 'fall-2026'], 'duplicate'],
    [['fall-2025'], 'unknown'],
    [['fall-2029'], 'unknown'],
    [['autumn-2026'], 'unknown'],
    [["fall-2026'; DROP TABLE sublets; --"], 'unknown'],
    ['fall-2026', 'not-a-list'],
    [[42], 'unknown'],
  ])('rejects %p (%s)', (ids, reason) => {
    expect(validateTermSelection(ids, offered)).toEqual({ ok: false, reason });
  });

  test('a selection longer than the offered list is rejected without scanning it', () => {
    const huge = Array.from({ length: 100_000 }, () => 'fall-2026');

    expect(validateTermSelection(huge, offered)).toEqual({ ok: false, reason: 'too-many' });
  });
});

describe('termSelectionBounds (the form the SQL filter uses)', () => {
  test('Fall 2026 + Winter 2027', () => {
    expect(termSelectionBounds(selection('fall-2026', 'winter-2027'), terms)).toEqual({
      startOnOrBefore: '2026-11-29',
      moveOutOnOrAfter: '2026-12-27',
      minNights: 14,
      firstNextYear: term('fall-2027'),
      lastPrevYear: term('winter-2026'),
    });
  });

  test('a term with no same-quarter neighbor in the list leaves that bound out', () => {
    expect(termSelectionBounds(selection('fall-2025'), terms).lastPrevYear).toBeUndefined();
  });

  test('agrees with matchesTermSelection on a 2-year grid incl. year-long leases × every short contiguous selection', () => {
    /** Overlap days with a term, as the SQL computes it: least(move-out, end) − greatest(start, start). */
    const overlap = (start: string, end: string, t: Term) => {
      const from = start > t.start ? start : t.start;
      const to = end < t.end ? end : t.end;
      return Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);
    };
    /** The SQL predicate searchSublets sends, transliterated. */
    const sqlPredicate = (start: string, end: string, sel: Term[]) => {
      const b = termSelectionBounds(sel, terms);
      const first = sel[0];
      const last = sel[sel.length - 1];
      const nights = (Date.parse(end) - Date.parse(start)) / 86_400_000;
      const firstDropped = b.firstNextYear !== undefined && overlap(start, end, b.firstNextYear) > overlap(start, end, first);
      const lastDropped = b.lastPrevYear !== undefined && overlap(start, end, b.lastPrevYear) >= overlap(start, end, last);
      return start <= b.startOnOrBefore
        && end >= b.moveOutOnOrAfter
        && nights > b.minNights - 1
        && !(isYearLong(start, end) && (firstDropped || lastDropped));
    };
    const runs: Term[][] = [];
    for (let i = 0; i < offered.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 4, offered.length); j++) runs.push(offered.slice(i, j));
    }
    let checked = 0;
    for (let startOffset = 0; startOffset < 730; startOffset += 3) {
      const start = iso('2026-06-01', startOffset);
      for (const length of [1, 13, 14, 15, 60, 120, 200, 350, 351, 352, 358, 365, 366, 372, 373, 380]) {
        const end = iso(start, length);
        for (const sel of runs) {
          expect([start, end, sel.map((t) => t.id), sqlPredicate(start, end, sel)])
            .toEqual([start, end, sel.map((t) => t.id), matchesTermSelection(start, end, sel, terms)]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(80_000);
  });
});

describe('hardening', () => {
  const twoYears = CALENDAR.filter((row) => row.academicYear <= 2026);

  test('a stale calendar still offers terms: missing years are projected up to the requested academic year', () => {
    const projected = buildTerms(twoYears, { throughAcademicYear: 2030 });

    expect(offeredTerms(projected, '2029-10-01').map((t) => t.id)).toEqual([
      'fall-2029', 'winter-2030', 'spring-2030', 'summer-2030',
      'fall-2030', 'winter-2031', 'spring-2031', 'summer-2031',
    ]);
    // Fall exams projected from 2026-12-12 + 3 years.
    expect(projected.find((t) => t.id === 'fall-2029')).toMatchObject({ start: '2029-09-01', end: '2029-12-13' });
  });

  test('without throughAcademicYear, terms stop at the last calendar row', () => {
    expect(buildTerms(twoYears).at(-1)?.id).toBe('summer-2027');
  });

  test.each([
    ['Spring exams typo\'d past Sep 1 (Summer 2028 would invert)', { academicYear: 2027, fallExamsEnd: '2027-12-11', winterExamsEnd: '2028-03-18', springExamsEnd: '2028-09-15' }, 'spring-2028'],
    ['Fall exams typo\'d before Sep 1 (Fall 2027 would invert)', { academicYear: 2027, fallExamsEnd: '2027-08-11', winterExamsEnd: null, springExamsEnd: null }, 'summer-2027'],
  ])('%s: building stops before the inverted term', (_label, row, lastId) => {
    const typo = buildTerms([...twoYears, row as AcademicCalendarYear]);

    expect(typo.every((t) => t.start < t.end)).toBe(true);
    expect(typo.at(-1)?.id).toBe(lastId);
    for (let i = 1; i < typo.length; i++) expect(typo[i].start).toBe(typo[i - 1].end);
  });
});
