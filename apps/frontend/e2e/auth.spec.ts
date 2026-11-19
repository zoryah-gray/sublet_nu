import { test, expect } from '@playwright/test';

// Tier 3 (E2E): every route under (logged_in), /browse included, requires a session.
//
// A real end-to-end Google Hosted UI login is run manually and periodically, not
// automated in CI: Google blocks automated sign-ins, and it would need a real
// account's credentials in CI.
//
// Signed-in tests reuse a session saved once by hand, so they don't assume any
// cookie shape:
//   npx playwright codegen --save-storage=e2e/.auth/user.json http://localhost:3000/login
//   (sign in with Google, close the window), then
//   E2E_STORAGE_STATE=e2e/.auth/user.json npm run test:e2e
//
// The unauthenticated tests FAIL until proxy.ts guards (logged_in) routes.

const storageState = process.env.E2E_STORAGE_STATE;

test.describe('unauthenticated', () => {
  for (const route of ['/browse', '/dashboard']) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(\?|$)/);
    });
  }
});

test.describe('signed in', () => {
  test.skip(!storageState, 'Set E2E_STORAGE_STATE to a saved signed-in session (see top of file)');
  test.use({ storageState });

  test('reaches /browse and sees listings', async ({ page }) => {
    await page.goto('/browse');
    await expect(page).toHaveURL(/\/browse/);
    await expect(page.locator('a[href^="/sublet/"]').first()).toBeVisible();
  });

  // Session presence only. Ownership-filtered content is Day 6.
  test('reaches the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
