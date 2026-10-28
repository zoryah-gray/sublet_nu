import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ListingForm from '@/app/components/listings/listing-form';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/hinman ave/i), '1234 Hinman Ave');
  await user.type(screen.getByPlaceholderText('e.g. Evanston'), 'Evanston');
  await user.type(screen.getByPlaceholderText('60201'), '60202');
}

async function fillStep2(user: ReturnType<typeof userEvent.setup>) {
  const priceInput = screen.getByPlaceholderText('1500');
  await user.clear(priceInput);
  await user.type(priceInput, '1200');

  // Select utilities
  await user.click(screen.getByRole('checkbox', { name: /utilities included/i }))

  // Set dates
  const dateInputs = document.querySelectorAll('input[type="date"]');
  await user.type(dateInputs[0] as HTMLElement, '2026-09-15');
  await user.type(dateInputs[1] as HTMLElement, '2027-01-15');

  await user.type(screen.getByPlaceholderText(/sunny 1br/i), 'My Test Listing');
  await user.type(
    screen.getByPlaceholderText(/describe your space/i),
    'A great place to live near campus.',
  );
}

describe('ListingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('step 1 shows "The Basics" heading', () => {
    render(<ListingForm mode="new" />);
    expect(screen.getByRole('heading', { name: 'The Basics', level: 2 })).toBeInTheDocument();
  });

  it('clicking Continue on empty step 1 shows validation errors for street address, city, and ZIP', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Street address is required')).toBeInTheDocument();
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(screen.getByText('ZIP code must be 5 digits')).toBeInTheDocument();
  });

  it('step 1 rejects a ZIP code shorter than 5 digits', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await user.type(screen.getByPlaceholderText(/hinman ave/i), '1234 Hinman Ave');
    await user.type(screen.getByPlaceholderText('e.g. Evanston'), 'Evanston');
    await user.type(screen.getByPlaceholderText('60201'), '6020');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('ZIP code must be 5 digits')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Basics', level: 2 })).toBeInTheDocument();
  });

  it('filling required step 1 fields and clicking Continue advances to step 2', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('heading', { level: 2, name: 'Pricing, Availability & Details' })).toBeInTheDocument();
  });

  it('step 2 derives quarters from the dates instead of asking for them', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.queryByRole('button', { name: 'Fall' })).not.toBeInTheDocument();
    const dateInputs = document.querySelectorAll('input[type="date"]');
    await user.type(dateInputs[0] as HTMLElement, '2026-09-15');
    await user.type(dateInputs[1] as HTMLElement, '2027-01-15');

    expect(screen.getByText('Fall 2026')).toBeInTheDocument();
    expect(screen.getByText('Winter 2027')).toBeInTheDocument();
  });

  it('step 2 validation: missing price shows error', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // No price entered
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Price must be greater than 0')).toBeInTheDocument();
  });

  it('step 3 shows review summary with entered values', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await fillStep2(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // On step 3 — review
    expect(screen.getByRole('heading', { level: 2, name: 'Review your listing' })).toBeInTheDocument();
    expect(screen.getByText('1234 Hinman Ave, Evanston, IL 60202')).toBeInTheDocument();
    expect(screen.getByText('My Test Listing')).toBeInTheDocument();
  });

  it('clicking Publish listing calls router.push with /listings?created=1', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await fillStep2(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await user.click(screen.getByRole('button', { name: /publish listing/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/listings?created=1');
    }, { timeout: 2000 });
  });
});
