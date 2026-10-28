// Tests against a real Postgres instead of mocks. Expects every migration in
// db/migrations/ to have been applied to DATABASE_URL already (CI runs
// `npm run migrate:up` before `npm test`). Each test runs inside a transaction
// that is rolled back, so nothing it inserts survives — safe against a local
// dev database too.
//
// Authorization at this layer = what public_sublets exposes: no exact location
// columns, no non-public rows. Session-scoped authorization (owner / confirmed
// renter) belongs to the repository layer, which doesn't exist yet. No
// state-machine column is touched here, so there's no illegal transition to test.

import { Client, DatabaseError } from 'pg';
import { approximateCoords, formatApproximateStreet } from '@sublet-nu/shared';

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

type SubletOverrides = {
  zipCode?: string;
  state?: string;
  streetAddress?: string;
  /** Raw SQL expression for the coordinates column, e.g. "ST_Point(-87.68, 42.05, 4326)". */
  coordinatesSql?: string;
  /** daterange literal, e.g. '[2026-09-21,2026-12-12]'. */
  dateRange?: string;
  displayStatus?: 'public' | 'restricted' | 'private' | 'deleted';
};

/** Inserts the minimum user + sublet rows the FKs require, returning their ids. */
async function insertOwnerAndSublet(overrides: SubletOverrides = {}) {
  const owner = await client.query<{ id: string }>(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    ['Test Owner', `test.owner.${Math.random().toString(36).slice(2)}@u.northwestern.edu`],
  );
  const ownerId = owner.rows[0].id;

  // coordinatesSql is test-authored SQL (never user input), interpolated only so
  // geometry edge cases like POINT EMPTY can be expressed.
  const coordinatesSql = overrides.coordinatesSql ?? 'ST_Point(-87.6789093, 42.0399533, 4326)';
  const sublet = await client.query<{ id: string }>(
    `INSERT INTO sublets (
       owner_id, title, street_address, city, state, zip_code, coordinates,
       monthly_rent, bedroom_count, bathroom_count, availability_date_range,
       description, roommate_count, monthly_utilities_cost, display_status
     ) VALUES ($1, $2, $3, $4, $5, $6, ${coordinatesSql}, $7, $8, $9, $10::daterange, $11, $12, $13, $14)
     RETURNING id`,
    [
      ownerId,
      'Sunny Studio Near Campus',
      overrides.streetAddress ?? '1234 Hinman Ave',
      'Evanston',
      overrides.state ?? 'IL',
      overrides.zipCode ?? '60202',
      1450,
      0,
      1.5,
      overrides.dateRange ?? '[2026-09-21,2026-12-12]',
      'Cozy studio five minutes from campus.',
      2,
      95,
      overrides.displayStatus ?? 'private',
    ],
  );
  return { ownerId, subletId: sublet.rows[0].id };
}

/** Runs a query expected to fail and returns the Postgres SQLSTATE and constraint name it failed with. */
async function errorOf(query: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  try {
    await query;
  } catch (err) {
    if (err instanceof DatabaseError) return { code: err.code, constraint: err.constraint };
    throw err;
  }
  throw new Error('Expected the query to fail, but it succeeded.');
}

/** SQLSTATE only, for failures where the constraint name doesn't matter. */
async function sqlStateOf(query: Promise<unknown>): Promise<string | undefined> {
  return (await errorOf(query)).code;
}

describe('sublets + sublet_images against a migrated database', () => {
  test('happy path: inserted sublet and image read back with the migrated column shape', async () => {
    const { ownerId, subletId } = await insertOwnerAndSublet();
    await client.query(
      `INSERT INTO sublet_images (sublet_id, url, position, alt) VALUES ($1, $2, $3, $4)`,
      [subletId, 'https://example.com/studio-0.jpg', 0, 'Studio living area with a south-facing window'],
    );

    const result = await client.query(
      `SELECT s.id, s.owner_id, s.street_address, s.city, s.state, s.zip_code,
              s.monthly_rent, s.bedroom_count, s.bathroom_count, s.roommate_count,
              s.monthly_utilities_cost,
              s.availability_date_range::text AS availability_date_range,
              ST_AsText(s.coordinates) AS coordinates,
              s.display_status, s.is_draft,
              i.url AS image_url, i.position AS image_position, i.alt AS image_alt
         FROM sublets s
         JOIN sublet_images i ON i.sublet_id = s.id
        WHERE s.id = $1`,
      [subletId],
    );

    // node-pg returns numeric as a string (JS numbers can't hold every numeric
    // exactly) and smallint as a number. The range reads back canonically as
    // [start, end + 1): the inclusive '[2026-09-21,2026-12-12]' is stored as
    // '[2026-09-21,2026-12-13)'.
    expect(result.rows).toEqual([
      {
        id: subletId,
        owner_id: ownerId,
        street_address: '1234 Hinman Ave',
        city: 'Evanston',
        state: 'IL',
        zip_code: '60202',
        monthly_rent: '1450.00',
        bedroom_count: 0,
        bathroom_count: '1.5',
        roommate_count: 2,
        monthly_utilities_cost: '95.00',
        availability_date_range: '[2026-09-21,2026-12-13)',
        coordinates: 'POINT(-87.6789093 42.0399533)',
        display_status: 'private',
        is_draft: true,
        image_url: 'https://example.com/studio-0.jpg',
        image_position: 0,
        image_alt: 'Studio living area with a south-facing window',
      },
    ]);
  });

  test('sublet_images.alt is optional and reads back as null', async () => {
    const { subletId } = await insertOwnerAndSublet();
    const result = await client.query<{ alt: string | null }>(
      `INSERT INTO sublet_images (sublet_id, url, position) VALUES ($1, $2, $3) RETURNING alt`,
      [subletId, 'https://example.com/studio-0.jpg', 0],
    );
    expect(result.rows[0].alt).toBeNull();
  });

  test('migrations produced the current column set and removed the replaced ones', async () => {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sublets'`,
    );
    const columns = result.rows.map((row) => row.column_name);

    expect(columns).toEqual(expect.arrayContaining([
      'street_address', 'city', 'state', 'zip_code', 'bedroom_count',
      'bathroom_count', 'monthly_rent', 'roommate_count', 'monthly_utilities_cost',
      'coordinates', 'availability_date_range', 'approx_coordinates', 'approximate_street',
    ]));
    for (const old of [
      'address', 'neighborhood', 'beds', 'baths', 'price', 'roommates', 'utilities_cost',
      'lat', 'lng', 'start_date', 'end_date',
    ]) {
      expect(columns).not.toContain(old);
    }
  });

  test('price sort has its index: (monthly_rent, id) on public rows, serving asc and desc', async () => {
    const result = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_sublets_public_rent'`,
    );

    expect(result.rows.map((row) => row.indexdef)).toEqual([
      "CREATE INDEX idx_sublets_public_rent ON public.sublets USING btree (monthly_rent, id) WHERE (display_status = 'public'::text)",
    ]);
  });

  test('quarters are derived from dates: sublet_quarters and the quarter type are retired', async () => {
    const leftovers = await client.query(
      `SELECT 'table' AS kind FROM pg_class WHERE relname = 'sublet_quarters'
       UNION ALL
       SELECT 'type' FROM pg_type WHERE typname = 'quarter'`,
    );

    expect(leftovers.rows).toEqual([]);
  });

  describe('validation failures', () => {
    test('zip_code that is not 5 digits violates the CHECK constraint', async () => {
      expect(await sqlStateOf(insertOwnerAndSublet({ zipCode: '6020' }))).toBe('23514');
    });

    test('state that is not a 2-letter code violates the CHECK constraint', async () => {
      expect(await sqlStateOf(insertOwnerAndSublet({ state: 'Illinois' }))).toBe('23514');
    });

    test('two images at the same position on one sublet violate the UNIQUE constraint', async () => {
      const { subletId } = await insertOwnerAndSublet();
      const insertImage = `INSERT INTO sublet_images (sublet_id, url, position) VALUES ($1, $2, $3)`;
      await client.query(insertImage, [subletId, 'https://example.com/a.jpg', 0]);

      expect(await sqlStateOf(client.query(insertImage, [subletId, 'https://example.com/b.jpg', 0]))).toBe('23505');
    });

    test('an image for a sublet that does not exist violates the foreign key', async () => {
      const missingSubletId = '00000000-0000-0000-0000-000000000000';
      const insert = client.query(
        `INSERT INTO sublet_images (sublet_id, url, position) VALUES ($1, $2, $3)`,
        [missingSubletId, 'https://example.com/a.jpg', 0],
      );
      expect(await sqlStateOf(insert)).toBe('23503');
    });
  });

  describe('availability_date_range validity (sublets_availability_range_valid)', () => {
    const rangeConstraint = { code: '23514', constraint: 'sublets_availability_range_valid' };

    test('end_date equal to start_date is rejected (end must be after start)', async () => {
      expect(await errorOf(insertOwnerAndSublet({ dateRange: '[2027-01-01,2027-01-01]' }))).toEqual(rangeConstraint);
    });

    test('an empty range is rejected', async () => {
      expect(await errorOf(insertOwnerAndSublet({ dateRange: 'empty' }))).toEqual(rangeConstraint);
    });

    test('an unbounded range is rejected', async () => {
      expect(await errorOf(insertOwnerAndSublet({ dateRange: '[2027-01-01,)' }))).toEqual(rangeConstraint);
    });

    test('end before start never reaches the CHECK: the daterange cast itself fails', async () => {
      expect(await sqlStateOf(insertOwnerAndSublet({ dateRange: '[2027-05-01,2027-01-01]' }))).toBe('22000');
    });

    test('a one-night stay (end = start + 1) is accepted', async () => {
      await expect(insertOwnerAndSublet({ dateRange: '[2027-01-01,2027-01-02]' })).resolves.toBeDefined();
    });
  });

  describe('coordinates validity (sublets_coordinates_valid)', () => {
    const coordinatesConstraint = { code: '23514', constraint: 'sublets_coordinates_valid' };

    test('a point outside the Chicagoland service area is rejected', async () => {
      expect(await errorOf(insertOwnerAndSublet({ coordinatesSql: 'ST_Point(-87.68, 41.0, 4326)' }))).toEqual(coordinatesConstraint);
    });

    test('an out-of-range latitude is rejected even though geography silently wraps it (95 -> 85)', async () => {
      expect(await errorOf(insertOwnerAndSublet({ coordinatesSql: 'ST_Point(-87.68, 95, 4326)' }))).toEqual(coordinatesConstraint);
    });

    test('NaN coordinates are rejected', async () => {
      expect(await errorOf(insertOwnerAndSublet({ coordinatesSql: "ST_Point('NaN'::float8, 42.05, 4326)" }))).toEqual(coordinatesConstraint);
    });

    test('an empty point is rejected', async () => {
      expect(await errorOf(insertOwnerAndSublet({ coordinatesSql: "'POINT EMPTY'::geometry" }))).toEqual(coordinatesConstraint);
    });

    test('a non-point geometry is rejected by the column type itself', async () => {
      expect(await sqlStateOf(insertOwnerAndSublet({ coordinatesSql: "'SRID=4326;LINESTRING(-87.68 42.05,-87.67 42.06)'::geometry" }))).toBe('22023');
    });
  });
});

describe('academic_calendar (Registrar exam anchors; Fall starts Sep 1)', () => {
  type CalendarRow = [number, string | null, string | null, string | null];

  /** Inserts a calendar row far outside the seeded years, returning the rejected SQLSTATE and constraint. */
  function insertCalendarRow(row: CalendarRow) {
    return errorOf(client.query(
      `INSERT INTO academic_calendar (academic_year, fall_exams_end, winter_exams_end, spring_exams_end)
       VALUES ($1, $2, $3, $4)`,
      row,
    ));
  }

  test('Fall start is not stored (it is always Sep 1)', async () => {
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'academic_calendar' ORDER BY ordinal_position`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual(['academic_year', 'fall_exams_end', 'winter_exams_end', 'spring_exams_end']);
  });

  test.each([
    ['Fall exams in the wrong year', [2090, '2091-12-11', null, null]],
    ['Fall exams in September (before Fall would even start)', [2090, '2090-09-30', null, null]],
    ['Winter exams in the academic year\'s first calendar year', [2090, null, '2090-03-20', null]],
    ['Spring exams in December', [2090, null, null, '2091-12-01']],
    ['Spring exams after Aug 31 (Summer would invert)', [2090, null, null, '2091-09-15']],
  ])('%s is rejected by the per-anchor window CHECK (which also implies exam order)', async (_label, row) => {
    expect(await insertCalendarRow(row as CalendarRow)).toEqual({ code: '23514', constraint: 'academic_calendar_windows' });
  });

  test('a partially known year is accepted; missing anchors are projected by the shared rules', async () => {
    await client.query(`INSERT INTO academic_calendar (academic_year, fall_exams_end) VALUES (2090, '2090-12-10')`);
  });

  test('the term filter\'s expressions have planner statistics (start, move-out, nights)', async () => {
    const result = await client.query<{ stxname: string }>(
      `SELECT stxname FROM pg_statistic_ext WHERE stxname LIKE 'sublets_availability_%' ORDER BY stxname`,
    );

    expect(result.rows.map((row) => row.stxname)).toEqual([
      'sublets_availability_lower', 'sublets_availability_nights', 'sublets_availability_upper',
    ]);
  });

  test('guard: the next academic year missing any Registrar date starts more than 6 months from now', async () => {
    // Time-dependent on purpose: this is the yearly reminder to add the next
    // academic year's exam dates. Browse keeps working without them (dates are
    // projected from the previous year), so a failure here is a data chore.
    const result = await client.query<{ next_incomplete_fall: string }>(
      `SELECT make_date(min(y), 9, 1)::text AS next_incomplete_fall
         FROM generate_series((SELECT min(academic_year) FROM academic_calendar)::int, 2200) AS y
        WHERE NOT EXISTS (
          SELECT 1 FROM academic_calendar c
           WHERE c.academic_year = y AND c.fall_exams_end IS NOT NULL
             AND c.winter_exams_end IS NOT NULL AND c.spring_exams_end IS NOT NULL)`,
    );
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setUTCMonth(sixMonthsFromNow.getUTCMonth() + 6);

    expect(result.rows[0].next_incomplete_fall > sixMonthsFromNow.toISOString().slice(0, 10)).toBe(true);
  });
});

describe('public-safe columns derived by the database', () => {
  test('generated columns cannot be written directly', async () => {
    const { subletId } = await insertOwnerAndSublet();
    const write = client.query(`UPDATE sublets SET approximate_street = 'x' WHERE id = $1`, [subletId]);
    expect(await sqlStateOf(write)).toBe('428C9');
  });

  test('approximate_street matches the shared formatApproximateStreet rule', async () => {
    const streets = [
      '1234 Hinman Ave', '42 Main St', 'Sheridan Rd', '  567 Chicago Ave  ',
      '100 Sheridan Rd', '99 Elm St', '1200 Davis St', '2852 Orrington Ave',
    ];
    for (const street of streets) {
      const { subletId } = await insertOwnerAndSublet({ streetAddress: street });
      const result = await client.query<{ approximate_street: string }>(
        `SELECT approximate_street FROM sublets WHERE id = $1`,
        [subletId],
      );
      expect({ street, approximate: result.rows[0].approximate_street }).toEqual({ street, approximate: formatApproximateStreet(street) });
    }
  });

  test('approx_coordinates matches the shared approximateCoords rule, including grid-cell edges', async () => {
    const points = [
      { lat: 42.0399533, lng: -87.6789093 },
      { lat: 42.049911, lng: -87.68177 },
      { lat: 42.04, lng: -87.68 },
      { lat: 41.9, lng: -87.6 },
      { lat: 42.0565, lng: -87.6753 },
      { lat: 42.0005, lng: -87.9995 },
    ];
    for (const point of points) {
      const { subletId } = await insertOwnerAndSublet({ coordinatesSql: `ST_Point(${point.lng}, ${point.lat}, 4326)` });
      const result = await client.query<{ lat: number; lng: number }>(
        `SELECT ST_Y(approx_coordinates::geometry) AS lat, ST_X(approx_coordinates::geometry) AS lng FROM sublets WHERE id = $1`,
        [subletId],
      );
      expect({ point, approx: result.rows[0] }).toEqual({ point, approx: approximateCoords(point) });
    }
  });
});

describe('public_sublets view (authorization at the data layer)', () => {
  test('exposes no exact-location or internal columns', async () => {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'public_sublets'`,
    );
    const columns = result.rows.map((row) => row.column_name);

    expect(columns).toEqual(expect.arrayContaining(['approximate_street', 'approx_coordinates', 'availability_date_range']));
    for (const hidden of ['street_address', 'coordinates', 'confirmed_renter_id', 'deleted_at', 'is_draft', 'display_status']) {
      expect(columns).not.toContain(hidden);
    }
  });

  test('a public listing is visible with only its block-level street', async () => {
    const { subletId } = await insertOwnerAndSublet({ displayStatus: 'public' });
    const result = await client.query(
      `SELECT approximate_street FROM public_sublets WHERE id = $1`,
      [subletId],
    );
    expect(result.rows).toEqual([{ approximate_street: '1200 block of Hinman Ave' }]);
  });

  test('authorization failure: private, restricted and deleted listings are invisible through the view', async () => {
    for (const displayStatus of ['private', 'restricted', 'deleted'] as const) {
      const { subletId } = await insertOwnerAndSublet({ displayStatus });
      const result = await client.query(`SELECT id FROM public_sublets WHERE id = $1`, [subletId]);
      expect({ displayStatus, rows: result.rowCount }).toEqual({ displayStatus, rows: 0 });
    }
  });
});
