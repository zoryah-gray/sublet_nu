// Auth/user domain values shared by the frontend and backend.

/** Matches the users.contact_method CHECK constraint. */
export type ContactMethod = 'in_app' | 'email';

export const CONTACT_METHODS: readonly ContactMethod[] = ['in_app', 'email'];

/**
 * Avatar initials, derived at read time and never stored. TS twin of
 * avatar_initials in apps/backend/functions/layer/python/utils.py.
 *
 * Input: full name (nullable) and a fallback name. Output: first letters of the
 * first and last words of the full name ("Ally Goodman" -> "AG"). If the full
 * name is null or blank, the first letter of the fallback.
 */
export function avatarInitials(fullName: string | null | undefined, fallbackName: string): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallbackName.slice(0, 1).toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
