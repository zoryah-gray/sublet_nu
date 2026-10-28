import { describe, it, expect } from 'vitest';
import { getOfferedTerms, nextTermSelection, parseTermParam } from '@/app/lib/academic-terms';
import { getFilteredSublets, MOCK_SUBLETS } from '@/app/lib/mock-data';

// Fall 2026 is the current term on this date.
const TODAY = '2026-10-27';
const offered = getOfferedTerms(TODAY);

/** Ids of the selected terms after URL parsing. */
function parsedIds(raw: string | undefined): string[] {
  return parseTermParam(raw, offered).map((term) => term.id);
}

/** Ids of the public mock listings matching a term selection given as a URL value. */
function matchingIds(raw: string): string[] {
  return getFilteredSublets({ terms: parseTermParam(raw, offered) }).map((sublet) => sublet.id);
}

describe('parseTermParam (the /browse ?terms= value)', () => {
  it('accepts a contiguous run, in any order, sorted by calendar', () => {
    expect(parsedIds('fall-2026,winter-2027')).toEqual(['fall-2026', 'winter-2027']);
    expect(parsedIds('winter-2027,fall-2026')).toEqual(['fall-2026', 'winter-2027']);
  });

  it('tolerates stray spaces and a trailing comma', () => {
    expect(parsedIds(' fall-2026 , winter-2027 ,')).toEqual(['fall-2026', 'winter-2027']);
  });

  it('a stale calendar still offers projected terms instead of none', () => {
    // The calendar's last row is 2028; years after it reuse the previous dates + 1 year.
    expect(getOfferedTerms('2030-10-01').map((term) => term.id).slice(0, 2)).toEqual(['fall-2030', 'winter-2031']);
  });

  it.each([
    ['fall-2026,spring-2027', 'a gap'],
    ['fall-2025', 'a past term'],
    ['autumn-2026', 'an unknown id'],
    ["fall-2026'<script>", 'a malformed id'],
    ['', 'an empty value'],
    [undefined, 'no value'],
  ])('drops %p (%s) to no term filter', (raw, reason) => {
    expect(parsedIds(raw), reason).toEqual([]);
  });
});

describe('term badges derived from mock listing dates', () => {
  it.each([
    ['10', ['Fall 2026', 'Winter 2027']],
    // Fall starts Sep 1 (rules v2), so a Sep 1 move-in is all Fall, no Summer.
    ['1', ['Fall 2026', 'Winter 2027']],
    ['8', ['Summer 2027', 'Fall 2027', 'Winter 2028']],
    // Sep 1 – Aug 31 is year-long, but no quarter repeats at its ends.
    ['12', ['Fall 2026', 'Winter 2027', 'Spring 2027', 'Summer 2027']],
  ])('listing %s shows %p', (id, labels) => {
    const sublet = MOCK_SUBLETS.find((s) => s.id === id)!;

    expect(sublet.terms.map((term) => term.label)).toEqual(labels);
  });
});

describe('getFilteredSublets term filter (same rules as searchSublets)', () => {
  it.each([
    // Rules v2: a listing matches every run of quarters it counts (no start rule).
    ['fall-2026', ['1', '3', '6', '10', '12']],
    ['winter-2027', ['1', '6', '7', '10', '12']],
    ['fall-2026,winter-2027', ['1', '6', '10', '12']],
    ['summer-2027', ['2', '4', '5', '8', '9', '12']],
    ['summer-2027,fall-2027', ['8']],
    ['spring-2027,summer-2027', ['2', '5', '12']],
  ])('%s → listings %p', (raw, ids) => {
    expect(matchingIds(raw)).toEqual(ids);
  });

  it('never returns non-public listings (13 is restricted and covers Winter 2027)', () => {
    expect(matchingIds('winter-2027')).not.toContain('13');
  });
});

describe('nextTermSelection (filter chip clicks keep the selection contiguous)', () => {
  const ids = offered.map((term) => term.id);

  it.each([
    [[], 'winter-2027', ['winter-2027'], 'first click selects one term'],
    [['fall-2026'], 'spring-2027', ['fall-2026', 'winter-2027', 'spring-2027'], 'extending fills the gap'],
    [['spring-2027'], 'fall-2026', ['fall-2026', 'winter-2027', 'spring-2027'], 'extending backwards fills the gap'],
    [['fall-2026', 'winter-2027', 'spring-2027'], 'spring-2027', ['fall-2026', 'winter-2027'], 'clicking the last term removes it'],
    [['fall-2026', 'winter-2027', 'spring-2027'], 'fall-2026', ['winter-2027', 'spring-2027'], 'clicking the first term removes it'],
    [['fall-2026', 'winter-2027', 'spring-2027'], 'winter-2027', ['winter-2027'], 'clicking an interior term resets to it'],
    [['fall-2026'], 'fall-2026', [], 'clicking the only term clears the filter'],
  ])('%p + click %s → %p (%s)', (selected, clicked, expected) => {
    expect(nextTermSelection(selected, clicked, ids)).toEqual(expected);
  });
});
