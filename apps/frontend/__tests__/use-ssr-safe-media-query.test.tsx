import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useSSRSafeMediaQuery } from '@/app/lib/utils';

// Deterministic matchMedia stub — happy-dom's own implementation isn't a
// reliable source of truth for min/max-width matching logic, and the whole
// point of this test is controlling exactly what the "real" client value is.
function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function TestComponent({ log }: { log: boolean[] }) {
  const matches = useSSRSafeMediaQuery({ minWidth: 1024 });
  // Pushed synchronously during render — before any effect has run — so the
  // very first entry captures what hydration would actually compare against.
  log.push(matches);
  return null;
}

describe('useSSRSafeMediaQuery', () => {
  beforeEach(() => {
    stubMatchMedia(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false on the initial render, even though the real query already matches', () => {
    const log: boolean[] = [];
    render(<TestComponent log={log} />);

    expect(log[0]).toBe(false);
  });

  it('reflects the real match after the mount effect flushes', () => {
    const log: boolean[] = [];
    render(<TestComponent log={log} />);

    expect(log[log.length - 1]).toBe(true);
  });

  it('stays false after mount when the query does not match', () => {
    stubMatchMedia(false);
    const log: boolean[] = [];
    render(<TestComponent log={log} />);

    expect(log[log.length - 1]).toBe(false);
  });
});
