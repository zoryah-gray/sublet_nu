'use server';

import { CONTACT_METHODS, type ContactMethod } from '@sublet-nu/shared';
import { requireSession } from '@/app/lib/dal';

/**
 * Saves how renters contact the signed-in user (users.contact_method).
 *
 * Input: 'in_app' | 'email'. Output: { ok: true }. Throws UnauthorizedError when
 * signed out, checked here and not left to proxy.ts, because a Server Action is
 * reachable by a direct POST that the proxy matcher may never see.
 * Not persisted yet: the UserRepository doesn't exist.
 */
export async function updateContactMethod(method: ContactMethod): Promise<{ ok: true }> {
  await requireSession();
  if (!CONTACT_METHODS.includes(method)) throw new Error('Invalid contact method');
  return { ok: true };
}
