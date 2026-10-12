import { describe, it, expect } from 'vitest';
import {
  approximateCoords,
  APPROXIMATE_RADIUS_METERS,
  canSeeExactAddress,
  filterInViewport,
  formatApproximateAddress,
  formatApproximateStreet,
  toPublicSublet,
} from '@/app/lib/util-address';
import { MOCK_SUBLETS } from '@/app/lib/mock-data';

/** Great-circle distance in meters between two lat/lng points (haversine). */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

describe('formatApproximateStreet', () => {
  it('rounds the house number down to its hundred block', () => {
    expect(formatApproximateStreet('1234 Hinman Ave')).toBe('1200 block of Hinman Ave');
    expect(formatApproximateStreet('567 Chicago Ave')).toBe('500 block of Chicago Ave');
    expect(formatApproximateStreet('100 Sheridan Rd')).toBe('100 block of Sheridan Rd');
  });

  it('falls back to the street name for numbers under 100 and for addresses without a number', () => {
    expect(formatApproximateStreet('42 Main St')).toBe('Main St');
    expect(formatApproximateStreet('Sheridan Rd')).toBe('Sheridan Rd');
  });

  it('never contains the original house number', () => {
    for (const sublet of MOCK_SUBLETS) {
      const houseNumber = sublet.streetAddress.split(' ')[0];
      const approximate = formatApproximateAddress(sublet);
      expect(approximate).not.toContain(sublet.streetAddress);
      if (Number(houseNumber) % 100 !== 0) expect(approximate).not.toContain(houseNumber);
    }
  });
});

describe('canSeeExactAddress', () => {
  const sublet = { ownerId: 'user-owner', confirmedRenterId: 'user-renter' };

  it('allows the owner and the confirmed renter', () => {
    expect(canSeeExactAddress(sublet, 'user-owner')).toBe(true);
    expect(canSeeExactAddress(sublet, 'user-renter')).toBe(true);
  });

  it('authorization failure: denies any other student', () => {
    expect(canSeeExactAddress(sublet, 'user-stranger')).toBe(false);
  });

  it('denies everyone but the owner while no match is confirmed', () => {
    expect(canSeeExactAddress({ ownerId: 'user-owner' }, 'user-stranger')).toBe(false);
  });
});

describe('approximateCoords', () => {
  it('moves every mock listing off its exact point, but keeps it inside the displayed circle', () => {
    for (const sublet of MOCK_SUBLETS) {
      const approx = approximateCoords(sublet.coords);
      expect(approx).not.toEqual(sublet.coords);
      expect(distanceMeters(approx, sublet.coords)).toBeLessThan(APPROXIMATE_RADIUS_METERS);
    }
  });

  it('is deterministic, so repeated page loads cannot be averaged back to the exact point', () => {
    const coords = { lat: 42.0399533, lng: -87.6789093 };
    expect(approximateCoords(coords)).toEqual(approximateCoords(coords));
  });

  it('maps nearby points in the same grid cell to the same center', () => {
    expect(approximateCoords({ lat: 42.0391, lng: -87.6781 })).toEqual(approximateCoords({ lat: 42.0399, lng: -87.6789 }));
  });
});

describe('toPublicSublet', () => {
  it('removes the exact street address from the object itself, not just its type', () => {
    for (const sublet of MOCK_SUBLETS) {
      const publicSublet = toPublicSublet(sublet);
      expect(publicSublet).not.toHaveProperty('streetAddress');
      expect(JSON.stringify(publicSublet)).not.toContain(sublet.streetAddress);
      expect(publicSublet.coords).toEqual(approximateCoords(sublet.coords));
      expect(publicSublet.city).toBe(sublet.city);
    }
  });

  it('snapping is idempotent, so the map can re-snap already-public coords safely', () => {
    for (const sublet of MOCK_SUBLETS) {
      const once = approximateCoords(sublet.coords);
      expect(approximateCoords(once)).toEqual(once);
    }
  });
});

describe('filterInViewport', () => {
  const viewport = { zoom: 15, west: -87.70, south: 42.03, east: -87.66, north: 42.07 };
  const point = (lat: number, lng: number) => ({ center: { lat, lng } });

  it('keeps points inside the bounds and drops points outside', () => {
    const inside = point(42.05, -87.68);
    const outside = point(42.10, -87.68);
    expect(filterInViewport([inside, outside], viewport, 14)).toEqual([inside]);
  });

  it('returns nothing below the minimum zoom, or before the map reports a viewport', () => {
    expect(filterInViewport([point(42.05, -87.68)], { ...viewport, zoom: 13 }, 14)).toEqual([]);
    expect(filterInViewport([point(42.05, -87.68)], null, 14)).toEqual([]);
  });

  it('stress: 5,000 listings spread across Chicagoland filter correctly and quickly', () => {
    // Deterministic pseudo-random spread (no Math.random) so failures reproduce.
    const items = Array.from({ length: 5000 }, (_, i) =>
      point(41.8 + ((i * 7919) % 5000) / 5000 * 0.4, -87.9 + ((i * 104729) % 5000) / 5000 * 0.4),
    );
    const expected = items.filter(({ center }) =>
      center.lat >= viewport.south && center.lat <= viewport.north && center.lng >= viewport.west && center.lng <= viewport.east,
    ).length;

    const start = performance.now();
    const visible = filterInViewport(items, viewport, 14);
    const elapsedMs = performance.now() - start;

    expect(expected).toBeGreaterThan(0);
    expect(visible).toHaveLength(expected);
    expect(visible.length).toBeLessThan(items.length / 10);
    expect(elapsedMs).toBeLessThan(50);
  });
});
