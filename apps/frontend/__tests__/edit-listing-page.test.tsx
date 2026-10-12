import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { ListingFormData } from '@/app/lib/definitions';
import EditListingPage from '@/app/(all_pages)/(logged_in)/(_dashboard)/listings/[id]/edit/page';

// notFound() throws in Next to abort rendering — mirror that so the test can observe it.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn() }),
}));

/** Calls the async Server Component the way Next does, with params as a Promise. */
function renderPage(id: string) {
  return EditListingPage({ params: Promise.resolve({ id }) }) as Promise<ReactElement<{ initialData: ListingFormData }>>;
}

describe('EditListingPage', () => {
  it('maps the owner\'s sublet onto the split address and renamed form fields', async () => {
    const page = await renderPage('1');

    expect(page.props.initialData).toMatchObject({
      streetAddress: '1234 Hinman Ave',
      city: 'Evanston',
      state: 'IL',
      zipCode: '60202',
      monthlyRent: 1200,
      bedroomCount: 0,
      bathroomCount: 1,
      monthlyUtilitiesCost: 100,
    });
  });

  it('authorization failure: a sublet owned by someone else is a 404, not an edit form', async () => {
    await expect(renderPage('2')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('a sublet id that does not exist is a 404', async () => {
    await expect(renderPage('does-not-exist')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('a sublet id that is not a valid id is a 404', async () => {
    await expect(renderPage('4x10')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
