// Academic terms for the frontend: the Registrar calendar, the terms offered
// in the /browse filter, and URL parsing. The rules themselves live in
// packages/shared/src/terms.ts, shared with searchSublets.

import {
  buildTermsForDate,
  offeredTerms,
  validateTermSelection,
  type AcademicCalendarYear,
  type Term,
} from '@sublet-nu/shared';

// Mirrors the academic_calendar rows inserted by migration
// 1793123266286_add-academic-calendar (exam dates only; Fall starts Sep 1). Replace with a DB read when /browse
// moves off mock data; until then, update both together.
export const ACADEMIC_CALENDAR: AcademicCalendarYear[] = [
  { academicYear: 2025, fallExamsEnd: '2025-12-13', winterExamsEnd: '2026-03-21', springExamsEnd: '2026-06-12' },
  { academicYear: 2026, fallExamsEnd: '2026-12-12', winterExamsEnd: '2027-03-20', springExamsEnd: '2027-06-11' },
  { academicYear: 2027, fallExamsEnd: '2027-12-11', winterExamsEnd: '2028-03-18', springExamsEnd: '2028-06-09' },
  { academicYear: 2028, fallExamsEnd: '2028-12-09', winterExamsEnd: null, springExamsEnd: null },
];

/** Today's date in Chicago as 'YYYY-MM-DD' — the campus calendar day. */
export function chicagoToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

// Built through next academic year from server start, so badges and the mock
// filter keep working (on projected dates) if the calendar isn't updated.
export const ACADEMIC_TERMS: Term[] = buildTermsForDate(ACADEMIC_CALENDAR, chicagoToday());

/** Terms the /browse filter offers: the current one through the end of the next academic year. */
export function getOfferedTerms(today: string = chicagoToday()): Term[] {
  return offeredTerms(buildTermsForDate(ACADEMIC_CALENDAR, today), today);
}

/**
 * Parses the untrusted ?terms= value ('fall-2026,winter-2027') into a sorted,
 * contiguous selection. Anything invalid means no term filter, never an error page.
 */
export function parseTermParam(raw: string | undefined, offered: Term[]): Term[] {
  if (!raw) return [];
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
  const result = validateTermSelection(ids, offered);
  return result.ok ? result.terms : [];
}

/**
 * The selection after clicking a term chip, always one contiguous run:
 * clicking outside the run extends it (filling any gap), clicking either end
 * removes that end, and clicking inside the run resets to just that term.
 */
export function nextTermSelection(selectedIds: string[], clickedId: string, offeredIds: string[]): string[] {
  const positions = selectedIds.map((id) => offeredIds.indexOf(id)).filter((p) => p >= 0).sort((a, b) => a - b);
  const clicked = offeredIds.indexOf(clickedId);
  if (clicked === -1) return selectedIds;
  if (positions.length === 0) return [clickedId];
  const first = positions[0];
  const last = positions[positions.length - 1];
  let from = first;
  let to = last;
  if (clicked < first) from = clicked;
  else if (clicked > last) to = clicked;
  else if (clicked === first) from = first + 1;
  else if (clicked === last) to = last - 1;
  else from = to = clicked;
  return offeredIds.slice(from, to + 1);
}
