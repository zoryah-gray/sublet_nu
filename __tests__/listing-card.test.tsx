import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ListingCard from '@/app/components/listings/listing-card';
import type { Sublet, MatchRequest } from '@/app/lib/mock-data';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const MOCK_SUBLET: Sublet = {
  id: '1',
  title: 'Sunny Studio Near Campus',
  address: '1234 Hinman Ave, Evanston, IL',
  neighborhood: 'Central Evanston',
  price: 1200,
  beds: 0,
  baths: 1,
  quarters: ['Fall', 'Winter'],
  startDate: '2025-09-01',
  endDate: '2025-12-31',
  description: 'Cozy studio apartment.',
  imageHue: '230',
  ownerId: 'user-jon',
  status: 'active',
};

const MOCK_REQUESTS: MatchRequest[] = [
  {
    id: 'mr1',
    subletId: '1',
    subletTitle: 'Sunny Studio Near Campus',
    ownerId: 'user-jon',
    requesterId: 'user-kelly',
    requesterName: 'Kelly Tween',
    requesterInitials: 'KT',
    requesterEmail: 'kelly@test.com',
    isRequesterPublic: true,
    message: 'Interested!',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

describe('ListingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, status badge, and request count pill', () => {
    render(<ListingCard sublet={MOCK_SUBLET} requests={MOCK_REQUESTS} />);

    expect(screen.getByText('Sunny Studio Near Campus')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/1 request/)).toBeInTheDocument();
  });

  it('clicking request pill expands inbox; clicking again collapses it', async () => {
    //setup user event
    const user = userEvent.setup(); 
    // render component were testing
    render(<ListingCard sublet={MOCK_SUBLET} requests={MOCK_REQUESTS} />);

    // find element
    const pill = screen.getByText(/1 request/);

    // assert init state
    // Inbox not visible initially
    expect(screen.queryByText('Kelly Tween')).not.toBeInTheDocument();

    // Interact: Click to open
    await user.click(pill);
    // assert after to check expected interact state/response
    expect(screen.getByText('Kelly Tween')).toBeInTheDocument();

    // Click to close
    await user.click(pill);
    await waitFor(() => {
      // assert closed state
      expect(screen.queryByText('Kelly Tween')).not.toBeInTheDocument();
    });
  });

  it('archive dialog: clicking Archive opens dialog; confirming changes badge to Archived and shows Restore', async () => {
    const user = userEvent.setup();
    render(<ListingCard sublet={MOCK_SUBLET} requests={[]} />);

    // Click the Archive trigger button
    await user.click(screen.getByRole('button', { name: /archive/i }));

    // Dialog should be open
    expect(screen.getByText('Archive this listing?')).toBeInTheDocument();

    // Confirm
    await user.click(screen.getByRole('button', { name: /^archive listing$/i }));

    await waitFor(() => {
      expect(screen.getByText('Archived')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    });
  });

  it('restore dialog: clicking Restore opens dialog; confirming changes badge back to Active', async () => {
    const user = userEvent.setup();
    render(<ListingCard sublet={{ ...MOCK_SUBLET, status: 'archived' }} requests={[]} />);

    // Archived initially
    expect(screen.getByText('Archived')).toBeInTheDocument();

    // Click the Restore trigger button
    await user.click(screen.getByRole('button', { name: /restore/i }));

    // Dialog should be open
    expect(screen.getByText('Restore this listing?')).toBeInTheDocument();

    // Confirm
    await user.click(screen.getByRole('button', { name: /^restore listing$/i }));

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('delete dialog: clicking Delete opens dialog; confirming removes card from DOM', async () => {
    const user = userEvent.setup();
    const { container } = render(<ListingCard sublet={MOCK_SUBLET} requests={[]} />);

    // Click the Delete trigger button
    await user.click(screen.getByRole('button', { name: /delete/i }));

    // Dialog should be open
    expect(screen.getByText('Delete this listing?')).toBeInTheDocument();

    // Confirm delete
    await user.click(screen.getByRole('button', { name: /^delete listing$/i }));

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
