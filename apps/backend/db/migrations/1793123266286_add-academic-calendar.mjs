// Northwestern Registrar exam dates for deriving academic terms from listing
// dates, plus planner statistics for the /browse term filter. Purely additive.
// Fall always starts Sep 1 (rules v2, ADR 7), so no Fall start is stored.
//
// Only the Registrar's published anchors are stored; term ranges and the
// matching rules live in packages/shared/src/terms.ts (buildTerms), which
// projects any missing anchor from the previous year + 1 year. searchSublets
// turns a term selection into plain date bounds (termSelectionBounds) and binds
// them as parameters, so the planner sees real values (report passes 5–6).
//
// Source: https://www.registrar.northwestern.edu/calendars/academic-calendars/
// (2025–26 from its archived PDF), fetched 10/27/26. Add the next academic
// year here each year; the guard test in test/db/sublets.db.test.ts fails when
// the next unentered Fall is under 6 months away.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';

    CREATE TABLE academic_calendar (
      academic_year    smallint PRIMARY KEY,   -- 2026 = the 2026–27 academic year
      fall_exams_end   date,                   -- NULL = not published yet (projected)
      winter_exams_end date,
      spring_exams_end date,
      -- Each exam date must fall in its usual months (Northwestern since at
      -- least 2025). The windows are disjoint and ordered, so they also imply
      -- fall < winter < spring; NULLs pass so a partial year can be entered.
      -- Spring exams by Jul 31 keeps Summer before the next Sep 1 Fall start.
      CONSTRAINT academic_calendar_windows CHECK (
        fall_exams_end BETWEEN make_date(academic_year, 11, 1) AND make_date(academic_year, 12, 31)
        AND winter_exams_end BETWEEN make_date(academic_year + 1, 2, 1) AND make_date(academic_year + 1, 4, 30)
        AND spring_exams_end BETWEEN make_date(academic_year + 1, 5, 1) AND make_date(academic_year + 1, 7, 31)
      )
    );

    INSERT INTO academic_calendar VALUES
      (2025, '2025-12-13', '2026-03-21', '2026-06-12'),
      (2026, '2026-12-12', '2027-03-20', '2027-06-11'),
      (2027, '2027-12-11', '2028-03-18', '2028-06-09'),
      (2028, '2028-12-09', NULL, NULL);

    -- The term filter compares lower()/upper() of availability_date_range
    -- against bounds. Postgres keeps no statistics on those expressions by
    -- default: without these, Fall 2026 + Winter 2027 was estimated at 2 rows
    -- against 159 actual and planned as a sequential scan (pass 6). With them
    -- the estimate is 120 and the newest-first page walks
    -- idx_sublets_public_created. Filled by ANALYZE / autovacuum like column
    -- statistics.
    CREATE STATISTICS sublets_availability_lower ON (lower(availability_date_range)) FROM sublets;
    CREATE STATISTICS sublets_availability_upper ON (upper(availability_date_range)) FROM sublets;

    -- Stay length in nights + 1. The year-long exclusion leads with a length
    -- range (351–375) so the planner, using these statistics, sees that it
    -- removes almost nothing. Statistics on the whole year-long expression were
    -- tried and never used: BETWEEN flattens into the surrounding AND, so the
    -- expression they were built on never appears as one clause (pass 6).
    CREATE STATISTICS sublets_availability_nights ON ((upper(availability_date_range) - lower(availability_date_range))) FROM sublets;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    DROP STATISTICS sublets_availability_nights;
    DROP STATISTICS sublets_availability_upper;
    DROP STATISTICS sublets_availability_lower;
    DROP TABLE academic_calendar;
  `);
};
