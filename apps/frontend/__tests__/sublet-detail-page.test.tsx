import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';
import SubletDetailPage from '@/app/(all_pages)/(logged_in)/sublet/[id]/page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/sublet/1',
}));

/** Awaits the async Server Component and renders its output like Next would. */
async function renderDetail(id: string) {
  render(await SubletDetailPage({ params: Promise.resolve({ id }) }));
}

describe('SubletDetailPage address privacy (current user: user-jon)', () => {
  it('shows the owner their own exact address', async () => {
    await renderDetail('1');
    expect(screen.getByText('1234 Hinman Ave, Evanston, IL 60202')).toBeInTheDocument();
  });

  it('authorization failure: another student sees only the block-level address', async () => {
    await renderDetail('2');
    expect(screen.getByText('500 block of Chicago Ave, Evanston, IL 60202')).toBeInTheDocument();
    expect(screen.queryByText(/567 Chicago Ave/)).not.toBeInTheDocument();
    expect(screen.getByText('Exact address shared once your match is confirmed')).toBeInTheDocument();
  });

  it('an unknown sublet id is a 404', async () => {
    await expect(SubletDetailPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('NotFound page', () => {
  it('explains the 404 and links back into the app', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse listings' })).toHaveAttribute('href', '/browse');
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });
});
