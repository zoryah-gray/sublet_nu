// Domain types shared between apps/frontend and apps/backend.
// Canonical source for anything that must match the DB schema — see
// .claude/docs/sql.md. Frontend-only concerns (derived display labels,
// Tailwind style constants) stay in apps/frontend/app/lib/definitions.ts.

export type Quarter = 'Fall' | 'Winter' | 'Spring' | 'Summer';

/** Stored sublet visibility. Frontend derives a separate display label from this — see deriveSubletStatus in apps/frontend/app/lib/utils.ts. */
export type SubletDisplayStatus = 'public' | 'restricted' | 'private' | 'deleted';

export interface Sublet {
  id: string;
  title: string;
  /** Street line only, e.g. '1234 Hinman Ave'. Full display string: formatFullAddress in apps/frontend/app/lib/util-address.ts. */
  streetAddress: string;
  city: string;
  /** 2-letter code, e.g. 'IL'. */
  state: string;
  /** 5 digits, kept as a string so leading zeros survive. */
  zipCode: string;
  coords: { lat: number; lng: number };
  monthlyRent: number;
  /** 0 = studio. */
  bedroomCount: number;
  bathroomCount: number;
  quarters: Quarter[];
  startDate: string;
  endDate: string;
  description: string;
  imageHue: string;
  images?: string[];
  /** Set to images[0] at runtime if not explicitly provided. */
  featuredImage?: string;
  videos?: string[];
  placeType?: 'entire' | 'private';
  roommateCount?: number;
  utilitiesIncluded?: boolean;
  /** Estimated monthly utilities cost when not included in rent. */
  monthlyUtilitiesCost?: number;
  ownerId: string;

  displayStatus: SubletDisplayStatus;
  /** true = never gone public yet (a true draft). Flips to false, once, the first time displayStatus becomes 'public' — never flips back. */
  isDraft: boolean;
  /** Set when a match_request against this sublet reaches 'confirmed'. The one user, besides the owner, who can still see a 'restricted' sublet. */
  confirmedRenterId?: string;
}
