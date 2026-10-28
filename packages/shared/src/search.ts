// Search-input rules shared by the search box (apps/frontend) and
// searchSublets (apps/backend), so the two can't drift.

/** Max search length in characters after trimming. GitHub's search API uses the same 256 cap. */
export const MAX_SEARCH_LENGTH = 256;
