// Address formatting and privacy. Kept out of utils.ts on purpose: utils.ts
// imports a React hook (useSyncExternalStore), which Next refuses to bundle
// into a Server Component — and the sublet detail page, a Server Component,
// needs this.
//
// Privacy rule (.claude/docs/security-review.md): a listing's exact address is
// visible only to its owner and its confirmed renter. Everyone else gets the
// block-level address and an approximate map area.

import { approximateCoords, formatApproximateStreet } from '@sublet-nu/shared';
import type { PublicSublet, Sublet } from './definitions';

// The masking rules themselves live in packages/shared so the database's
// generated columns can be tested against the same code; re-exported here so
// existing imports keep working.
export { approximateCoords, APPROXIMATE_RADIUS_METERS, formatApproximateStreet, GRID_DEGREES } from '@sublet-nu/shared';

type AddressParts = Pick<Sublet, 'streetAddress' | 'city' | 'state' | 'zipCode'>;

/** Joins the split address columns into one display line, e.g. "1234 Hinman Ave, Evanston, IL 60202". */
export function formatFullAddress(sublet: AddressParts): string {
  return `${sublet.streetAddress}, ${sublet.city}, ${sublet.state} ${sublet.zipCode}`;
}

/** Block-level display line, e.g. "1200 block of Hinman Ave, Evanston, IL 60202". */
export function formatApproximateAddress(sublet: AddressParts): string {
  return `${formatApproximateStreet(sublet.streetAddress)}, ${sublet.city}, ${sublet.state} ${sublet.zipCode}`;
}

/** True for the owner and, once a match is confirmed, the confirmed renter. */
export function canSeeExactAddress(sublet: Pick<Sublet, 'ownerId' | 'confirmedRenterId'>, userId: string): boolean {
  return sublet.ownerId === userId || sublet.confirmedRenterId === userId;
}

/**
 * Strips what a non-owner must not receive. Call it in Server Components before
 * passing other students' listings to Client Components — client props are
 * serialized into the page payload, so hiding a field in the UI isn't enough.
 */
export function toPublicSublet(sublet: Sublet): PublicSublet {
  // Destructured only to leave it out of the object sent to the browser.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { streetAddress, ...publicFields } = sublet;
  return { ...publicFields, coords: approximateCoords(sublet.coords) };
}

export type MapViewport = { zoom: number; west: number; south: number; east: number; north: number };

/**
 * The items whose map point falls inside the viewport, or none below minZoom.
 * Used to draw approximate-area circles only where the user is looking, so a
 * map with hundreds of listings draws a handful of circles at a time.
 */
export function filterInViewport<T extends { center: Sublet['coords'] }>(items: T[], viewport: MapViewport | null, minZoom: number): T[] {
  if (!viewport || viewport.zoom < minZoom) return [];
  return items.filter(({ center }) =>
    center.lat >= viewport.south && center.lat <= viewport.north &&
    center.lng >= viewport.west && center.lng <= viewport.east,
  );
}
