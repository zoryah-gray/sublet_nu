--  create a composite index on sublets(quarter, place_type, monthly_rent)
-- general query
-- EXPLAIN ANALYZE (
--     SELECT s.id, s.title, s.monthly_rent, s.place_type, s.start_date, s.end_date, sq.quarter
--     FROM sublets s
--     LEFT JOIN sublet_quarters sq ON sq.sublet_id = s.id
--     WHERE display_status = 'public'
-- );

-- get sublets where monthly rent is greater than 500
-- EXPLAIN ANALYZE (
--     SELECT id, title, monthly_rent
--     FROM sublets
--     WHERE monthly_rent >= 500
-- );

EXPLAIN ANALYZE (
    SELECT id, title, monthly_rent
    FROM sublets
    WHERE monthly_rent BETWEEN 500 AND 900
);


-- -- get sublets between date ranges - entire availability strictly contained within start to end
-- EXPLAIN ANALYZE (
--     SELECT id, title, start_date, end_date
--     FROM sublets
--     WHERE start_date <= '2027-01-01' AND end_date >= '2027-04-01'
-- );

-- -- after adding daterange column - answers does the listing rangr contain my search window
-- EXPLAIN ANALYZE (
--     SELECT id, title, availability_date_range
--     FROM sublets
--     WHERE availability_date_range @> '[2027-01-01, 2027-04-01]'::daterange
-- );


-- -- get sublets within a 1 mile radius of NU campus
-- EXPLAIN ANALYZE (
--     SELECT id, title, street_address, city, coordinates 
--     FROM sublets
--     WHERE ST_DWithin(
--         coordinates,
--         ST_SetSRID(ST_MakePoint(-87.681770, 42.049911), 4326), --NU address
--         1609.34  --1mi in meters
--     )
-- );

-- -- get sublets within a 5 mile radius of NU campus
-- -- point A = (-87.681770, 42.049911), point B = (-87.681770, 42.064373) — point B is almost exactly 1 mile due north of point A.
-- EXPLAIN ANALYZE (
--     SELECT id, title, street_address, city, coordinates  
--     FROM sublets
--     WHERE ST_DWithin(
--         coordinates,
--         ST_SetSRID(ST_MakePoint(-87.681770, 42.049911), 4326), --NU address
--         1609.34 * 5
--     )
-- );



-- -- search text
-- -- Titles and descriptions from a fixed vocabulary ("studio", "furnished", "near campus", "lakefront"…)


-- ------------------------------------------------------------------------------------
-- ----------------INDEXES-------------------------------------------------------------
-- ------------------------------------------------------------------------------------

-- -- implicit where
-- CREATE INDEX idx_sublets_place_rent ON sublets(place_type, monthly_rent) WHERE display_status='public';

-- --  gist index on start_date and end_date to handle ranges
-- -- CREATE INDEX idx_sublets_date_range ON sublets USING gist(availability_date_range) WHERE display_status='public';


-- -- for lat,lng enable extension postgis, create  a single column called coordinates,  move lat lng to coordinates, then drop lat lng.
-- -- assuming coord migration w/ extension creation already happened
-- -- CREATE INDEX idx_sublets_coord ON sublets USING gist(coordinates) WHERE display_status='public';

-- -- CREATE INDEX idx_sublets_qtrs ON sublet_quarters;
DROP INDEX IF EXISTS idx_sublets_place_rent;
-- DROP INDEX IF EXISTS idx_sublets_date_range;
-- DROP INDEX IF EXISTS idx_quarters;



