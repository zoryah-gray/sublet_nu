# Data validation — frontend, server/actions, database

Every rule lives in up to three layers, and they do different jobs:

| Layer | Job | On failure |
|---|---|---|
| **Frontend form** (`listing-form.tsx`) | UX: tell the user early, field by field | Inline message; never the only check |
| **Server / actions** (planned) | **Authoritative**: never trust the client; normalize, authorize, validate | Typed error → user-facing message; nothing written |
| **Database** (CHECK / NOT NULL / FK / typmod) | Last line: invariants that must hold no matter what code path wrote the row | `23514` check · `23505` unique · `23503` FK · `23502` not-null · `22023`/`22000` bad value — mapped to messages by the server, **raw DB errors never reach the client** |

**Principles**
- One validation schema in `packages/shared`, imported by both the form and the server, so the two can't drift. The library (e.g. zod) is an **open decision**, not yet chosen or installed.
- The server re-validates everything the form already checked. A request can skip the form.
- The DB mirrors only rules whose violation would corrupt data or leak privacy. Product rules that may change often (max listing horizon, title length) stay in code.
- Validate **raw input before conversion**. `geography` silently wraps out-of-range coordinates (95°N is stored as 85°N), so no CHECK can see the original value. Only a check before the conversion, or the service-area CHECK, catches it.

## Rules

| Rule | Frontend | Server / actions | Database |
|---|---|---|---|
| Dates required; **end > start** | ✅ `validateStep2` ("End date must be after start date") | Re-check; build `daterange(start, end, '[]')` | ✅ `sublets_availability_range_valid` (non-empty, bounded, ≥ 2 days). End before start is rejected by the `daterange` constructor (`22000`) |
| Start not in the past; max horizon (e.g. ≤ 18 months) | ⬜ add | ⬜ add (authoritative; uses server clock) | — product rule, stays in code |
| Coordinates come from **server-side geocoding**, never from the client | — (Phase 10 Places autocomplete may *suggest*) | ⬜ geocode the submitted address server-side; reject on no match | — |
| Coordinates inside the **service area** (lat 41.6–42.2, lng −88.0 to −87.5); finite; non-empty | — | ⬜ check raw lat/lng **before** building the point | ✅ `sublets_coordinates_valid` (also rejects NaN/EMPTY; catches wrapped values) |
| Street address required; city required | ✅ | ⬜ trim; reject control characters/newlines (the SQL `approximate_street` regex's `.` matches newlines, the JS one doesn't) | `NOT NULL` ✅ |
| State 2 letters; ZIP 5 digits | ✅ same regexes as the DB | ⬜ uppercase state, strip non-digits from ZIP | ✅ `sublets_state_check`, `sublets_zip_code_check` |
| Monthly rent > 0 | ✅ | ⬜ | ⬜ future migration: `CHECK (monthly_rent > 0)` |
| Utilities cost ≥ 0 when not included | ✅ (> 0 required) | ⬜ | ⬜ future: `CHECK (monthly_utilities_cost >= 0)` |
| Bedrooms / bathrooms / roommates ≥ 0; roommates required for a private room | ✅ (pickers constrain values) | ⬜ | ⬜ future: `CHECK (bedroom_count >= 0 AND bathroom_count >= 0 AND coalesce(roommate_count, 0) >= 0)` |
| Title ≤ 80, description ≤ 1000 chars | ✅ | ⬜ | — product rule |
| `confirmed_renter_id <> owner_id` | — | ⬜ (match state machine) | ⬜ future: `CHECK (confirmed_renter_id IS DISTINCT FROM owner_id)` |
| Search text (`/browse?q=`) | ✅ `maxLength={MAX_SEARCH_LENGTH}` on `search-bar.tsx` (UTF-16 units, slightly stricter) | ✅ `searchSublets`: string only; ≤ 256 code points after trim (`MAX_SEARCH_LENGTH` in `packages/shared`, GitHub's cap); no control characters except tab/LF/CR; empty/whitespace → no filter; **always a bound parameter**. Failures throw `SearchInputError` (field + rule, never the value) before any SQL | — `websearch_to_tsquery` never raises on malformed input; stopword/symbol-only → no rows |
| Search filters (rent, page, page size) | ✅ slider bounds | ✅ rents finite numbers ≥ 0; page integer ≥ 1; page size 1–100 → `SearchInputError` (previously raw `22P02` or silent zero rows) | — |
| Sort (`/browse?sort=`) | ✅ two buttons (asc / desc), default newest | ✅ `searchSublets`: allow-list `new`/`asc`/`desc` (`Object.hasOwn`, so `__proto__`/`constructor` fail) → `SearchInputError('sort')`; picks a fixed ORDER BY fragment, never interpolated | — |
| Place type | ✅ two choices or none | ✅ allow-list `entire`/`private` → `SearchInputError('placeType')`; bound parameter | ✅ `place_type` CHECK (`entire`, `private`) |
| Requested stay (Dates Available) | ⬜ calendar range not wired to the URL yet | ✅ both or neither; real YYYY-MM-DD (round-trip); move-out after move-in; ≤ 731 days → `SearchInputError('availableFrom'/'availableTo')`; bound, built with `'[]'` like stored listings | — |
| Term filter (`/browse?terms=fall-2026,winter-2027`) | ✅ chips only allow a contiguous run (`nextTermSelection`); `parseTermParam` drops anything invalid → no term filter | ✅ `searchSublets`: must be an array no longer than the offered list, of current/upcoming term ids, distinct, contiguous (`validateTermSelection`) → `SearchInputError('terms')`; `today` must be a real YYYY-MM-DD date (round-trip checked; never from user input). Bounds are bound parameters | ✅ `academic_calendar_windows` CHECK (each exam date in its usual months, which also implies their order; Fall start isn't stored, it's always Sep 1). Cross-row consistency: `buildTerms` stops before any inverted term |
| Quarters a listing covers | ✅ form previews derived terms; no quarter input exists | ✅ derived, never accepted from input | — (derived from `availability_date_range`; `sublet_quarters` retired) |
| Who may see exact `street_address` / `coordinates` | — | ✅ planned: only owner / confirmed renter (`canSeeExactAddress`) | ✅ `public_sublets` view exposes only `approximate_street` / `approx_coordinates` |

✅ exists · ⬜ to build · — not this layer's job

## Migration-time validation
Before converting existing rows, a migration checks the **raw** columns and fails with the offending ids, before any change. Example: the pre-flight `DO` block in `1791947964406_update-sublets-date-coords`. It uses the same predicates as the constraints it's about to add, so the error is readable instead of a mid-backfill constraint failure.

## Open decisions
- Validation library for the shared schema (zod vs hand-written).
- Service-area box: replacing `sublets_coordinates_valid` requires a migration if SubletNU expands beyond Chicagoland.
- When to add the "future" DB CHECKs above: as one migration once the server layer exists, with a pre-flight check like the one above.
