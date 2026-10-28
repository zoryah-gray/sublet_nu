// searchSublets against a real, migrated Postgres. Same harness as
// sublets.db.test.ts: every test runs in a transaction that is rolled back.
//
// The database may already hold seed rows (seed-browse.sql titles such as
// "Sunny Studio Near Campus"), so positive assertions look only at the ids a
// test inserted itself. "Zero rows" is asserted only where it must hold for any
// data. Titles use the made-up word "zyzzyva" where a test needs a term no seed
// title contains.
//
// Authorization at this layer = only public rows are searchable (test 12).
// No state-machine column is touched, so there's no illegal transition to test.

import { Client, type QueryConfig } from 'pg';
import {
  MAX_SEARCH_LENGTH,
  SearchInputError,
  clearAcademicCalendarCache,
  searchSublets,
  type Queryable,
  type SearchSubletsOptions,
} from '../../db/repositories/sublets';
import { buildTermsForDate, matchesTermSelection, offeredTerms, type AcademicCalendarYear } from '@sublet-nu/shared';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // Fail loudly instead of skipping, so a misconfigured CI can't pass green.
  throw new Error('DATABASE_URL is not set — DB tests need a migrated Postgres to run against.');
}

const client = new Client({ connectionString: databaseUrl });

beforeAll(async () => {
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

beforeEach(async () => {
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
});

type ListingOverrides = {
  monthlyRent?: number;
  displayStatus?: 'public' | 'restricted' | 'private' | 'deleted';
  /** [start, move-out] as the form submits them; stored as daterange(start, end, '[]'). */
  dates?: [string, string];
  placeType?: 'entire' | 'private';
};

/** Inserts an owner plus one sublet with the given title (public by default), returning the sublet id. */
async function insertListing(title: string, overrides: ListingOverrides = {}): Promise<string> {
  const owner = await client.query<{ id: string }>(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    ['Search Test Owner', `search.owner.${Math.random().toString(36).slice(2)}@u.northwestern.edu`],
  );
  const sublet = await client.query<{ id: string }>(
    `INSERT INTO sublets (
       owner_id, title, street_address, city, state, zip_code, coordinates,
       monthly_rent, bedroom_count, bathroom_count, availability_date_range,
       description, display_status, place_type
     ) VALUES ($1, $2, '1234 Hinman Ave', 'Evanston', 'IL', '60202',
               ST_Point(-87.6789093, 42.0399533, 4326), $3, 1, 1,
               daterange($5::date, $6::date, '[]'), 'Search test listing.', $4, $7)
     RETURNING id`,
    [
      owner.rows[0].id,
      title,
      overrides.monthlyRent ?? 1450,
      overrides.displayStatus ?? 'public',
      ...(overrides.dates ?? ['2026-09-21', '2026-12-12']),
      overrides.placeType ?? 'entire',
    ],
  );
  return sublet.rows[0].id;
}

type RecordedQuery = { text: string; values: unknown[] };

/** Wraps the test client so every query searchSublets sends is recorded as (SQL text, bound values). */
function recordingDb(): { db: Queryable; calls: RecordedQuery[] } {
  const calls: RecordedQuery[] = [];
  const db = {
    query: (config: QueryConfig | string, values?: unknown[]) => {
      const text = typeof config === 'string' ? config : config.text;
      const bound = typeof config === 'string' ? values : config.values ?? values;
      calls.push({ text, values: bound ?? [] });
      return client.query(config as string, bound);
    },
  } as Queryable;
  return { db, calls };
}

/** Ids of the rows searchSublets returned, in result order. */
async function searchIds(query: string, options?: Parameters<typeof searchSublets>[2]): Promise<string[]> {
  return (await searchSublets(client, query, options)).map((row) => row.id);
}

describe('searchSublets (title full-text search)', () => {
  test('1. empty string applies no search filter: same rows as unfiltered /browse, not zero rows', async () => {
    await insertListing('Zyzzyva Empty Query Loft');
    const unfiltered = await client.query<{ id: string }>(
      `SELECT id FROM public_sublets ORDER BY created_at DESC, id LIMIT 6`,
    );

    const ids = await searchIds('');

    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(unfiltered.rows.map((row) => row.id));
  });

  test('2. whitespace-only input behaves exactly like the empty string', async () => {
    await insertListing('Zyzzyva Whitespace Loft');

    const whitespace = await searchIds('   ');

    expect(whitespace.length).toBeGreaterThan(0);
    expect(whitespace).toEqual(await searchIds(''));
  });

  test('3. "main near campus" matches "Near Main Campus": all terms required, order irrelevant', async () => {
    const id = await insertListing('Near Main Campus');

    expect(await searchIds('main near campus', { pageSize: 100 })).toContain(id);
  });

  test('4. stopwords are ignored: "the studio at dempster" matches "Studio at Dempster"', async () => {
    const id = await insertListing('Studio at Dempster');

    expect(await searchIds('the studio at dempster', { pageSize: 100 })).toContain(id);
  });

  test('5. a stopword-only query ("the") does not error and returns no rows', async () => {
    await insertListing('The Zyzzyva House');

    await expect(searchIds('the')).resolves.toEqual([]);
  });

  test('6. "c@mpus" does not error', async () => {
    await insertListing('Zyzzyva Campus Room');

    await expect(searchSublets(client, 'c@mpus')).resolves.toBeInstanceOf(Array);
  });

  test('7. pure symbol input ("@@@") does not error and returns no rows', async () => {
    await insertListing('Zyzzyva Symbol Studio');

    await expect(searchIds('@@@')).resolves.toEqual([]);
  });

  test.each([["' OR 1=1"], ["'; DROP TABLE sublets; --"]])(
    '8. injection-shaped input %p is inert search text, sent only as a bound parameter',
    async (input) => {
      const unrelated = await insertListing('Zyzzyva Injection Loft');
      const before = await client.query<{ count: string }>(`SELECT count(*) FROM sublets`);
      const { db, calls } = recordingDb();

      const rows = await searchSublets(db, input, { pageSize: 100 });

      expect(rows.map((row) => row.id)).not.toContain(unrelated);
      const after = await client.query<{ count: string }>(`SELECT count(*) FROM sublets`);
      expect(after.rows[0].count).toBe(before.rows[0].count);

      // Inspect what was actually sent, not only the result.
      expect(calls).toHaveLength(1);
      expect(calls[0].text).not.toContain(input);
      expect(calls[0].text).not.toContain(input.trim());
      expect(calls[0].values).toContain(input.trim());
    },
  );

  test.each([["Mike's Place"], ['Mike’s Place']])(
    '9. a title with an apostrophe (%p) is found by its own text',
    async (title) => {
      const id = await insertListing(title);

      expect(await searchIds(title, { pageSize: 100 })).toContain(id);
    },
  );

  test('10. ranking: a full-title match ranks above a single-word match, using plain ts_rank', async () => {
    // Under the default AND, a listing matching only one word isn't returned at
    // all, so both can only appear in one result set via websearch's `or`.
    const partial = await insertListing('Zyzzyva Studio');
    const full = await insertListing('Zyzzyva Loft');
    const { db, calls } = recordingDb();

    const rows = await searchSublets(db, 'zyzzyva or loft', { pageSize: 100 });
    const ids = rows.map((row) => row.id);

    expect(ids).toEqual(expect.arrayContaining([full, partial]));
    expect(ids.indexOf(full)).toBeLessThan(ids.indexOf(partial));
    const rankOf = (id: string) => rows.find((row) => row.id === id)!.rank!;
    expect(rankOf(full)).toBeGreaterThan(rankOf(partial));

    expect(calls[0].text).toContain('ts_rank(');
    expect(calls[0].text).not.toContain('ts_rank_cd');
  });

  test('11. pagination: page 1 then page 2 (then 3) has no duplicate and no skipped rows on tied ranks', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await insertListing('Zyzzyva Pagination Loft'));

    const pages = [
      await searchIds('zyzzyva pagination', { page: 1, pageSize: 2 }),
      await searchIds('zyzzyva pagination', { page: 2, pageSize: 2 }),
      await searchIds('zyzzyva pagination', { page: 3, pageSize: 2 }),
    ];

    expect(pages.map((page) => page.length)).toEqual([2, 2, 1]);
    const combined = pages.flat();
    expect(new Set(combined).size).toBe(5);
    // Identical titles tie on rank, so the order is decided by the id tiebreaker.
    expect(combined).toEqual([...ids].sort());
  });

  test('12. search + display_status + rent range returns exactly the intersection', async () => {
    const expected = await insertListing('Zyzzyva Intersection Loft', { monthlyRent: 1500 });
    const privateRow = await insertListing('Zyzzyva Intersection Loft', { monthlyRent: 1500, displayStatus: 'private' });
    const tooExpensive = await insertListing('Zyzzyva Intersection Loft', { monthlyRent: 2500 });
    const noMatch = await insertListing('Quiet Studio Off Sheridan', { monthlyRent: 1500 });
    const mine = new Set([expected, privateRow, tooExpensive, noMatch]);

    const ids = await searchIds('zyzzyva intersection', { minRent: 1000, maxRent: 2000, pageSize: 100 });

    expect(ids.filter((id) => mine.has(id))).toEqual([expected]);
  });

  test.each([
    [{ page: 0 }],
    [{ page: 1.5 }],
    [{ pageSize: 0 }],
    [{ pageSize: 101 }],
  ])('13. (validation, beyond the brief list) invalid pagination %p throws RangeError before querying', async (options) => {
    const { db, calls } = recordingDb();

    await expect(searchSublets(db, 'zyzzyva', options)).rejects.toThrow(RangeError);
    expect(calls).toHaveLength(0);
  });

  describe('input validation (rejected before any query is sent)', () => {
    /** Asserts the call rejects with SearchInputError for `field`, sends no SQL, and doesn't echo the bad value. */
    async function expectRejected(query: unknown, options: Record<string, unknown>, field: string, echoed?: string) {
      const { db, calls } = recordingDb();

      const error = await searchSublets(db, query as string, options as SearchSubletsOptions).then(
        () => { throw new Error('Expected searchSublets to reject.'); },
        (err: unknown) => err,
      );

      expect(error).toBeInstanceOf(SearchInputError);
      expect(error).toBeInstanceOf(RangeError);
      expect((error as SearchInputError).field).toBe(field);
      if (echoed) expect((error as Error).message).not.toContain(echoed);
      expect(calls).toHaveLength(0);
    }

    test('14. a query at the 256-character cap is accepted; surrounding whitespace is not counted', async () => {
      const atCap = `  ${'z'.repeat(MAX_SEARCH_LENGTH)}  `;

      await expect(searchSublets(client, atCap)).resolves.toEqual([]);
      expect(MAX_SEARCH_LENGTH).toBe(256);
    });

    test('14. a query over the cap is rejected (characters, not bytes: 256 emoji are fine, 257 are not)', async () => {
      await expect(searchSublets(client, '🏠'.repeat(MAX_SEARCH_LENGTH))).resolves.toEqual([]);
      await expectRejected('🏠'.repeat(MAX_SEARCH_LENGTH + 1), {}, 'query');
      await expectRejected('z'.repeat(MAX_SEARCH_LENGTH + 1), {}, 'query');
    });

    test.each([['loft\u0000'], ['loft\u0007bell'], ['\u001bloft'], ['loft\u007f']])(
      '15. control character in %p is rejected (NUL used to surface a raw Postgres 22021 error)',
      async (query) => {
        await expectRejected(query, {}, 'query');
      },
    );

    test('15. tab, newline and carriage return are ordinary whitespace, not rejected', async () => {
      const id = await insertListing('Zyzzyva Whitespace Studio');

      expect(await searchIds('zyzzyva\twhitespace\r\nstudio', { pageSize: 100 })).toContain(id);
    });

    test.each([
      [{ minRent: Number.NaN }, 'minRent'],
      [{ minRent: Number.POSITIVE_INFINITY }, 'minRent'],
      [{ minRent: -1 }, 'minRent'],
      [{ maxRent: '2000 OR 1=1' }, 'maxRent'],
      [{ minRent: '0; DROP TABLE sublets; --' }, 'minRent'],
    ])('16. invalid rent %p is rejected (used to be a raw 22P02 or silent zero rows)', async (options, field) => {
      await expectRejected('loft', options, field, String(Object.values(options)[0]));
    });

    test('16. a rent of 0 is a valid lower bound', async () => {
      const id = await insertListing('Zyzzyva Zero Rent Loft', { monthlyRent: 900 });

      expect(await searchIds('zyzzyva zero', { minRent: 0, pageSize: 100 })).toContain(id);
    });

    test('17. error messages never echo the caller\'s value', async () => {
      await expectRejected('loft', { page: '0; DROP TABLE sublets; --' }, 'page', 'DROP TABLE');
      await expectRejected('loft', { pageSize: 999 }, 'pageSize', '999');
    });

    test.each([[undefined], [null], [42], [{ toString: () => "'; DROP TABLE sublets; --" }]])(
      '18. a non-string query (%p) is rejected',
      async (query) => {
        await expectRejected(query, {}, 'query');
      },
    );
  });
});

describe('searchSublets term filters (quarters derived from dates, rules v2)', () => {
  // Pinned so results don't depend on the day the suite runs: Fall 2026 is
  // current. Selections that include Summer 2026 run on a summer date instead.
  const TODAY = '2026-10-27';
  const SUMMER_TODAY = '2026-07-15';

  // Z's decided examples (10/27/26), verified by an independent SQL computation.
  // Dates are [start, move-out].
  const LISTINGS: Record<string, [string, string]> = {
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
  const SELECTIONS: Record<string, string[]> = {
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
  const EXPECTED: Record<string, string[]> = {
    'Su26': ['F'],
    'F26': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'K'],
    'W27': ['B', 'C', 'I', 'J', 'K'],
    'Sp27': ['C', 'H', 'I', 'J', 'K'],
    'Su27': ['C', 'H', 'I', 'J', 'K'],
    'F27': ['I'],
    'Su26+F26': ['F'],
    'F26+W27': ['B', 'C', 'J', 'K'],
    'W27+Sp27': ['C', 'I', 'J', 'K'],
    'Sp27+Su27': ['C', 'H', 'I', 'J', 'K'],
    'F26..Sp27': ['C', 'J', 'K'],
    'F26..Su27': ['C', 'J', 'K'],
    'F26..F27': [],
    'Su27+F27': ['I'],
  };

  /** Inserts listings A–K (public, titled "Zyzzyva Term <name>"), returning name → id. */
  async function insertMatrix(): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const [name, dates] of Object.entries(LISTINGS)) {
      ids.set(name, await insertListing(`Zyzzyva Term ${name}`, { dates }));
    }
    return ids;
  }

  test.each(Object.keys(SELECTIONS))('selection %s returns exactly Z\'s expected listings', async (key) => {
    const ids = await insertMatrix();
    const nameOf = new Map([...ids].map(([name, id]) => [id, name]));
    const today = SELECTIONS[key].includes('summer-2026') ? SUMMER_TODAY : TODAY;

    const rows = await searchSublets(client, 'zyzzyva term', { terms: SELECTIONS[key], today, pageSize: 100 });

    expect(rows.map((row) => nameOf.get(row.id)).filter(Boolean).sort()).toEqual(EXPECTED[key]);
  });

  test('14-day minimum: 13 days into Winter does not cover it, 14 does', async () => {
    const thirteen = await insertListing('Zyzzyva Boundary', { dates: ['2026-10-01', '2026-12-26'] });
    const fourteen = await insertListing('Zyzzyva Boundary', { dates: ['2026-10-01', '2026-12-27'] });

    const ids = await searchIds('zyzzyva boundary', { terms: ['fall-2026', 'winter-2027'], today: TODAY, pageSize: 100 });

    expect(ids).toContain(fourteen);
    expect(ids).not.toContain(thirteen);
  });

  test('year-long window: move-out at anniversary + 7 drops Fall 2027, + 8 keeps it', async () => {
    const plusSeven = await insertListing('Zyzzyva Year', { dates: ['2026-09-20', '2027-09-27'] });
    const plusEight = await insertListing('Zyzzyva Year', { dates: ['2026-09-20', '2027-09-28'] });

    const ids = await searchIds('zyzzyva year', { terms: ['summer-2027', 'fall-2027'], today: TODAY, pageSize: 100 });

    expect(ids).toContain(plusEight);
    expect(ids).not.toContain(plusSeven);
  });

  test('year-long tie: equal days at both ends keeps the earlier Fall; one more day flips it', async () => {
    // Oct 23, 2026 start: 51 days of Fall 2026. Move-out Oct 22, 2027: 51 days of Fall 2027 (tie).
    const tie = await insertListing('Zyzzyva Tie', { dates: ['2026-10-23', '2027-10-22'] });
    const later = await insertListing('Zyzzyva Tie', { dates: ['2026-10-23', '2027-10-23'] });

    const fall2026 = await searchIds('zyzzyva tie', { terms: ['fall-2026'], today: TODAY, pageSize: 100 });
    const fall2027 = await searchIds('zyzzyva tie', { terms: ['fall-2027'], today: TODAY, pageSize: 100 });

    expect([fall2026.includes(tie), fall2027.includes(tie)]).toEqual([true, false]);
    expect([fall2026.includes(later), fall2027.includes(later)]).toEqual([false, true]);
  });

  test('authorization: a matching private listing is never returned', async () => {
    const hidden = await insertListing('Zyzzyva Private Term', { dates: LISTINGS.A, displayStatus: 'private' });

    expect(await searchIds('zyzzyva private', { terms: ['fall-2026'], today: TODAY, pageSize: 100 })).not.toContain(hidden);
  });

  test('combined with search text and rent: returns the intersection', async () => {
    const expected = await insertListing('Zyzzyva Combo', { dates: LISTINGS.B, monthlyRent: 1500 });
    const wrongTerms = await insertListing('Zyzzyva Combo', { dates: LISTINGS.A, monthlyRent: 1500 });
    const tooExpensive = await insertListing('Zyzzyva Combo', { dates: LISTINGS.B, monthlyRent: 2500 });
    const mine = new Set([expected, wrongTerms, tooExpensive]);

    const ids = await searchIds('zyzzyva combo', {
      terms: ['fall-2026', 'winter-2027'], minRent: 1000, maxRent: 2000, today: TODAY, pageSize: 100,
    });

    expect(ids.filter((id) => mine.has(id))).toEqual([expected]);
  });

  test('pagination with a term filter has no duplicate or skipped rows', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await insertListing('Zyzzyva Term Pages', { dates: LISTINGS.C }));

    const pages = [];
    for (const page of [1, 2, 3]) {
      pages.push(await searchIds('zyzzyva pages', { terms: ['fall-2026', 'winter-2027'], today: TODAY, page, pageSize: 2 }));
    }

    expect(pages.flat()).toEqual([...ids].sort());
  });

  test('term bounds are bound parameters; term ids and dates never appear in the SQL text', async () => {
    const { db, calls } = recordingDb();

    await searchSublets(db, '', { terms: ['fall-2026', 'winter-2027'], today: TODAY });

    const search = calls.find((call) => call.text.includes('public_sublets'))!;
    expect(search.text).toContain('lower(availability_date_range) <=');
    expect(search.text).toContain('upper(availability_date_range) >');
    expect(search.text).toContain("interval '1 year'");
    expect(search.text).not.toMatch(/fall-2026|winter-2027|2026-|2027-/);
    // The rule's numbers (14-day minimum, −14/+7 window, 351–375 nights) are bound too.
    expect(search.text).not.toMatch(/(?<![$0-9])(14|7|351|375)(?![0-9])/);
    // termSelectionBounds for Fall 2026 + Winter 2027, plus Fall 2027 and Winter 2026 for the year-long rule.
    expect(search.values).toEqual(expect.arrayContaining(['2026-11-29', '2026-12-27', 14, '2027-09-01', '2025-12-14']));
  });

  test('parity: searchSublets returns exactly what the shared rule matches, on boundary-packed and year-long listings', async () => {
    const terms = buildTermsForDate((await loadCalendarForParity()).rows.map(toCalendarYear), TODAY);
    const offered = offeredTerms(terms, TODAY);
    const iso = (base: string, days: number) => new Date(Date.parse(base) + days * 86_400_000).toISOString().slice(0, 10);
    const fixtures: [string, string][] = [];
    // Starts around each boundary of Fall 2026 / Winter 2027 / Spring 2027, short and quarter-long stays.
    for (const boundary of ['2026-09-01', '2026-12-13', '2027-03-21']) {
      for (const offset of [-15, -14, -13, -12, 12, 13, 14, 15]) {
        const start = iso(boundary, offset);
        for (const nights of [13, 14, 15, 95, 110]) fixtures.push([start, iso(start, nights)]);
      }
    }
    // Year-long leases: starts across Fall 2026, move-outs across the −14/+7 window and just outside it.
    for (const start of ['2026-09-20', '2026-10-23', '2026-11-30', '2026-12-20']) {
      for (const nights of [350, 351, 358, 365, 372, 373]) fixtures.push([start, iso(start, nights)]);
    }
    const datesOf = new Map<string, [string, string]>();
    for (const dates of fixtures) datesOf.set(await insertListing('Zyzzyva Parity', { dates }), dates);
    const runs = [
      ['fall-2026'], ['winter-2027'], ['spring-2027'], ['summer-2027'], ['fall-2027'], ['winter-2028'],
      ['fall-2026', 'winter-2027'], ['summer-2027', 'fall-2027'], ['fall-2027', 'winter-2028'],
      ['fall-2026', 'winter-2027', 'spring-2027', 'summer-2027'],
    ];

    for (const run of runs) {
      const selection = run.map((id) => offered.find((term) => term.id === id)!);
      const rows = await searchSublets(client, 'zyzzyva parity', { terms: run, today: TODAY, pageSize: 100 });
      const expected = [...datesOf].filter(([, [start, end]]) => matchesTermSelection(start, end, selection, terms)).map(([id]) => id);

      expect([run, rows.map((row) => row.id).sort()]).toEqual([run, expected.sort()]);
    }
  });

  test('rows carry the start and move-out dates, so callers can draw term badges', async () => {
    const id = await insertListing('Zyzzyva Dates', { dates: LISTINGS.A });

    const row = (await searchSublets(client, 'zyzzyva dates', { pageSize: 100 })).find((r) => r.id === id);

    expect(row).toMatchObject({ startDate: '2026-09-20', moveOutDate: '2026-12-18' });
  });

  test('the calendar is read once and cached, not on every filtered search', async () => {
    clearAcademicCalendarCache();
    const { db, calls } = recordingDb();

    await searchSublets(db, '', { terms: ['fall-2026'], today: TODAY });
    await searchSublets(db, '', { terms: ['winter-2027'], today: TODAY });

    expect(calls.filter((call) => call.text.includes('academic_calendar'))).toHaveLength(1);
  });

  describe('validation (rejected before the sublets query is sent)', () => {
    test('an impossible today (Feb 31, which Date.parse rolls to Mar 3) is rejected', async () => {
      const error = await searchSublets(client, '', { terms: ['fall-2026'], today: '2026-02-31' }).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(SearchInputError);
      expect((error as SearchInputError).field).toBe('today');
    });

    test.each([
      [Array.from({ length: 100_000 }, () => 'fall-2026'), 'longer than the offered list'],
      [['fall-2026', 'spring-2027'], 'gap'],
      [['fall-2025'], 'past term'],
      [['autumn-2026'], 'unknown id'],
      [["fall-2026'; DROP TABLE sublets; --"], 'injection-shaped id'],
      [[], 'empty'],
      ['fall-2026', 'not a list'],
    ])('%p (%s) → SearchInputError for terms', async (terms, _label) => {
      const { db, calls } = recordingDb();

      const error = await searchSublets(db, '', { terms: terms as string[], today: TODAY }).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(SearchInputError);
      expect((error as SearchInputError).field).toBe('terms');
      expect(calls.some((call) => call.text.includes('public_sublets'))).toBe(false);
    });
  });
});

describe('searchSublets: sort, place type and availability dates (every /browse filter)', () => {
  const TODAY = '2026-10-27';

  /** Sets created_at so newest-first order is deterministic. */
  async function setCreatedAt(id: string, iso: string) {
    await client.query(`UPDATE sublets SET created_at = $2 WHERE id = $1`, [id, iso]);
  }

  describe('sort', () => {
    test('asc / desc order by rent; an explicit price sort overrides relevance', async () => {
      const mid = await insertListing('Zyzzyva Price Zyzzyva', { monthlyRent: 1500 });
      const low = await insertListing('Zyzzyva Price', { monthlyRent: 1200 });
      const high = await insertListing('Zyzzyva Price', { monthlyRent: 1800 });

      expect(await searchIds('zyzzyva price', { sort: 'asc', pageSize: 100 })).toEqual([low, mid, high]);
      expect(await searchIds('zyzzyva price', { sort: 'desc', pageSize: 100 })).toEqual([high, mid, low]);
      // Without sort, relevance wins: "Zyzzyva Price Zyzzyva" ranks first.
      expect((await searchIds('zyzzyva price', { pageSize: 100 }))[0]).toBe(mid);
    });

    test('\'new\' orders newest first even when searching', async () => {
      const olderBetterMatch = await insertListing('Zyzzyva Fresh Zyzzyva');
      const newer = await insertListing('Zyzzyva Fresh');
      await setCreatedAt(olderBetterMatch, '2026-01-01T00:00:00Z');
      await setCreatedAt(newer, '2026-06-01T00:00:00Z');

      expect(await searchIds('zyzzyva fresh', { pageSize: 100 })).toEqual([olderBetterMatch, newer]);
      expect(await searchIds('zyzzyva fresh', { sort: 'new', pageSize: 100 })).toEqual([newer, olderBetterMatch]);
    });

    test.each([['asc'], ['desc']] as const)('tied rents page without overlap or gaps (%s)', async (sort) => {
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) ids.push(await insertListing('Zyzzyva Tied Rent', { monthlyRent: 1300 }));

      const pages = [
        await searchIds('zyzzyva tied', { sort, page: 1, pageSize: 2 }),
        await searchIds('zyzzyva tied', { sort, page: 2, pageSize: 2 }),
      ];

      const sorted = [...ids].sort();
      expect(pages.flat()).toEqual(sort === 'asc' ? sorted : sorted.reverse());
    });
  });

  describe('place type', () => {
    test('entire / private / none', async () => {
      const entire = await insertListing('Zyzzyva Place', { placeType: 'entire' });
      const room = await insertListing('Zyzzyva Place', { placeType: 'private' });

      expect(await searchIds('zyzzyva place', { placeType: 'entire', pageSize: 100 })).toEqual([entire]);
      expect(await searchIds('zyzzyva place', { placeType: 'private', pageSize: 100 })).toEqual([room]);
      expect((await searchIds('zyzzyva place', { pageSize: 100 })).sort()).toEqual([entire, room].sort());
    });
  });

  describe('availability dates (covers the whole requested stay)', () => {
    test.each([
      [['2027-01-01', '2027-03-31'], true, 'covers it with room to spare'],
      [['2027-01-10', '2027-03-15'], true, 'exactly the same dates'],
      [['2027-01-10', '2027-03-14'], false, 'moves out one day early'],
      [['2027-01-11', '2027-03-15'], false, 'moves in one day late'],
      [['2027-02-01', '2027-02-28'], false, 'only part of the stay'],
    ])('listing %p for a stay Jan 10 – Mar 15 → %p (%s)', async (dates, expected) => {
      const id = await insertListing('Zyzzyva Stay', { dates: dates as [string, string] });

      const ids = await searchIds('zyzzyva stay', { availableFrom: '2027-01-10', availableTo: '2027-03-15', pageSize: 100 });

      expect(ids.includes(id)).toBe(expected);
    });
  });

  describe('validation (rejected before the sublets query is sent)', () => {
    test.each([
      [{ sort: 'price' }, 'sort'],
      [{ sort: 'asc; DROP TABLE sublets; --' }, 'sort'],
      [{ sort: 'ASC' }, 'sort'],
      [{ placeType: 'shared' }, 'placeType'],
      [{ placeType: "entire' OR 1=1" }, 'placeType'],
      [{ placeType: 42 }, 'placeType'],
      [{ availableFrom: '2027-01-10' }, 'availableTo'],
      [{ availableTo: '2027-03-15' }, 'availableFrom'],
      [{ availableFrom: '2027-03-15', availableTo: '2027-03-15' }, 'availableTo'],
      [{ availableFrom: '2027-03-15', availableTo: '2027-01-10' }, 'availableTo'],
      [{ availableFrom: '2027-02-31', availableTo: '2027-03-15' }, 'availableFrom'],
      [{ availableFrom: "2027-01-10'; DROP TABLE sublets; --", availableTo: '2027-03-15' }, 'availableFrom'],
      [{ availableFrom: '2027-01-10', availableTo: '2029-01-12' }, 'availableTo'],
    ])('%p → SearchInputError(%s)', async (options, field) => {
      const { db, calls } = recordingDb();

      const error = await searchSublets(db, '', options as SearchSubletsOptions).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(SearchInputError);
      expect((error as SearchInputError).field).toBe(field);
      expect(calls).toHaveLength(0);
    });
  });

  test('full combination: search + rent + price sort + place type + quarters + dates + paging', async () => {
    const FILTERS: SearchSubletsOptions = {
      minRent: 1000,
      maxRent: 2000,
      sort: 'asc',
      placeType: 'private',
      terms: ['spring-2027', 'summer-2027'],
      availableFrom: '2027-03-25',
      availableTo: '2027-05-01',
      today: TODAY,
      pageSize: 2,
    };
    type Fixture = { title: string; rent: number; placeType: 'entire' | 'private'; dates: [string, string]; status?: 'public' | 'private' };
    const passing: Fixture = { title: 'Zyzzyva Combo Loft', rent: 0, placeType: 'private', dates: ['2027-03-01', '2027-08-15'] };
    const fixtures: Record<string, Fixture> = {
      pass1100: { ...passing, rent: 1100 },
      pass1400: { ...passing, rent: 1400 },
      pass1700: { ...passing, rent: 1700 },
      failTitle: { ...passing, rent: 1200, title: 'Quiet Studio Off Sheridan' },
      failRent: { ...passing, rent: 2500 },
      failPlaceType: { ...passing, rent: 1200, placeType: 'entire' },
      failQuarters: { ...passing, rent: 1200, dates: ['2027-03-01', '2027-06-20'] }, // 8 days of Summer
      failDates: { ...passing, rent: 1200, dates: ['2027-04-01', '2027-08-15'] }, // moves in after Mar 25
      failVisibility: { ...passing, rent: 1200, status: 'private' },
    };
    const idOf: Record<string, string> = {};
    for (const [name, f] of Object.entries(fixtures)) {
      idOf[name] = await insertListing(f.title, { monthlyRent: f.rent, placeType: f.placeType, dates: f.dates, displayStatus: f.status ?? 'public' });
    }

    const page1 = await searchSublets(client, 'zyzzyva combo', { ...FILTERS, page: 1 });
    const page2 = await searchSublets(client, 'zyzzyva combo', { ...FILTERS, page: 2 });

    expect(page1.map((row) => row.id)).toEqual([idOf.pass1100, idOf.pass1400]);
    expect(page2.map((row) => row.id)).toEqual([idOf.pass1700]);

    // Parity with the shared rules + plain checks on every non-text dimension.
    const terms = buildTermsForDate((await loadCalendarForParity()).rows.map(toCalendarYear), TODAY);
    const selection = FILTERS.terms!.map((id) => terms.find((term) => term.id === id)!);
    const expected = Object.entries(fixtures).filter(([, f]) =>
      f.title.startsWith('Zyzzyva Combo')
      && f.rent >= FILTERS.minRent! && f.rent <= FILTERS.maxRent!
      && f.placeType === FILTERS.placeType
      && matchesTermSelection(f.dates[0], f.dates[1], selection, terms)
      && f.dates[0] <= FILTERS.availableFrom! && f.dates[1] >= FILTERS.availableTo!
      && (f.status ?? 'public') === 'public',
    ).sort(([, a], [, b]) => a.rent - b.rent).map(([name]) => idOf[name]);
    expect([...page1, ...page2].map((row) => row.id)).toEqual(expected);
  });
});

/** Reads academic_calendar the way the repository does, for the parity test. */
function loadCalendarForParity() {
  return client.query<CalendarRow>(
    `SELECT academic_year, fall_exams_end::text, winter_exams_end::text, spring_exams_end::text
       FROM academic_calendar ORDER BY academic_year`,
  );
}

type CalendarRow = {
  academic_year: number;
  fall_exams_end: string | null;
  winter_exams_end: string | null;
  spring_exams_end: string | null;
};

/** Maps a calendar row to the shared AcademicCalendarYear shape. */
function toCalendarYear(row: CalendarRow): AcademicCalendarYear {
  return {
    academicYear: row.academic_year,
    fallExamsEnd: row.fall_exams_end,
    winterExamsEnd: row.winter_exams_end,
    springExamsEnd: row.spring_exams_end,
  };
}
