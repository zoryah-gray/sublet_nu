// @vitest-environment node
// Finalized auth test 10: a Server Action rejects an unauthenticated caller on its
// own, as if invoked from a path proxy.ts never ran on.

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

describe('Server Actions verify the session themselves', () => {
  it('10. updateContactMethod rejects an unauthenticated direct call', async () => {
    const { updateContactMethod } = await import('@/app/actions/settings');
    const { UnauthorizedError } = await import('@/app/lib/dal');
    await expect(updateContactMethod('in_app')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
