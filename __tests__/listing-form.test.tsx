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
  await user.type(screen.getByPlaceholderText(/hinman ave/i), '1234 Hinman Ave, Evanston, IL');
  await user.type(screen.getByPlaceholderText(/central evanston/i), 'Central Evanston');
}

async function fillStep2(user: ReturnType<typeof userEvent.setup>) {
  const priceInput = screen.getByPlaceholderText('1500');
  await user.clear(priceInput);
  await user.type(priceInput, '1200');

  // Select a quarter
  await user.click(screen.getByRole('button', { name: 'Fall' }));

  // Set dates
  const [startInput, endInput] = screen.getAllByDisplayValue('');
  // date inputs — use type via element
  const dateInputs = document.querySelectorAll('input[type="date"]');
  await user.type(dateInputs[0] as HTMLElement, '2025-09-01');
  await user.type(dateInputs[1] as HTMLElement, '2025-12-31');

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
    expect(screen.getByText('The Basics')).toBeInTheDocument();
  });

  it('clicking Continue on empty step 1 shows validation errors for address and neighborhood', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Address is required')).toBeInTheDocument();
    expect(screen.getByText('Neighborhood is required')).toBeInTheDocument();
  });

  it('filling required step 1 fields and clicking Continue advances to step 2', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Pricing, Availability & Details')).toBeInTheDocument();
  });

  it('step 2 validation: missing quarters shows error', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // On step 2 — type price but no quarters
    await user.type(screen.getByPlaceholderText('1500'), '1200');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Select at least one quarter')).toBeInTheDocument();
  });

  it('step 2 validation: missing price shows error', async () => {
    const user = userEvent.setup();
    render(<ListingForm mode="new" />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Select a quarter but no price
    await user.click(screen.getByRole('button', { name: 'Fall' }));
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
    expect(screen.getByText('Review your listing')).toBeInTheDocument();
    expect(screen.getByText('1234 Hinman Ave, Evanston, IL')).toBeInTheDocument();
    expect(screen.getByText('Central Evanston')).toBeInTheDocument();
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
