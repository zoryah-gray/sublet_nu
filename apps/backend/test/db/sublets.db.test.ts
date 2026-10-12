// First test against a real Postgres instead of mocks. Expects every migration
// in db/migrations/ to have been applied to DATABASE_URL already (CI runs
// `npm run migrate:up` before `npm test`). Each test runs inside a transaction
// that is rolled back, so nothing it inserts survives — safe against a local
// dev database too.
//
// Authorization-failure and illegal-transition cases (CLAUDE.md step 4) don't
// apply yet: there is no repository/session layer to scope queries by user,
// and this change touches no state-machine column.

import { Client, DatabaseError } from 'pg';

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

/** Inserts the minimum user + sublet rows the FKs require, returning their ids. */
async function insertOwnerAndSublet(overrides: { zipCode?: string; state?: string } = {}) {
  const owner = await client.query<{ id: string }>(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    ['Test Owner', 'test.owner@u.northwestern.edu'],
  );
  const ownerId = owner.rows[0].id;

  const sublet = await client.query<{ id: string }>(
    `INSERT INTO sublets (
       owner_id, title, street_address, city, state, zip_code, lat, lng,
       monthly_rent, bedroom_count, bathroom_count, start_date, end_date,
       description, roommate_count, monthly_utilities_cost
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id`,
    [
      ownerId,
      'Sunny Studio Near Campus',
      '1234 Hinman Ave',
      'Evanston',
      overrides.state ?? 'IL',
      overrides.zipCode ?? '60202',
      42.0399533,
      -87.6789093,
      1450,
      0,
      1.5,
      '2026-09-21',
      '2026-12-12',
      'Cozy studio five minutes from campus.',
      2,
      95,
    ],
  );
  return { ownerId, subletId: sublet.rows[0].id };
}

/** Runs a query expected to fail and returns the Postgres SQLSTATE code it failed with. */
async function sqlStateOf(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (err) {
    if (err instanceof DatabaseError) return err.code;
    throw err;
  }
  throw new Error('Expected the query to fail, but it succeeded.');
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
              s.monthly_utilities_cost, s.start_date::text AS start_date,
              s.display_status, s.is_draft,
              i.url AS image_url, i.position AS image_position, i.alt AS image_alt
         FROM sublets s
         JOIN sublet_images i ON i.sublet_id = s.id
        WHERE s.id = $1`,
      [subletId],
    );

    // node-pg returns numeric as a string (JS numbers can't hold every numeric
    // exactly) and smallint as a number; `date` is cast to text in the query
    // because node-pg would otherwise build a local-timezone JS Date from it.
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
        start_date: '2026-09-21',
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

  test('migrations renamed and dropped the ambiguous columns', async () => {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sublets'`,
    );
    const columns = result.rows.map((row) => row.column_name);

    expect(columns).toEqual(expect.arrayContaining([
      'street_address', 'city', 'state', 'zip_code', 'bedroom_count',
      'bathroom_count', 'monthly_rent', 'roommate_count', 'monthly_utilities_cost',
    ]));
    for (const old of ['address', 'neighborhood', 'beds', 'baths', 'price', 'roommates', 'utilities_cost']) {
      expect(columns).not.toContain(old);
    }
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
});
