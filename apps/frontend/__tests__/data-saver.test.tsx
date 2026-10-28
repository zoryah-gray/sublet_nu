import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSaveData } from '@/app/lib/utils';
import BrowseFiltersClient from '@/app/(all_pages)/(logged_in)/browse/browse-filters-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/browse',
  useSearchParams: () => new URLSearchParams(),
}));

// Leaflet can't run in happy-dom; a stub is enough to see whether the map mounted.
vi.mock('@/app/components/map/interactive-map', () => ({
  default: ({ saveData }: { saveData?: boolean }) => <div data-testid="map" data-save-data={String(saveData)} />,
}));

/** Stubs both Data Saver signals plus the desktop breakpoint the browse page checks. */
function stubEnvironment({ saveData, reducedData = false, desktop = true }: { saveData?: boolean; reducedData?: boolean; desktop?: boolean }) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-data') ? reducedData : query.includes('min-width: 1024px') ? desktop : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: saveData === undefined ? undefined : { saveData, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
}

function SaveDataProbe() {
  return <p>{useSaveData() ? 'saving' : 'normal'}</p>;
}

function renderBrowse() {
  render(
    <BrowseFiltersClient
      currentFilters={{ query: '', terms: [], minPrice: 0, maxPrice: 2000, sortOrder: 'new' }}
      offeredTerms={[]}
      totalCount={0}
      currentPage={1}
      dataMaxPrice={2000}
      priceBuckets={[0]}
      bucketMax={0}
      bucketWidth={2000}
      sublets={[]}
    >
      <div />
    </BrowseFiltersClient>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
});

describe('useSaveData', () => {
  it('is true when the browser sends Save-Data', () => {
    stubEnvironment({ saveData: true });
    render(<SaveDataProbe />);
    expect(screen.getByText('saving')).toBeInTheDocument();
  });

  it('is true under prefers-reduced-data even without navigator.connection', () => {
    stubEnvironment({ reducedData: true });
    render(<SaveDataProbe />);
    expect(screen.getByText('saving')).toBeInTheDocument();
  });

  it('is false when neither signal is present (Safari/Firefox)', () => {
    stubEnvironment({});
    render(<SaveDataProbe />);
    expect(screen.getByText('normal')).toBeInTheDocument();
  });
});

describe('browse map under Data Saver (desktop)', () => {
  it('does not mount the map until the user taps Load map', async () => {
    stubEnvironment({ saveData: true });
    renderBrowse();

    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load map' }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-save-data', 'true');
  });

  it('mounts the map immediately when Data Saver is off', () => {
    stubEnvironment({ saveData: false });
    renderBrowse();

    expect(screen.getByTestId('map')).toHaveAttribute('data-save-data', 'false');
    expect(screen.queryByRole('button', { name: 'Load map' })).not.toBeInTheDocument();
  });
});
