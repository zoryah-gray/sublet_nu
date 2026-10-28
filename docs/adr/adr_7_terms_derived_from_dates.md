# Architectural Decision Record (ADR)

Title: Academic terms derived from listing dates; `sublet_quarters` retired

Date: 10/27/26

Status: **accepted**

## Summary:

Issue and Context:

> Quarters were stored twice:
>
> - as owner-picked rows in `sublet_quarters`, which have no year;
> - as the listing's `availability_date_range`.
>
> They could disagree (Jan–Mar dates tagged "Fall"), a student couldn't ask for "Fall 2026" specifically, and detecting a quarter change for notifications needed a set diff.

Decision:

> Derive a listing's terms from its dates plus Northwestern Registrar exam dates (`academic_calendar`), using one shared rule set (`packages/shared/src/terms.ts`). /browse filters on specific terms such as `fall-2026`. `sublet_quarters` and the `quarter` enum are dropped.

## Details

### Context and Problem Statement

> /browse needed a real quarter filter. Report passes 5–6 (`docs/reports/index-optimization-explain-report.md`) measured the options against 5,000 seeded rows. Z decided the matching rules on 10/27/26.
>
> **User assumption:** The current assumption is that when a user uses quarter filtering, they are looking for listings with availability in the selected quarters. The matching rules (14-day minimum, every selected quarter, year-long rule) follow from that intent; if the assumption changes, revisit them together.

## Considered Options

1. **Keep `sublet_quarters` (owner-declared), add a year column**
   - Pros
     - Owners control their labels.
     - Fastest page/search plans in pass 5 (index-only PK probes).
   - Cons
     - It can still disagree with the dates.
     - Every write maintains a second copy.
     - Notifications need a set diff.
2. **Denormalized `quarters[]` column + GIN**
   - Pros
     - Fastest count.
   - Cons
     - The same drift and sync problem, and no year.
3. **Derive from dates + `academic_calendar` (chosen)**
   - Pros
     - Can't disagree with dates.
     - Year-aware.
     - No extra write path.
     - A quarter change is just a date change.
   - Cons
     - Owners can't override labels.
     - The calendar needs a yearly update.
     - The SQL had to be shaped for the planner (below).

### Decision outcome

**Rules (v2; v1 started Fall at the first day of classes and required a listing to start in the first selected term):**

- **Term bounds:**
  - Fall = [**Sep 1**, day after Fall exams);
  - Winter/Spring start the day after the previous exams end;
  - Summer runs from the day after Spring exams through Aug 31.
  - Terms tile the calendar. Only exam dates are stored.
- **Covering a term:** a listing covers a term with **≥ 14 days** of overlap. The **move-out day is not counted**.
- **Year-long leases:** move-out from **14 days before to 7 days after** the 1-year anniversary. If the same quarter is covered at both ends, only the end with **more days** counts (earlier on a tie).
  - Example: Sep 20, 2026 – Sep 20, 2027 counts Fall 2026 (84 days), not Fall 2027 (19).
  - Example: Aug 15, 2026 – Aug 10, 2027 keeps Summer 2027 (59) over Summer 2026 (17).
- **Matching a selection:** a selection is a **contiguous** run of current/upcoming terms. It matches a listing that counts **every** selected term.
  - There's no start rule: Sep 20 – Mar 12 matches (Fall), (Winter) and (Fall + Winter).
- **Hidden, not deleted:** past terms are hidden by date; nothing is deleted.
- **Missing anchors** are projected silently from the previous year + 1 year, including whole years after the last calendar row (`buildTermsForDate`), so a stale calendar still offers terms. A time-dependent guard test fails when the next unentered Fall is under 6 months away.
- **Calendar typos:** the per-date month windows (`academic_calendar_windows`, which also imply exam order) catch them, and `buildTerms` stops before any term whose start isn't before its end (a cross-row error no CHECK can see).

**Query shape:**

- `searchSublets` converts a selection into:
  - three bound comparisons on `lower()`/`upper()` of `availability_date_range` (`termSelectionBounds`);
  - one year-long exclusion, led by a nights range so the planner sees it removes almost nothing.
- A property test over 80,000+ cases (incl. year-long leases) proves it's equivalent to the shared rule.
- Three expression statistics objects (start, move-out, nights) give the planner real estimates.
- **Measured (pass 6, v2):**
  - Fall 2026: 387 estimated vs 386 actual;
  - Fall + Winter: 361 vs 159 (an over-estimate, the safe direction for an index walk with LIMIT);
  - the newest-first pages run ~1 ms, walking `idx_sublets_public_created`.

#### **Chosen option**: derive from dates, because it removes drift and the sync/notification burden, and is year-aware, at equal or better query speed once the SQL is shaped as bounds.

### Consequences

- **Easier:**
  - one source of truth;
  - notifications compare one column;
  - the listing form asks only for dates and previews "Shows as: Fall 2026 · Winter 2027".
- **Harder:**
  - the Registrar dates must be added by migration each year (future: a scraper with human review);
  - the frontend mock calendar (`apps/frontend/app/lib/academic-terms.ts`) mirrors the migration until /browse reads the DB.
- **Resolved open item (v1 → v2):** under v1 a Sep 1 lease counted 22 days of Summer and didn't match "Fall 2026" alone. v2 starts Fall on Sep 1 and drops the start rule, so Sep 1 – Dec 18 matches (Fall 2026), and Jul 1 – Dec 20 matches (Summer + Fall 2026) and (Fall 2026).

## Revisit trigger

- Users report missing listings for a quarter they expected, or the year-long rule hiding a quarter they expected.
- Northwestern changes its calendar structure (e.g. semesters).
- Listing volume makes the count query (7.8 ms at 3.4k public rows, emulated) a bottleneck.

---

## Confirmation

- `apps/backend/test/terms.test.ts`: the rules, examples A–K × 14 selections, year-long window edges and ties, the Feb 29 anniversary, projection, and the bounds ↔ rule property test.
- `apps/backend/test/db/sublets.search.db.test.ts`: the A–K × 14-selection matrix through `searchSublets`, the tie and window cases, end-to-end parity on boundary-packed and year-long listings, validation, authorization.
- `apps/backend/test/db/sublets.db.test.ts`: `sublet_quarters`/`quarter` absent, calendar CHECKs, statistics present, calendar guard.
- `apps/frontend/__tests__/academic-terms.test.ts`: the mock filter uses the same rules.
