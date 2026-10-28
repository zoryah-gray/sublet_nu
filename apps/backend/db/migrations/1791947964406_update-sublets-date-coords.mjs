// Replaces sublets.lat/lng with a PostGIS `coordinates` point and
// start_date/end_date with an `availability_date_range` daterange.
//
// One-step contract (add + backfill + drop in the same migration), not the
// five-step expand/contract in .claude/docs/migrations.md. Safe only while no
// deployed database exists and nothing reads these columns through SQL. This
// exception expires the moment an RDS instance serves live traffic.
//
// RDS: CREATE EXTENSION postgis requires rds_superuser. Locally the
// POSTGRES_USER is a real superuser, so this always passes here; on RDS the
// role running migrations must be the master user, or the extension must be
// pre-created. Tracked in TODO.md ("Revisit later").
//
// Validity: geography(POINT, 4326) only rejects wrong geometry types and SRIDs.
// Out-of-range lat/lng are silently WRAPPED (95°N is stored as 85°N), EMPTY and
// NaN are accepted. Hence the pre-flight check on the raw columns before
// conversion, and sublets_coordinates_valid (non-empty, inside the Chicagoland
// service area) on the converted point.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.
// Inside these template literals, write regex classes as [0-9] / [[:space:]]:
// \d would silently become a literal d.

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.sql(`
        SET LOCAL lock_timeout = '5s';

        -- Pre-flight: fail with a readable message (ids only, no addresses)
        -- before anything changes, instead of a constraint or constructor
        -- error halfway through the backfill. Same rules as the constraints below.
        DO $$
        DECLARE
            invalid_ids text;
        BEGIN
            SELECT string_agg(id::text, ', ') INTO invalid_ids
            FROM sublets
            WHERE end_date <= start_date
               OR lat NOT BETWEEN 41.6 AND 42.2
               OR lng NOT BETWEEN -88.0 AND -87.5;
            IF invalid_ids IS NOT NULL THEN
                RAISE EXCEPTION 'update-sublets-date-coords: invalid rows (end_date <= start_date, or lat/lng outside the service area): %', invalid_ids;
            END IF;
        END $$;

        CREATE EXTENSION IF NOT EXISTS postgis;

        -- The constraints are live from here, so the backfill UPDATE below is
        -- checked row by row (existing rows start NULL, which a CHECK passes).
        ALTER TABLE sublets
            ADD COLUMN coordinates geography(POINT, 4326),
            ADD COLUMN availability_date_range daterange,
            ADD CONSTRAINT sublets_availability_range_valid CHECK (
                NOT isempty(availability_date_range)
                AND NOT lower_inf(availability_date_range)
                AND NOT upper_inf(availability_date_range)
                -- canonical form is [start, end + 1): >= 2 days means end_date > start_date
                AND upper(availability_date_range) - lower(availability_date_range) >= 2
            ),
            ADD CONSTRAINT sublets_coordinates_valid CHECK (
                NOT ST_IsEmpty(coordinates::geometry)
                -- Chicagoland (Evanston + Chicago campus, with margin). Also rejects
                -- NaN, and catches wrapped out-of-range input the type let through.
                AND ST_Y(coordinates::geometry) BETWEEN 41.6 AND 42.2
                AND ST_X(coordinates::geometry) BETWEEN -88.0 AND -87.5
            );
        UPDATE sublets SET
            availability_date_range = daterange(start_date, end_date, '[]'),
            coordinates = ST_POINT(lng, lat, 4326);
        ALTER TABLE sublets
            ALTER COLUMN coordinates SET NOT NULL,
            ALTER COLUMN availability_date_range SET NOT NULL,
            DROP COLUMN lng,
            DROP COLUMN lat,
            DROP COLUMN start_date,
            DROP COLUMN end_date;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // The constraints drop with their columns. They also guarantee every range
    // is bounded and non-empty, so upper(...) - 1 and SET NOT NULL can't fail.
    // PostGIS stays installed: dropping an extension other objects may depend
    // on is riskier than leaving it.
    pgm.sql(`
        SET LOCAL lock_timeout = '5s';
        ALTER TABLE sublets
            ADD COLUMN lat double precision,
            ADD COLUMN lng double precision,
            ADD COLUMN start_date date,
            ADD COLUMN end_date date;
        UPDATE sublets SET
            start_date = lower(availability_date_range),
            end_date = upper(availability_date_range) - 1,
            lng = ST_X(coordinates::geometry),
            lat = ST_Y(coordinates::geometry);
        ALTER TABLE sublets
            ALTER COLUMN lat SET NOT NULL,
            ALTER COLUMN lng SET NOT NULL,
            ALTER COLUMN start_date SET NOT NULL,
            ALTER COLUMN end_date SET NOT NULL,
            DROP COLUMN coordinates,
            DROP COLUMN availability_date_range;
    `);
};
