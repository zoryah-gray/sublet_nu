// Address-privacy rules shared by the frontend and the database.
//
// The database derives the same values as generated columns
// (apps/backend/db/migrations/1793032424185_add-public-safe-columns.mjs:
// approx_coordinates, approximate_street). These two implementations MUST stay
// identical — the backend DB test asserts parity, so changing one without the
// other fails CI.

export type Coords = { lat: number; lng: number };

// Grid size for approximate map locations: 0.001° is ~111m north-south and
// ~83m east-west at Evanston's latitude (42°N).
export const GRID_DEGREES = 0.001;

/**
 * Center of the 0.001° grid cell containing the point. Deterministic, so the
 * same listing always lands in the same place — random jitter would leak the
 * true point once enough page loads were averaged.
 */
export function approximateCoords(coords: Coords): Coords {
  const snap = (value: number) => Math.floor(value / GRID_DEGREES) * GRID_DEGREES + GRID_DEGREES / 2;
  return { lat: snap(coords.lat), lng: snap(coords.lng) };
}

// The true point is at most half a cell's diagonal (~69m) from the cell
// center, so a 200m circle around approximateCoords() always contains it.
export const APPROXIMATE_RADIUS_METERS = 200;

/**
 * Rounds the house number down to its hundred block: "1234 Hinman Ave" -> "1200 block of Hinman Ave".
 * Numbers under 100, or a street with no leading number, fall back to the street name alone.
 */
export function formatApproximateStreet(streetAddress: string): string {
  const match = streetAddress.trim().match(/^(\d+)\s+(.+)$/);
  if (!match) return streetAddress.trim();

  const block = Math.floor(Number(match[1]) / 100) * 100;
  return block === 0 ? match[2] : `${block} block of ${match[2]}`;
}
