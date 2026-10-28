// Public-safe location columns, derived by the database, plus a public_sublets
// view that exposes only them. Privacy rule (.claude/docs/security-review.md):
// a listing's exact address is visible only to its owner and confirmed renter.
//
// Why in the DB, not only in the server layer: masking returned *values* can't
// mask what a query on exact data reveals — nearest-first order, distances
// (sub-meter accurate on exact points) and radius edges. Public queries read
// public_sublets, whose location columns are already approximate, so a
// repository method that forgets to mask fails safe. The server/actions layer
// still decides WHO gets the exact columns (owner / confirmed renter); the DB
// can't know the session user.
//
// The rules must match packages/shared (approximateCoords,
// formatApproximateStreet) exactly — the backend DB test asserts parity.
//   approx_coordinates: snap each axis to the center of its 0.001° cell
//     (~111 m × 83 m at 42°N): floor(v / 0.001) * 0.001 + 0.0005
//   approximate_street: "1234 Hinman Ave" -> "1200 block of Hinman Ave";
//     house numbers under 100 or no number -> the street name alone
//
// Stricter future option: column privileges — REVOKE SELECT (coordinates,
// street_address) from a dedicated public-browse role. Not now: the app has a
// single connection role.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.
// Regex classes are written [0-9] / [[:space:]] — \d inside a template literal
// silently becomes a literal d.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';

    ALTER TABLE sublets
      ADD COLUMN approx_coordinates geography(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(
          floor(ST_X(coordinates::geometry) / 0.001) * 0.001 + 0.0005,
          floor(ST_Y(coordinates::geometry) / 0.001) * 0.001 + 0.0005
        ), 4326)::geography
      ) STORED,
      ADD COLUMN approximate_street text GENERATED ALWAYS AS (
        CASE
          WHEN btrim(street_address) ~ '^[0-9]+[[:space:]]+.+$' THEN
            CASE
              WHEN floor(substring(btrim(street_address) FROM '^([0-9]+)')::numeric / 100) = 0
                THEN substring(btrim(street_address) FROM '^[0-9]+[[:space:]]+(.+)$')
              ELSE (floor(substring(btrim(street_address) FROM '^([0-9]+)')::numeric / 100) * 100)::text
                || ' block of ' || substring(btrim(street_address) FROM '^[0-9]+[[:space:]]+(.+)$')
            END
          ELSE btrim(street_address)
        END
      ) STORED;

    -- What any non-owner, non-confirmed-renter query may read. Its built-in
    -- display_status = 'public' lets the partial indexes match automatically.
    -- Excluded on purpose: street_address, coordinates, confirmed_renter_id,
    -- deleted_at, is_draft, display_status.
    CREATE VIEW public_sublets AS
      SELECT id, owner_id, title, approximate_street, city, state, zip_code,
             approx_coordinates, monthly_rent, bedroom_count, bathroom_count,
             availability_date_range, description, image_hue, place_type,
             roommate_count, utilities_included, monthly_utilities_cost,
             created_at, updated_at
      FROM sublets
      WHERE display_status = 'public';
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    DROP VIEW public_sublets;
    ALTER TABLE sublets
      DROP COLUMN approximate_street,
      DROP COLUMN approx_coordinates;
  `);
};
