// Utillity functions 
//

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDateToLocal(
  dateStr: string,
  locale: string = 'en-US',
): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.format(date);
}

// ─── Relative timestamps ──────────────────────────────────────────────────────

/** Returns a human-readable relative time string, e.g. "5m ago", "2h ago", "3d ago". */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── String helpers ───────────────────────────────────────────────────────────

/** Computes avatar initials from a display name — first letter of first + last word. */
export function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Returns true if the email belongs to a Northwestern domain. */
export function isNorthwesternEmail(email: string): boolean {
  return email.endsWith('@northwestern.edu') || email.endsWith('@u.northwestern.edu');
}

// ─── Media file validation ────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
export const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
export const MAX_IMAGE_BYTES     = 10 * 1024 * 1024;  // 10 MB
export const MAX_VIDEO_BYTES     = 100 * 1024 * 1024; // 100 MB

export type FileValidationError = { file: string; reason: string };

/** Validates a FileList against allowed media types and size limits. */
export function validateMediaFiles(files: FileList): { valid: File[]; errors: FileValidationError[] } {
  const valid: File[] = [];
  const errors: FileValidationError[] = [];

  Array.from(files).forEach((f) => {
    const isImage = ALLOWED_IMAGE_TYPES.has(f.type);
    const isVideo = ALLOWED_VIDEO_TYPES.has(f.type);

    if (!isImage && !isVideo) {
      errors.push({ file: f.name, reason: 'Unsupported file type' });
      return;
    }
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (f.size > limit) {
      const mb = Math.round(limit / 1024 / 1024);
      errors.push({ file: f.name, reason: `Exceeds ${mb} MB limit` });
      return;
    }
    valid.push(f);
  });

  return { valid, errors };
}

// ─── Path Functions ───────────────────────────────────────────────────────────

/** Returns true when pathname matches or is a sub-route of href. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/' || href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}