import { describe, it, expect } from 'vitest';
import { deriveSubletStatus } from '@/app/lib/utils';

describe('deriveSubletStatus', () => {
  it('maps public to active', () => {
    expect(deriveSubletStatus({ displayStatus: 'public', isDraft: false })).toBe('active');
  });

  it('maps restricted to rented', () => {
    expect(deriveSubletStatus({ displayStatus: 'restricted', isDraft: false })).toBe('rented');
  });

  it('maps private + isDraft true to draft', () => {
    expect(deriveSubletStatus({ displayStatus: 'private', isDraft: true })).toBe('draft');
  });

  it('maps private + isDraft false to archived', () => {
    expect(deriveSubletStatus({ displayStatus: 'private', isDraft: false })).toBe('archived');
  });

  it('maps deleted to null so callers can filter it out', () => {
    expect(deriveSubletStatus({ displayStatus: 'deleted', isDraft: false })).toBeNull();
  });
});
