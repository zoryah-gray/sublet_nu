/**
 * Notification bell tests.
 *
 * Architecture note: NotificationsProvider lives in the root layout, so all
 * NavBar instances across pages share the same notification state. Tests
 * simulate "navigation" by re-rendering a new NavBar inside the same provider
 * — matching what happens in the real app.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NotificationsProvider } from '@/app/context/notifications';
import NavBar from '@/app/components/navbar';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/browse',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className, 'aria-label': ariaLabel }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} className={className} aria-label={ariaLabel}>{children}</a>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithProvider(ui: React.ReactElement) {
  return render(<NotificationsProvider>{ui}</NotificationsProvider>);
}

/** Simulates "navigation" by re-rendering NavBar inside the same provider. */
function renderTwoPages() {
  const user = userEvent.setup();

  // Provider is the single source of truth across pages
  const utils = render(
    <NotificationsProvider>
      <div data-testid="page-root">
        <NavBar />
      </div>
    </NotificationsProvider>
  );

  const renavigateToNewPage = () => {
    utils.rerender(
      <NotificationsProvider>
        <div data-testid="page-root">
          <NavBar />
        </div>
      </NotificationsProvider>
    );
  };

  return { ...utils, user, renavigateToNewPage };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NavBar — notification bell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a red dot when there are unread notifications', () => {
    renderWithProvider(<NavBar />);

    const dot = screen.getByTestId('notif-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('data-state', 'unread');
    expect(dot).toHaveClass('bg-red-500');
  });

  it('red dot turns gray after the user opens the bell (browse page)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<NavBar />);

    // Red dot initially present
    expect(screen.getByTestId('notif-dot')).toHaveAttribute('data-state', 'unread');

    // Open the bell popover
    await user.click(screen.getByRole('button', { name: /notifications/i }));

    // Dot should now be gray (seen state)
    await waitFor(() => {
      const dot = screen.getByTestId('notif-dot');
      expect(dot).toHaveAttribute('data-state', 'seen');
      expect(dot).toHaveClass('bg-gray-400');
      expect(dot).not.toHaveClass('bg-red-500');
    });
  });

  it('dismissing a single notification removes only that item', async () => {
    const user = userEvent.setup();
    renderWithProvider(<NavBar />);

    // Open popover
    await user.click(screen.getByRole('button', { name: /notifications/i }));

    // Find the first notification's dismiss button
    const dismissButtons = await screen.findAllByRole('button', { name: /dismiss notification/i });
    expect(dismissButtons.length).toBeGreaterThan(0);
    const firstTitle = screen.getAllByRole('listitem')[0].querySelector('p')?.textContent;

    await user.click(dismissButtons[0]);

    // The dismissed notification should be gone; others still present
    await waitFor(() => {
      if (firstTitle) {
        expect(screen.queryByText(firstTitle)).not.toBeInTheDocument();
      }
      // At least one notification remains
      expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('dot disappears after all notifications are individually dismissed', async () => {
    const user = userEvent.setup();
    renderWithProvider(<NavBar />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    // Dismiss every notification one by one
    let buttons = await screen.findAllByRole('button', { name: /dismiss notification/i });
    while (buttons.length > 0) {
      await user.click(buttons[0]);
      await waitFor(() => {
        buttons = screen.queryAllByRole('button', { name: /dismiss notification/i });
      });
    }

    // No dot at all
    expect(screen.queryByTestId('notif-dot')).not.toBeInTheDocument();
  });

  it('"Clear all" removes every notification and the dot', async () => {
    const user = userEvent.setup();
    renderWithProvider(<NavBar />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByRole('button', { name: /clear all/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('notif-dot')).not.toBeInTheDocument();
      expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument();
    });
  });

  it('after opening bell on browse page (red → gray), dot stays gray on a different page', async () => {
    const { user, renavigateToNewPage } = renderTwoPages();

    // Open bell → marks all read → gray dot
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() =>
      expect(screen.getByTestId('notif-dot')).toHaveAttribute('data-state', 'seen')
    );

    // Navigate (re-render NavBar within same provider)
    renavigateToNewPage();

    // Still gray — context preserved
    await waitFor(() => {
      const dot = screen.getByTestId('notif-dot');
      expect(dot).toHaveAttribute('data-state', 'seen');
      expect(dot).not.toHaveClass('bg-red-500');
    });
  });

  it('after clearing all notifications on dashboard, navigating to another page shows no notifications', async () => {
    const { user, renavigateToNewPage } = renderTwoPages();

    // Open bell
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    // Clear all
    await user.click(await screen.findByRole('button', { name: /clear all/i }));

    await waitFor(() =>
      expect(screen.queryByTestId('notif-dot')).not.toBeInTheDocument()
    );

    // Simulate navigating to another page — NavBar remounts but shares provider
    renavigateToNewPage();

    // No dot on the new page
    await waitFor(() => {
      expect(screen.queryByTestId('notif-dot')).not.toBeInTheDocument();
    });
  });
});
