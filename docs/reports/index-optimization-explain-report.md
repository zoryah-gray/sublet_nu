# Index optimization — EXPLAIN ANALYZE report (Day 4, measurement pass)

\*Date: **10.18.26**

Validation evidence for Z's /browse index set. Nothing here is a final index decision; no index was kept. Raw output: `apps/backend/db/explain/` (local-only via `.git/info/exclude`).

## Setup (so the numbers can be trusted, and where they can't)

- **Where:** an isolated scratch compose project (`day4explain`, `postgis/postgis:17-3.5-alpine`, host port 55432). Z's local `sublet_nu` database was not touched, and Z's migration ran only in the scratch DB.
- **Data:** `seed-browse.sql`, `rows=5000`. Confirmed before any plan was trusted: `pg_stat_user_tables.last_analyze` set on `sublets`, `sublet_quarters` and `users`; `reltuples=5000`, 192 heap pages; `pg_stats` populated.
- **Order:** Day 3 migrations (4) → seed → tests 1–2 on the old schema → Z's migration `1791947964406` (adds `coordinates geography(POINT,4326)` + `availability_date_range daterange`, backfills, drops lat/lng/start/end) → `VACUUM FULL ANALYZE sublets` → tests 3–4. The vacuum matters: the backfill `UPDATE` left 5,000 dead tuples (409 pages). Without it, the new-schema timings would have been measured on a bloated table with no statistics for the new columns. After it: 199 pages, stats present, 0 nulls.
- **Isolation:** one index per pass, created → measured → dropped. Every output file records the index list before, after and after teardown. Only the baseline indexes (`sublets_pkey`, `sublets_owner_id_idx`, `sublets_display_status_idx`) exist between passes.
- **Timing:** 1 warm-up run (discarded) + 3 measured runs per query; the **median** is reported. The image is amd64-only, so it runs **under Rosetta emulation on the M1**: trust plan shapes and relative changes, not absolute ms.
- **Fixes the brief asked for:** no stray semicolon-before-`)` exists in the current `queries.sql` (already fixed). The two date queries are already containment-equivalent, which I verified: both return **87 rows (63 public)**. The ST_DWithin queries were run verbatim.
- **DIAGNOSTIC rows** are queries I added only to test a hypothesis (e.g. adding the partial index's predicate). They are labeled, they are not proposals, and Z's queries were measured as written.

## Geography sanity check (run before any spatial timing) — PASSED

Point A `(-87.681770, 42.049911)` and point B `(-87.681770, 42.064373)`: B is stored the way the migration stores it, and A is written exactly as in `queries.sql`. `ST_Distance` = **1606.36 m**, the spheroidal distance ("~1609 m" is the nominal mile). `ST_DWithin(…, 1609.34)` = true, `(…, 1600)` = false. **Not** ~0.0145: the planar-geometry contrast gives 0.014462. `EXPLAIN VERBOSE` shows why: the `ST_SetSRID(...)` geometry argument is implicitly cast to `geography`, and the 4-argument spheroid `st_dwithin(..., true)` overload resolves. → `00-geography-sanity-check.txt`

## Results

Plan types are as they appear in the run-3 plan. Timings are medians of 3 runs.

### 1. Composite `(place_type, monthly_rent) WHERE display_status='public'` → `01-rent-composite.*`

| Query                                                            | Before   | After                                                           | Before ms | After ms | Root cause                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | -------- | --------------------------------------------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z: `WHERE monthly_rent BETWEEN 500 AND 900`                      | Seq Scan | Seq Scan                                                        | 9.48      | 9.80     | **Failed to use the index.** A partial index is only usable when the query's WHERE clause implies the index predicate. This query has no `display_status = 'public'` and no equality on the leading column `place_type`, so the planner can't consider it. |
| DIAGNOSTIC: + `display_status='public' AND place_type='private'` | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_place_rent`) | 12.10     | 2.69     | Worked as designed: equality on the leading column plus a range on the second (`Index Cond: place_type = 'private' AND monthly_rent >= 500 AND <= 900`), with the partial predicate matched.                                                               |

### 2. Old two-column dates (`start_date <= '2027-01-01' AND end_date >= '2027-04-01'`), three isolated index variants

| Query                                                                                            | Before   | After                                                            | Before ms | After ms | Root cause                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2a** Z: two-column, index `gist(start_date, end_date) WHERE public` **as written**             | Seq Scan | Seq Scan                                                         | 4.96      | 5.40     | **Index never created.** `ERROR: data type date has no default operator class for access method "gist"`. Plain dates have no GiST opclass without `btree_gist`. It's a hard failure, not a silent fallback, so in a migration it would abort the transaction. |
| 2a DIAGNOSTIC: + `display_status='public'`                                                       | Seq Scan | Seq Scan                                                         | 6.39      | 6.00     | Same: there was no index to use.                                                                                                                                                                                                                              |
| **2b** Z: two-column, same index with `btree_gist` enabled                                       | Seq Scan | Seq Scan                                                         | 5.33      | 5.75     | **Created, but unused:** the query has no `display_status='public'`, so the partial predicate isn't implied.                                                                                                                                                  |
| 2b DIAGNOSTIC: + `display_status='public'`                                                       | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_date_range`)  | 6.32      | 1.09     | Worked: `btree_gist` supplies `<=`/`>=` GiST opclasses for `date`, and both bounds became an Index Cond.                                                                                                                                                      |
| **2c** Z: two-column, **btree baseline** `(start_date, end_date) WHERE public` (comparison only) | Seq Scan | Seq Scan                                                         | 5.28      | 4.96     | Unused: same missing partial predicate.                                                                                                                                                                                                                       |
| 2c DIAGNOSTIC: + `display_status='public'`                                                       | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_dates_btree`) | 6.17      | **0.67** | Worked: a range scan on `start_date`, with `end_date` checked inside the index. Cheapest variant at this size.                                                                                                                                                |

### 3. New `availability_date_range` + `gist(availability_date_range) WHERE public` → `03-daterange-gist.*`

| Query                                                                 | Before   | After                                                           | Before ms | After ms | Root cause                                                                                                                                                 |
| --------------------------------------------------------------------- | -------- | --------------------------------------------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z: `availability_date_range @> '[2027-01-01, 2027-04-01]'::daterange` | Seq Scan | Seq Scan                                                        | 12.70     | 12.71    | **Failed to use the index:** the same missing `display_status='public'` predicate as tests 1 and 2.                                                        |
| DIAGNOSTIC: + `display_status='public'`                               | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_date_range`) | 12.93     | 2.18     | Worked: `daterange` has a native GiST opclass, and `@>` became an Index Cond (`@> '[2027-01-01,2027-04-02)'`, the canonical form of the inclusive window). |

**Old vs new, side by side** (same 63 public rows):

| Approach   | Index                          | Seq-scan ms | Indexed ms             | Row estimate (est/actual) |
| ---------- | ------------------------------ | ----------- | ---------------------- | ------------------------- |
| two-column | `gist(start,end)` as written   | 6.39        | **n/a (create fails)** | 370/63                    |
| two-column | `gist(start,end)` + btree_gist | 6.32        | 1.09                   | 370/63                    |
| two-column | btree `(start,end)`            | 6.17        | **0.67**               | 370/63                    |
| daterange  | `gist(range)`                  | 12.93       | 2.18                   | **52/63**                 |

### 4. `gist(coordinates)` (not partial) → `04-coordinates-gist.*`, `04b-…`

| Query                                         | Before   | After                                                      | Before ms | After ms  | Root cause                                                                                                                                                                                                                                                    |
| --------------------------------------------- | -------- | ---------------------------------------------------------- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z: within 1 mile (`ST_DWithin(..., 1609.34)`) | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_coord`) | 139.60    | 123.20    | **Index used, but only ~12% faster.** The radius matches **3,488 of 5,000 rows (69.8%)**, so the index prunes little, and the per-row geodesic recheck dominates (`Index Cond: coordinates && _st_expand(...)`, then 1,032 rows removed by the exact filter). |
| Z: within 5 miles (`1609.34 * 5`)             | Seq Scan | Seq Scan                                                   | 71.65     | 68.77     | **Correctly not used:** the radius matches **100%** of rows, and the planner rightly prefers a sequential scan to an index that would return the whole table.                                                                                                 |
| DIAGNOSTIC: within 400 m (5.6% of rows)       | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_coord`) | 252.68    | **18.04** | Worked as designed: with a selective radius the bounding-box index pruning eliminates ~90% of rows before the expensive geodesic check, about 14× faster.                                                                                                     |

## Flags for discussion (for Z to reason through, not resolved here)

1. **Composite (test 1) didn't improve Z's query, and neither did the daterange GiST (test 3).** Same root cause for both: the partial `WHERE display_status='public'` predicate isn't in the query, so Postgres can't prove the query only needs public rows. The rent query also lacks equality on the leading column `place_type`. Open question: are these the queries `/browse` will actually issue, or will the real browse query always carry `display_status='public'` (and `place_type` when that filter is set)?
2. **At 5k rows the new daterange GiST was slower than the old two-column btree** (2.18 vs 0.67 ms indexed; 12.9 vs 6.2 ms seq scan). Best read: GiST range probes cost more than a btree range scan, the per-row `@>` check costs more than two date comparisons, and absolute differences under emulation at this size are small. Where daterange did measurably better is **row estimation**: 52 estimated vs 63 actual, against 370 vs 63 for the two-column form. The planner assumes `start_date` and `end_date` are independent, which overestimates 6×, and that matters once these predicates join with other tables. Overlap (`&&`) queries, the other case where range types usually win, were not measured.
3. **Z's commented two-column GiST definition can't be created** without `btree_gist` (2a). It's moot if the daterange design stands; noted because it settles the "fail or silent fallback" question: it fails loudly.
4. **The spatial index helps only when the radius is selective.** The seed clusters listings around campus (~72% within ~1.5 km), as real Northwestern sublets would be, so a 1-mile "near campus" filter matches ~70% of rows and the index barely helps. Worth deciding whether the /browse proximity filter will ever be selective enough at real data sizes to justify the index's write and storage cost, or whether it pays off mainly for KNN (`ORDER BY coordinates <-> point`), which wasn't measured.
5. **Spatial row estimates are badly off:** the top node estimates **1 row** in every spatial plan, against 3,488 / 5,000 / 282 actual. The bitmap index scan's own estimate is reasonable (4,517 for 1 mi), so the 1-row figure comes from how the exact `ST_DWithin` filter's selectivity is estimated. Harmless for a single-table scan; risky once this filter is joined to `sublet_quarters`, because the planner may choose a nested loop believing only one row comes back.
6. **Observation, unexplained:** the spatial seq scan was _slower_ at 400 m (252 ms) than at 1 mi (140 ms) or 5 mi (72 ms). Best read: the exact geodesic check costs more for points _outside_ the radius than inside (inside points can short-circuit), and the 400 m query has the most outside points. Not verified.

### Noticed while running (outside the three checkpoints; flagged, not fixed)

7. **Migration `down()` swaps lat and lng:** `lat = ST_X(coordinates::geometry)`, `lng = ST_Y(...)`. `ST_X` is longitude. Rolling back would write longitudes into `lat` and latitudes into `lng`. (`down` was not run.)
8. **The spatial queries select raw `coordinates`.** That's fine as an EXPLAIN exercise, but a browse response built this way would carry exact points for every listing, bypassing the privacy masking (`toPublicSublet` / `approximateCoords` in `apps/frontend/app/lib/util-address.ts`, applied in the browse Server Component). The equivalent masking will have to happen in the repository-layer SQL.
9. **The migration drops `lat`/`lng`/`start_date`/`end_date` in the same step that adds the replacements.** That's safe only while no deployed reader exists (same reasoning as Day 3). The scratch DB had 5k fixture rows and the backfill was exercised on them; Z's local DB had 0 tables when last checked. `schema.sql` isn't updated for this migration yet.

## Not measured in this pass

`idx_quarters ON sublet_quarters(quarter)` (no query in the battery exercises it), the existing `display_status` partial index on its own (present in every pass as a baseline), KNN ordering, overlap (`&&`) range queries, and 50k-row behavior (`-v rows=50000` would move the seq-scan/index crossover points).

## Results — pass 2: realistic and combined queries

Source: `apps/backend/db/queries_realistic.sql` (Z), 10 queries, all with `display_status = 'public'` as a fixed baseline. Queries were extracted verbatim from the file.

**State check before running.** I didn't trust the leftover pass-1 state (the migration file had changed since pass 1, and the scratch DB had had extensions and indexes created and dropped), so the scratch DB was **rebuilt from scratch**: fresh volume → Day 3 migrations → seed `rows=5000` → old-schema containment check (87 rows / 63 public) → Z's current migration → `VACUUM FULL ANALYZE sublets` + `ANALYZE sublet_quarters`. Verified identical to pass 1: status counts 3413/792/526/269, 199 heap pages, stats present on `coordinates` and `availability_date_range`, 0 nulls, new containment query 87/63, only baseline indexes, `postgis 3.5.7`, no `btree_gist`. (My first attempt bundled `VACUUM` with another statement in one call; Postgres rejected it with "VACUUM cannot run inside a transaction block". The check caught that before any measurement, and I re-ran it alone.)

**Methodology:** same harness as pass 1 (1 warm-up + 3 measured runs, median), with index lists now covering `sublets` and `sublet_quarters`. Queries 1–4 and 7–10 are single-index passes (create one, measure, drop). Queries 5 and 6 are **combined** passes: every listed index is created before the AFTER measurement and all are dropped together. Index definitions are Z's: `idx_sublets_place_rent (place_type, monthly_rent) WHERE display_status='public'`, `idx_sublets_date_range gist(availability_date_range) WHERE display_status='public'`, `idx_quarters ON sublet_quarters(quarter)`, `idx_sublets_coord gist(coordinates)`.

### Single-index passes

| Query | Before | After | Before ms | After ms | Root cause |
|---|---|---|---|---|---|
| **Q1** public + `place_type='private'` + rent 500–900 (`idx_sublets_place_rent`) → `05-…` | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_place_rent`) | 11.02 | 2.81 | Worked: the partial predicate is implied, with equality on the leading column and a range on the second (`Index Cond: place_type = 'private' AND monthly_rent >= 500 AND <= 900`). 573 rows (est. 325). |
| **Q2** public + `@> '[2027-01-01,2027-04-01]'` (`idx_sublets_date_range`) → `06-…` | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_date_range`) | 11.71 | 1.94 | Worked: with `display_status='public'` present, the partial GiST is usable, and the native `daterange` opclass serves `@>` as an Index Cond. 63 rows (est. 52). |
| **Q3** public + `&& '[2027-01-01,2027-04-01]'` overlap (`idx_sublets_date_range`) → `07-…` | Seq Scan | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_date_range`) | 13.95 | 8.77 | Used, but only ~37% faster. Overlap is unselective (904 rows, 26% of public), and the bitmap still touched **every** heap page (`Heap Blocks: exact=199`), so the index only saves the per-row range test on non-matches. Estimate was excellent (916/904). |
| **Q4** public + `EXISTS` quarter ∈ {Winter, Spring} (`idx_quarters`) → `08-…` | Hash Semi Join (Seq Scan sublets + Seq Scan sublet_quarters) | Hash Semi Join (Seq Scan sublets + Bitmap Index Scan `idx_quarters`) | 29.42 | 27.03 | Used only to build the hash side, and gave ~8%. The quarter filter matches 3,280 of 7,125 quarter rows (46%), and all 3,413 public sublets must be scanned for the join anyway, so the join, not the quarter lookup, dominates. 1,920 rows returned once each (the semi-join de-duplicates as the query comment intended). |
| **Q7** public + rent only (`idx_sublets_place_rent`) → `11-…` | Seq Scan | Seq Scan | 10.85 | 12.89 | Not used, as `queries_realistic.sql` predicted. With no equality on the leading `place_type`, the btree can't *seek* to the rent range; the planner priced a full scan of the index as worse than a seq scan here. (Contrast Q6, where it did choose that full scan.) |
| **Q8** public + `place_type='private'` only (`idx_sublets_place_rent`) → `12-…` | Seq Scan | Seq Scan | 10.62 | 11.39 | **Not used, contrary to the file's expectation** ("SHOULD still be able to use"). The index *is* usable (leading-column equality), but the predicate matches 1,835 of 5,000 rows (37%), and at that selectivity a seq scan is cheaper. The cause is selectivity, not the leading-column rule. |
| **Q9** public + within 1 mi (`idx_sublets_coord`) → `13-…` | Index Scan using `sublets_display_status_idx` | Bitmap Heap Scan over **BitmapAnd** (`sublets_display_status_idx`, `idx_sublets_coord`) | 94.47 | 83.56 | Used, ~12% faster, the same story as pass 1 test 4. The radius matches 2,396 of 3,413 public rows, so the bounding-box bitmap prunes little and the per-row geodesic recheck dominates. New: the planner ANDed the coordinate index with the dedicated `display_status` partial index (see flag 13). |
| **Q10** KNN: public, `ORDER BY coordinates <-> point LIMIT 20` (`idx_sublets_coord`) → `14-…` | Limit → Sort (top-N heapsort) → Seq Scan | Limit → **Index Scan using `idx_sublets_coord`, `Order By: (coordinates <-> …)`** | 55.85 | 3.20 | **Index confirmed used for the ORDER BY.** The plan shows `Order By` on the index scan itself, not a Sort node. GiST walks nearest-first and stops after 20 matches (8 non-public rows filtered on the way), instead of computing the distance to all 3,413 public rows and sorting. ~17× faster. |

### Combined passes (multiple indexes live at once — new in pass 2)

| Query | Indexes live | Before | After | Before ms | After ms | Root cause |
|---|---|---|---|---|---|---|
| **Q5** kitchen sink: public + private + rent 500–900 + `@>` window + `EXISTS` quarter → `09-…` | `idx_sublets_place_rent`, `idx_sublets_date_range`, `idx_quarters` | Nested Loop Semi Join (Seq Scan sublets; Index Only Scan `sublet_quarters_pkey`) | Nested Loop Semi Join (Bitmap Heap Scan via **only** `idx_sublets_date_range`, with rent/place_type as Filter; Index Only Scan `sublet_quarters_pkey`) | 17.81 | 2.37 | ~7.5× faster, from **one** of the three indexes. The date index alone narrows to 63 rows, and filtering those for rent/place_type (56 removed) was costed cheaper than a BitmapAnd with the 573-entry rent bitmap. `idx_quarters` was **ignored entirely**: for 7 outer rows, the semi-join probes `sublet_quarters_pkey (sublet_id, quarter)` directly (index-only, 0 heap fetches). 7 rows (est. 3). |
| **Q6** public + rent 500–900 + within 1 mi → `10-…` | `idx_sublets_place_rent`, `idx_sublets_coord` | Index Scan using `sublets_display_status_idx` | Bitmap Heap Scan over **BitmapAnd** (`idx_sublets_place_rent` with **rent-only** Index Cond, `idx_sublets_coord`) | 25.78 | 25.76 | **No improvement**, even though both indexes were used. The BitmapAnd itself cost ~10.6 ms (the coordinate bitmap returns 4,520 of 5,000 entries), and the remaining 534 rows still needed the geodesic recheck (125 removed), ending where the baseline started. The composite was scanned **without** a leading-column equality (see flag 11). 409 rows (est. **1**). |

## Flags for discussion — continued (pass 2)

10. **Q5: three indexes live, the planner used one.** It chose `idx_sublets_date_range`, applied rent/place_type as a heap Filter instead of BitmapAnd-ing `idx_sublets_place_rent`, and used `sublet_quarters_pkey` instead of `idx_quarters`. Best read: once the date predicate cuts to 63 rows, any additional bitmap costs more than it saves, and the PK's `(sublet_id, quarter)` order is a better fit than `idx_quarters (quarter)` for "does *this* sublet have one of these quarters". The open question is the one this pattern exists to expose: in the deployed state, `idx_sublets_place_rent` and `idx_quarters` contributed nothing to the most-filtered query. Their value rests on queries where *they* are the most selective filter (Q1 for place_rent; nothing measured yet for `idx_quarters`).
11. **Q6: the composite was used without its leading column**, `Index Cond: (monthly_rent >= 500 AND monthly_rent <= 900)` with no `place_type`, as a full scan of the partial index feeding a BitmapAnd. So "the composite can't be used without the leading column" (the reasoning in Q7's comment) holds for *seeking*, not for *use*. In Q7, the same index without a spatial partner wasn't chosen at all, so the decision is cost-based, not a hard rule. And the BitmapAnd bought nothing (25.78 → 25.76 ms).
12. **Q8 contradicts its comment's expectation.** Leading-column equality makes the index eligible, but 37% selectivity makes a seq scan cheaper. Minor: the Q8 comment says "the other direction of #8" and "contrast against #8", which presumably means #7.
13. **The dedicated `display_status` partial index appears in plans for the first time**: Q6/Q9 before (as the scan that enumerates public rows) and Q9 after (inside a BitmapAnd with the coordinate index). Pass 1 never showed it. Best read, unverified: it appears only alongside spatial predicates, whose rows are estimated at **1** (flag 5), and that misestimate makes plans that touch "few" rows look cheap.
14. **Overlap (`&&`) was measured for the daterange design only** (Q3: 13.95 → 8.77 ms, estimate 916/904). There was no matching two-column overlap query, so pass 1's "range types usually win on overlap" is still unverified against the btree baseline.
15. **KNN exposes exact location via `distance_m`.** Q10 returns `coordinates <-> point` computed from the precise coordinates. The KNN precision check (`14-q10-knn.precision-check.txt`) shows sub-meter accuracy: the same top-20 set as spheroid `ST_Distance`, 18 of 20 in identical positions, at most **0.27 m** difference. Distances from a few known points are enough to triangulate a listing's exact position even if `coordinates` is never returned, so the masking flagged in pass-1 flag 8 would also have to cover distances, and arguably the ordering itself.
16. **Spatial row estimates are still wrong in combined plans:** est. 1 vs 409 (Q6) and 1 vs 2,396 (Q9). The pass-1 worry (flag 5) was that this would push a join into a nested loop. Pass 2 had no query combining a spatial filter with a join, so that's still unshown either way.

## Results — pass 3: foreign-key and default-sort indexes

Tests the three candidates that had only been reasoned about: an index on the unindexed foreign key `sublets.confirmed_renter_id`, one on `match_requests.sublet_id` (only a partial pending-only index existed), and replacing `sublets_display_status_idx` with `(created_at DESC) WHERE display_status = 'public'`.

**State:**
- The scratchpad (including the harness) was wiped during the Docker outage. The harness was recreated with identical methodology (1 warm-up + 3 runs, median; index lists now cover `sublets`, `sublet_quarters`, `match_requests`, `users`).
- The scratch DB was **rebuilt from scratch**: Day 3 migrations → seed `rows=5000` → Z's migration `1791947964406` (unchanged at the time) → `VACUUM FULL ANALYZE sublets`. Same state as passes 1–2: 3413/792/526/269, 199 pages, 526 rows with `confirmed_renter_id`.
- **New scratch-only fixture** (not in the repo): 11,788 `match_requests` over 3,939 public/restricted listings, ≤3 per listing from distinct requesters. Statuses: pending 4,743 · accepted 2,379 · declined 2,285 · cancelled 1,788 · confirmed 593. Then `VACUUM ANALYZE`, so index-only scans see a current visibility map.
- Lookups use literal ids (a renter with 5 confirmed listings; a listing with 3 requests).
- The purge measurements insert unreferenced rows and delete them **inside a transaction that is always rolled back**. "FK trigger" is Postgres's own `Trigger for constraint …: time=` line from `EXPLAIN ANALYZE DELETE`: the time spent checking that no row still references what's being deleted.

### `sublets(confirmed_renter_id) WHERE confirmed_renter_id IS NOT NULL` → `15-…`

| Query | Before | After | Before ms | After ms | Root cause |
|---|---|---|---|---|---|
| Renter lookup: `WHERE confirmed_renter_id = <user>` (5 rows) | Seq Scan (4,995 removed) | Bitmap Index Scan → Bitmap Heap Scan (`idx_sublets_confirmed_renter`) | 3.38 | 0.12 | Worked: `= <uuid>` implies `IS NOT NULL` (strict operator), so the partial index qualifies; it holds only 526 entries. |
| Purge: `DELETE` 500 unreferenced users (rolled back) | `sublets_confirmed_renter_id_fkey` trigger **1,686 ms** / 500 calls; total 1,985 | same trigger **28 ms**; total 268 | 1,985 | 268 | Worked: each deleted user forces a "is anyone still pointing at this user?" check on `sublets.confirmed_renter_id`. Without an index, each of the 500 checks is a sequential scan of `sublets`. This is the 139 s re-seed slowdown seen on Day 4, now isolated and measured. The remaining 268 ms is other FKs (`match_requests_owner_id_fkey` ~108 ms is already indexed; its cost is per-call overhead). |

### `match_requests(sublet_id)` → `16-…`

| Query | Before | After | Before ms | After ms | Root cause |
|---|---|---|---|---|---|
| Owner inbox: `WHERE sublet_id = <listing> ORDER BY created_at DESC` (3 rows) | Seq Scan (11,785 removed) → Sort | Index Scan (`idx_match_requests_sublet`) → Sort | 5.03 | 0.14 | Worked. The existing `match_requests_one_pending_per_sublet (sublet_id, requester_id) WHERE status = 'pending'` was **not** usable, because the query doesn't imply `status = 'pending'`. |
| Purge: `DELETE` 200 unreferenced sublets (rolled back) | `match_requests_sublet_id_fkey` trigger **1,191 ms** / 200 calls; total 1,120 | same trigger **11 ms**; total 54 | 1,120 | 54 | Worked: the same FK-check mechanism as above. The other FKs on `sublets` (`sublet_quarters`, `sublet_images`, `sublet_videos`, `favorites`) were already fast because their keys start with `sublet_id`. |

### `(created_at DESC) WHERE display_status = 'public'`: replace vs add → `17-…`, `18-…`

| Query | Before (existing `display_status` idx) | After: **replaces** it (17) | After: **added** alongside (18) | Before ms | After ms 17 / 18 | Root cause |
|---|---|---|---|---|---|---|
| Browse page 1: newest 6 public (`ORDER BY created_at DESC LIMIT 6`) | Seq Scan → top-N heapsort over 3,413 rows | Index Scan (`idx_sublets_public_created`), stops after 6 | same | 10.52 | 0.17 / 0.27 | Worked: the index is already in newest-first order, so `LIMIT` stops early and no sort is needed. |
| Browse page 50: `OFFSET 294 LIMIT 6` | Seq Scan → top-N heapsort | Index Scan, reads 300 entries | same | 11.38 | 1.00 / 0.97 | Worked, but `OFFSET` still walks every skipped row (300 read for 6 returned); cost grows linearly with page depth. |
| Pagination total: `count(*) WHERE public` | Index Only Scan `sublets_display_status_idx` | Index Only Scan **`idx_sublets_public_created`** | Index Only Scan `sublets_display_status_idx` (old one still chosen) | 5.15 | 4.23 / 3.51 | No regression: with the old index gone, the new one serves the count the same way (any index on exactly the public rows can). When both exist, the planner keeps picking the old, smaller one. |
| Regression check: Q9 public + 1 mi (no coordinate index) | Index Scan `sublets_display_status_idx` | Bitmap Index Scan `idx_sublets_public_created` → Bitmap Heap Scan | Index Scan `sublets_display_status_idx` | 56.97 | 57.15 / 56.95 | **No regression**: in the replace variant the new index takes over the old one's role as "the list of public rows". Note: pass 18's *before* median was 85.91 ms against 56.97 in pass 17's identical before. That's emulation variance on the same plan, not a plan change. |

## Flags for discussion — continued (pass 3)

17. **Unindexed foreign keys are a write-side cost, not a read-side one.** Both FK indexes barely matter for /browse, but they turn a bulk delete (the 1-year retention purge, account deletion) from O(rows × table size) into an index lookup per row. Other referencing columns without a leading-column index (not measured): `messages.sender_id`, `thread_read_state.user_id`, `match_requests.thread_id`.
18. **`(created_at DESC) WHERE public` makes the old `sublets_display_status_idx` redundant** in every query measured (17 vs 18). Keeping both means two indexes of the same rows, maintained on every write, with the planner choosing between them only for `count(*)`.
19. **Deep `OFFSET` pagination** reads every skipped row even with the index (page 50 = 300 reads). Keyset pagination (`WHERE created_at < <last seen> ORDER BY created_at DESC LIMIT 6`) would keep every page at the page-1 cost. Not measured.

## Files (`apps/backend/db/explain/`)

Pass 1: `00-geography-sanity-check.txt` · `01-rent-composite.{before,after}.txt` · `02a-dates-old-gist-as-written.*` · `02b-dates-old-gist-btree_gist.*` · `02c-dates-old-btree-baseline.*` · `03-daterange-gist.*` · `04-coordinates-gist.*` · `04b-coordinates-gist-diagnostic-400m.*`

Pass 2: `05-q1-public-place-rent.*` · `06-q2-public-date-contains.*` · `07-q3-public-date-overlap.*` · `08-q4-public-quarters.*` · `09-q5-kitchen-sink-combined.*` · `10-q6-rent-spatial-combined.*` · `11-q7-public-rent-only.*` · `12-q8-public-place-only.*` · `13-q9-public-spatial.*` · `14-q10-knn.*` · `14-q10-knn.precision-check.txt`

Pass 3: `15-confirmed-renter-idx.*` · `16-match-requests-sublet-idx.*` · `17-created-at-REPLACES-display-status.*` · `18-created-at-ADDED-alongside.*`

The pre-existing empty `before.txt` was left as found.

## Summary of findings (all passes)

**Validated at 5,000 rows.**
- *Composite `(place_type, monthly_rent) WHERE display_status='public'`:* works as designed when the query carries both the partial predicate and an equality on `place_type`. Q1 went from 11.0 to 2.8 ms. That's the only shape where it helped.
- *Daterange + partial GiST:* creates cleanly, serves `@>` (Q2, 11.7 → 1.9 ms), and gives far better row estimates than the two-column form (52 or 63 estimated vs 370 for two columns, against 63 actual). That's its one measured advantage. In pass 1 the old two-column btree was still the faster lookup for containment (0.67 vs 2.18 ms).
- *Coordinate GiST:* clearly validated for **KNN** (Q10: 55.9 → 3.2 ms, with `Order By` on the index scan itself) and for **selective** radii (pass 1, 400 m: 253 → 18 ms).
- *Geography distances:* correct in meters (sanity check: 1606.36 m, not degrees).

**No benefit, with the specific cause.**
- *The partial indexes, on pass 1's original queries:* those queries lacked `display_status='public'`, so the planner can't prove they only need public rows.
- *Composite with rent only (Q7):* there's no leading-column equality to seek on.
- *Composite with place_type only (Q8):* usable, but at 37% selectivity a seq scan is cheaper.
- *Radius filters near campus (pass 1 at 1 and 5 mi; Q9):* they match 70–100% of rows, because listings cluster near campus. The bounding-box index prunes little and the geodesic recheck dominates.
- *`idx_quarters` (Q4):* the Winter/Spring filter matches 46% of quarter rows and the semi-join cost dominates. In the combined query (Q5) the primary key `(sublet_id, quarter)` did the job instead.
- *Combined indexes:*
  - **Q5:** of the three indexes, only the date index was used.
  - **Q6:** the BitmapAnd of the composite and the coordinate index ran at the baseline speed, because the coordinate bitmap covers 90% of the table.
- *Two-column GiST as originally written:* never creatable without `btree_gist`.

**Pass-1 open questions that pass 2 answered:**
- *Flag 1, "would the partial indexes be used if /browse carried `display_status='public'`?":* **yes**, both of them (Q1, Q2).
- *KNN, "is the index used for the ORDER BY?" (from "Not measured" and flag 4):* **yes**, confirmed in the plan.
- *`idx_quarters` (from "Not measured"):* measured, with a marginal gain (Q4); unused when combined (Q5).
- *Overlap queries (from "Not measured"):* measured for daterange; modest gain (Q3).
- *Flag 7, the `down()` lat/lng swap:* now fixed in the migration file. `down()` itself has still not been executed.

**Still open from pass 1:**
- *Flag 2:* daterange vs two-column, for overlap specifically; there's no two-column overlap measurement.
- *Flags 5/16:* whether the 1-row spatial estimate causes a bad *join* plan. It's still present in every spatial plan, and still untested with a join.
- *Flag 6:* why the spatial seq scan is slower at small radii. Not revisited.
- *Flags 8/15, privacy:* `coordinates` and now `distance_m` would leak exact locations. Not addressed by any query.
- *Flag 9:* `schema.sql` still lists `lat/lng/start_date/end_date` and hasn't been updated for the migration.

**New in pass 2:** flags 10–14 (planner picks one of several live indexes; the composite used without its leading column; Q8's expectation; the `display_status` index appearing; overlap only half-compared).

**Still unmeasured after both passes:**
- *Scale:* every number is from 5,000 rows under amd64 emulation on Apple Silicon. 50,000-row behavior (`-v rows=50000`) is unmeasured, and the seq-scan/index crossover points will move. Real RDS hardware is unmeasured too.
- *Full-text search:* no query, no `tsvector`/trigram index, nothing measured.
- *Two-column overlap:* the btree vs daterange comparison for `&&`.
- *KNN combined with other filters:* rent, dates or quarter alongside `ORDER BY <-> LIMIT`.
- *Spatial filter + join:* a spatial filter combined with the `sublet_quarters` join, to test flag 16.
- *Single-quarter or other more selective quarter filters* for `idx_quarters`.
- *Write-side cost:* INSERT/UPDATE overhead and on-disk size of each index.
- *Sorting and paging:* `ORDER BY monthly_rent` (could the composite supply the order?) and pagination with `OFFSET`/keyset.

**Pass 3 (foreign-key and default-sort indexes).**
- *`sublets(confirmed_renter_id) WHERE NOT NULL`:* renter lookup 3.38 → 0.12 ms, and the FK check during a 500-user delete 1,686 → 28 ms.
- *`match_requests(sublet_id)`:* owner inbox 5.03 → 0.14 ms, and the FK check during a 200-listing delete 1,191 → 11 ms.
- *`(created_at DESC) WHERE public`:* newest-first page 1 10.5 → 0.2 ms. As a **replacement** for `sublets_display_status_idx` it showed no regression on the count or on Q9. As an **addition** it left the old index serving only `count(*)`, at the same speed.
- *Still unmeasured from this pass:* keyset pagination, and the other unindexed FK columns (flag 17).


## Results — pass 4: title full-text search → `19-title-search.txt`

Manual verification after `1793078263056_add-sublets-title-search` and the `searchSublets` tests passed (41/41). Scratch DB, 5,000 seeded rows (3,413 public), `ANALYZE` first. The query is the exact SQL `searchSublets` sends, run as a prepared statement so `$1` is bound the way node-pg binds it.

- **Index:** `gin (title_search) WHERE display_status = 'public'`.
- **A. `'cozy studio'` (33 matches), custom plan:** `Bitmap Index Scan on idx_sublets_title_search` → top-N heapsort for `ts_rank DESC, id` → **2.1 ms**. The tsquery was constant-folded to `'cozi' & 'studio'`.
- **B. `'renovated loft davis'` (0 matches), custom plan:** same index, **0.76 ms**.
- **C. Same, forced generic plan** (`$1` unknown at plan time): still the GIN index, with `websearch_to_tsquery('english', $1)` as the index condition. A reused prepared statement can't regress to a seq scan.
- **D. Counter-example, `to_tsvector('english', title) @@ …` through the view:** the GIN index is **not** used. It scans every public row via `idx_sublets_public_created` and recomputes the vector per row: **225 ms** (~300× B).
- **E. Counter-example, base table without `display_status = 'public'`:** the partial index's predicate isn't implied, so it's a **seq scan** (12.8 ms, 5,000 rows removed).

**Takeaway:** the index serves only `title_search @@ …` with the public predicate present. Going through `public_sublets` guarantees the second. `searchSublets` is the only query that does the first.

**Still unmeasured:** a very broad term matching most rows (the planner may prefer a seq scan; correct, not a regression), 50k-row scale, and the write-side cost of maintaining the GIN index.

### Pass 4 addendum: why `to_tsvector('english', title) @@ …` took 225 ms → `20-to-tsvector-investigation.txt`

The counter-example asks what happens if a query **recomputes** the vector from `title` instead of reading the stored, indexed `title_search`. The GIN index is on the column, not on that expression, so Postgres can't use it.

**Where the time goes (3,413 public rows):**

| Measurement | Time |
|---|---|
| Same query 3× in one fresh session | 307 ms → 212 ms → 211 ms |
| Vector computation only (english) | ~230 ms |
| Vector computation only (simple) | ~165 ms |
| Full scan matching the **stored** column | 14 ms |
| Full scan **recomputing** each vector | 218 ms |
| Native arm64 Postgres, same titles, vectors only (english) | 18 ms |
| Native arm64 Postgres, vectors only (simple) | 12 ms |

**Reading those numbers:**
- The first call loads the english stemmer and stopword list (~95 ms, once per connection).
- Computation is ~94% of the cost: about 62 µs/row emulated, ~5.4 µs/row native.
- **Emulation is ~11× of the 225 ms.**
- Native or not, recomputing is O(rows) on every query, while the stored column + GIN reads only matching entries.

**Ways to make it fast, with trade-offs:**

| Option | Speed (measured) | Trade-off |
|---|---|---|
| **Stored generated column + GIN (current)** | 1.9 ms | ~350 kB extra heap at 5k rows (vs 180 kB of titles). Every title write recomputes the vector once. GIN maintenance on write |
| Expression GIN on `to_tsvector('english', title)`, no column | 8.0 ms | No extra heap; index 56 kB vs 64 kB. But `ts_rank` and the bitmap recheck recompute vectors for matched rows (4× slower here), and every query must repeat the exact expression to hit the index |
| `simple` config | ~30% cheaper per vector | Loses stemming and stopword removal; contradicts decision #4 |
| Native arm64 image locally / Graviton RDS | ~11× on CPU-bound work | Local only: the PostGIS image has no arm64 build (Day 4) |
| Recompute per query (the counter-example) | 225 ms emulated, ~18 ms native | Grows linearly with listings; never acceptable for search |

## Results — pass 5: quarter filters → `21-quarter-filters.txt`, `21b-…`, `21c-…`

Hypothesis, full results table and the recommended design are in `.claude/plans/quarter-filters.md`. In short:

- All variants return identical rows on the seed data.
- `range && multirange` has **no selectivity estimator** (a flat 34-row guess against 1,030 actual), so multirange variants pick a bad plan for page and search shapes.
- Passing plain ranges as `&& ANY($1::daterange[])` gets accurate estimates (995) and the best plan per shape: page 0.4–0.6 ms, search 0.9–1.9 ms, count 6.6–17 ms. The denormalized `quarters[]` + GIN is faster only on count.

## Results — pass 6: term filters derived from dates → `22-term-filters.txt`, `22b-term-filters-bounds.txt`

Setup:
- Scratch DB, 5,000 seeded rows (3,413 public), migrations through `1793123267633_retire-sublet-quarters`, `ANALYZE` first.
- Queries are the exact SQL and parameters `searchSublets` sends, captured with a recording client and run as prepared statements.
- `today` = 2026-10-27.

**First implementation:** `&&` plus an inlined `term_overlap_days(range, term) >= 14` function.
- Correct (all tests passed), and the SQL function inlined (no function call in the plan).
- The Fall + Winter newest-first page was estimated at **3 rows against 159 actual**: overlap arithmetic is opaque to the planner. It chose the date GiST plus a sort, **12 ms**.

**Rewritten as bounds** (`termSelectionBounds`), with two expression statistics objects on `lower()`/`upper()` of `availability_date_range`:

| Shape | Overlap form | Bounds, no stats | Bounds + expression stats |
|---|---|---|---|
| Page, Fall 2026 | 0.9–1.4 ms | — | **0.6–1.1 ms** (walks `idx_sublets_public_created`, est. 129) |
| Page, Fall + Winter | 12.1 ms (est. 3 / actual 159) | 20.9 ms, seq scan (est. 2) | **0.86–0.90 ms** (walks `idx_sublets_public_created`, est. 120) |
| Search "cozy studio" + rent + Fall | 1.2–1.6 ms | — | **0.9 ms** (GIN-first) |
| Count, Fall + Winter | 10.7 ms | — | **9.4 ms** (index-only on `idx_sublets_date_range`) |

- **Equivalence:** the bounds form returned identical rows to the overlap form for five selections on seeded data (386 / 159 / 421 / 39 / 690). It's also proven by a 50k-case property test and an end-to-end parity test.
- **Generic plans** (`plan_cache_mode = force_generic_plan`) are slower: 15.6–17.5 ms for the page shapes. node-pg sends unnamed statements, which are planned with their actual parameters, so this doesn't occur today. It would if the query moved to a named prepared statement.
- The overlap function was removed before this migration was shared. The statistics objects are in `1793123266286_add-academic-calendar`.

### Pass 6 addendum: term rules v2 → `22c-term-filters-v2.txt`

Rules v2 (ADR 7):
- Fall starts Sep 1.
- The start rule is gone.
- Year-long leases keep a repeated quarter only at the end with more days.

The SQL lost its start floor and gained a year-long exclusion:
- `NOT (nights BETWEEN 351 AND 375 AND <move-out within −14/+7 days of the anniversary> AND (<first term dropped> OR <last term dropped>))`;
- all numbers are bound parameters.

**Two estimation findings:**
1. **Statistics on the whole year-long expression were never used.** `BETWEEN` expands to two comparisons that flatten into the surrounding `AND`, so the statistics expression never appears as one clause. Measured: 556 estimated vs 0 actual, alone or inside `NOT`.
2. **Statistics on the nights expression** (`upper − lower`) work. The prefilter `BETWEEN 351 AND 375` (a safe superset of every year-long lease, 352–374) is estimated at 1 row (0 actual), so the planner sees the exclusion keeps ~all rows. The unused statistics object was replaced with this one.

| Shape | Plan | Estimate / actual | Time |
|---|---|---|---|
| Page, Fall 2026 | walks `idx_sublets_public_created` | 387 / 386 | 0.8–1.3 ms |
| Page, Fall + Winter | walks `idx_sublets_public_created` | 361 / 159 | 1.0 ms |
| Search "cozy studio" + rent + Fall | GIN-first | — | 1.5–1.8 ms |
| Count, Fall + Winter | index-only on `idx_sublets_date_range` | 361 / 159 | 7.8 ms |

- **Fall + Winter over-estimates 2.3×.** It comes from `upper − lower > 14` now using real nights statistics (nearly every listing is longer than 14 nights). Over-estimation is the safe direction for a LIMIT index walk. It didn't change any plan choice.
- **The seed has no year-long leases,** so the exclusion's cost at scale with many year-long listings is unmeasured.

## Results — pass 7: every /browse filter + price sort → `23-price-sort-index.txt`

`searchSublets` now covers every /browse control:
- search;
- rent;
- **price sort** (`asc`/`desc`, tiebreaker `id` in the same direction);
- **place type**;
- quarters;
- **requested stay** (`availability_date_range @> daterange(from, to, '[]')`).

Exact SQL captured and run as prepared statements on 5,000 seeded rows (3,413 public).

| Shape | Before (no rent index) | After `idx_sublets_public_rent (monthly_rent, id) WHERE public` |
|---|---|---|
| Price asc, unfiltered | 19.5–21 ms, Seq Scan + top-N sort of 3,413 rows | **0.16–0.22 ms**, index walk |
| Price desc, unfiltered | 19.4–21 ms | **0.14–0.16 ms**, Index Scan Backward |
| Price asc + rent 800–1600 | 15.5–16.6 ms | **0.22 ms** |
| Price asc, page 20 | 21.6–23.6 ms | **0.65–0.73 ms** |
| Price asc + private | 0.44–0.50 ms (`idx_sublets_place_rent`) | 0.16–0.18 ms |
| Full combination (rent + private + Winter–Spring + stay Jan 10–Apr 20, ± search) | 2.3–2.8 ms | 2.2–2.8 ms (unchanged: date GiST picks 267 candidates, 84 match, top-N sort) |
| Newest first, unfiltered | 0.22 ms | 0.21 ms (unchanged) |

- **Index size:** 152 kB.
- **Added as migration `1793155578946_add-public-rent-sort-index`.** Index DDL was written by Claude at Z's one-time request.
- **Estimate note (combination):** 12 estimated vs 84 actual. The stay filter and the quarter bounds are correlated (a stay of Jan 10 – Apr 20 already implies covering Winter and Spring), but the planner multiplies them as if independent. The plan is still the right one (the most selective index, then a sort of 84 rows). Revisit only if combination queries regress at scale.
