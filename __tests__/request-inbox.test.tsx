import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RequestInbox from '@/app/components/listings/request-inbox';
import type { MatchRequest } from '@/app/lib/mock-data';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const BASE_REQUEST: MatchRequest = {
  id: 'mr1',
  subletId: '1',
  subletTitle: 'Test Listing',
  ownerId: 'user-jon',
  requesterId: 'user-kelly',
  requesterName: 'Kelly Tween',
  requesterInitials: 'KT',
  requesterEmail: 'kelly@test.com',
  isRequesterPublic: true,
  message: 'Hi, I am interested!',
  status: 'pending',
  createdAt: new Date().toISOString(),
};

describe('RequestInbox', () => {
  it('renders the correct number of request rows', () => {
    const requests: MatchRequest[] = [
      BASE_REQUEST,
      { ...BASE_REQUEST, id: 'mr2', requesterName: 'Alex Park', requesterInitials: 'AP', status: 'accepted', threadId: 't1' },
    ];
    render(<RequestInbox requests={requests} />);

    expect(screen.getByText('Kelly Tween')).toBeInTheDocument();
    expect(screen.getByText('Alex Park')).toBeInTheDocument();
  });

  it('shows "View in messages" link only for requests with threadId', () => {
    const requests: MatchRequest[] = [
      BASE_REQUEST,
      { ...BASE_REQUEST, id: 'mr2', requesterName: 'Alex Park', requesterInitials: 'AP', status: 'accepted', threadId: 't1' },
    ];
    render(<RequestInbox requests={requests} />);

    const links = screen.getAllByText(/view in messages/i);
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/messages?thread=t1');
  });

  it('shows italic "No message attached" for requests with empty message', () => {
    const requests: MatchRequest[] = [
      { ...BASE_REQUEST, message: '' },
    ];
    render(<RequestInbox requests={requests} />);
    expect(screen.getByText('No message attached')).toBeInTheDocument();
  });

  it('shows correct status badge text for each status', () => {
    const requests: MatchRequest[] = [
      { ...BASE_REQUEST, id: 'mr1', status: 'pending' },
      { ...BASE_REQUEST, id: 'mr2', status: 'accepted' },
      { ...BASE_REQUEST, id: 'mr3', status: 'declined' },
      { ...BASE_REQUEST, id: 'mr4', status: 'confirmed' },
    ];
    render(<RequestInbox requests={requests} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders "No requests yet" when given an empty list', () => {
    render(<RequestInbox requests={[]} />);
    expect(screen.getByText('No requests yet.')).toBeInTheDocument();
  });
});
