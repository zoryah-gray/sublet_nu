import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useSSRSafeMediaQuery } from '@/app/lib/utils';

// Deterministic matchMedia stub — the hook calls window.matchMedia directly
// (not through react-responsive's internal polyfill), so this stub is
// actually consulted, unlike stubbing matchMedia against a library that
// captures its own reference at import time.
function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function TestComponent({ log }: { log: boolean[] }) {
  const matches = useSSRSafeMediaQuery('(min-width: 1024px)');
  log.push(matches);
  return null;
}

describe('useSSRSafeMediaQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects a real match on the client', () => {
    stubMatchMedia(true);
    const log: boolean[] = [];
    render(<TestComponent log={log} />);

    expect(log[log.length - 1]).toBe(true);
  });

  it('reflects a real non-match on the client', () => {
    stubMatchMedia(false);
    const log: boolean[] = [];
    render(<TestComponent log={log} />);

    expect(log[log.length - 1]).toBe(false);
  });

  it('never touches window.matchMedia on the server snapshot, even when matchMedia is unavailable', () => {
    // Simulates a real SSR environment, where window.matchMedia doesn't
    // exist at all — this is the actual property that prevents the
    // hydration mismatch: getServerSnapshot is a hardcoded `false`, not a
    // best-effort guess that happens to also work without a real window.
    const original = window.matchMedia;
    // @ts-expect-error -- deliberately simulating an environment with no matchMedia
    delete window.matchMedia;

    expect(() => renderToString(<TestComponent log={[]} />)).not.toThrow();

    window.matchMedia = original;
  });
});
