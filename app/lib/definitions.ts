// ─── Domain types ─────────────────────────────────────────────────────────────
//
// Single source of truth for every data shape used across the app.
// When a real database is connected, these types should map 1-to-1
// with the DB schema. Mock data in mock-data.ts must satisfy these shapes.

import { LatLngExpression } from "leaflet";

// ─── Enums / unions ───────────────────────────────────────────────────────────

export type Quarter     = 'Fall' | 'Winter' | 'Spring' | 'Summer';
export type SortOrder   = 'asc' | 'desc' | 'new';
/** Display label derived from a sublet's stored `displayStatus`/`isDraft` — see `deriveSubletStatus` in utils.ts. Not stored directly. */
export type SubletStatus = 'active' | 'archived' | 'draft' | 'rented';
export type MatchStatus = 'pending' | 'accepted' | 'declined' | 'confirmed' | 'cancelled' | 'listing_removed';
export type NotificationKind =
  | 'match_request_received'
  | 'match_request_accepted'
  | 'match_request_declined'
  | 'match_request_cancelled'
  | 'match_request_confirmed'
  | 'match_request_listing_removed'
  | 'new_message'
  | 'favorited_sublet_updated';
/** Stored sublet visibility. `SubletStatus` above is what the UI derives from it. */
export type SubletDisplayStatus = 'public' | 'restricted' | 'private' | 'deleted';

// ─── Sublet ───────────────────────────────────────────────────────────────────

export interface Sublet {
  id: string;
  title: string;
  address: string;
  coords: LatLngExpression;
  neighborhood: string;
  price: number;
  beds: number;
  baths: number;
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
  roommates?: number;
  utilitiesIncluded?: boolean;
  /** Estimated monthly utilities cost when not included in rent. */
  utilitiesCost?: number;
  ownerId: string;

  displayStatus: SubletDisplayStatus;
  /** true = never gone public yet (a true draft). Flips to false, once, the first time displayStatus becomes 'public' — never flips back. */
  isDraft: boolean;
  /** Set when a match_request against this sublet reaches 'confirmed'. The one user, besides the owner, who can still see a 'restricted' sublet. */
  confirmedRenterId?: string;
}

export const ITEMS_PER_PAGE = 6;

// ─── Display constants ────────────────────────────────────────────────────────

/** Pill badge background + text classes for quarter tags on cards. */
export const QUARTER_COLORS: Record<Quarter, string> = {
  Fall:   'bg-amber-50 text-amber-700 border-amber-200',
  Winter: 'bg-sky-50 text-sky-700 border-sky-200',
  Spring: 'bg-green-50 text-green-700 border-green-200',
  Summer: 'bg-orange-50 text-orange-700 border-orange-200',
};

/** Pill badge background + text classes for MatchRequest status. */
export const MATCH_STATUS_STYLES: Record<MatchStatus, string> = {
  pending:         'bg-amber-50 text-amber-700',
  accepted:        'bg-green-50 text-green-700',
  declined:        'bg-red-50 text-red-700',
  confirmed:       'bg-violet-50 text-violet-700',
  cancelled:       'bg-gray-100 text-gray-400',
  listing_removed: 'bg-gray-100 text-gray-500',
};

/** Human-readable display labels for MatchRequest status. */
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  pending:         'Pending',
  accepted:        'Accepted',
  declined:        'Declined',
  confirmed:       'Confirmed',
  cancelled:       'Withdrawn',
  listing_removed: 'Listing Removed',
};

/** Pill badge background + text classes for Sublet status. */
export const SUBLET_STATUS_STYLES: Record<SubletStatus, string> = {
  active:   'bg-green-50 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
  draft:    'bg-amber-50 text-amber-700',
  rented:   'bg-violet-50 text-violet-700',
};

/** Human-readable display labels for Sublet status. */
export const SUBLET_STATUS_LABELS: Record<SubletStatus, string> = {
  active:   'Active',
  archived: 'Archived',
  draft:    'Draft',
  rented:   'Rented',
};

// ─── Match request ────────────────────────────────────────────────────────────

export interface MatchRequest {
  id: string;
  subletId: string;
  subletTitle: string;
  ownerId: string;
  requesterId: string;
  requesterName: string;
  requesterInitials: string;
  requesterEmail: string;
  isRequesterPublic: boolean;
  message: string;
  status: MatchStatus;
  createdAt: string;
  /** Set when the owner accepts the request — links to a message thread. */
  threadId?: string;
}

/** A match request enriched with sublet price and owner profile, plus the current user's role. */
export type EnrichedRequest = MatchRequest & {
  price: number;
  ownerName: string;
  isOwnerPublic: boolean;
  role: 'received' | 'sent';
};

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  isPublic: boolean;
  joinedAt: string;
  avatarInitials: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Thread {
  id: string;
  name: string;
  email: string;
  initials: string;
  preview: string;
  timestamp: string;
  unread: number;
  userId?: string;
}

export interface MessageMedia {
  type: 'image' | 'video';
  url: string;
  name: string;
}

export interface Message {
  id: string;
  threadId: string;
  fromMe: boolean;
  body: string;
  timestamp: string;
  media?: MessageMedia[];
}

// ─── Listing form ─────────────────────────────────────────────────────────────

export interface ListingFormData {
  placeType: 'entire' | 'private';
  roommates: number;
  address: string;
  neighborhood: string;
  beds: number;
  baths: number;
  price: number;
  utilitiesIncluded: boolean;
  utilitiesCost: number;
  quartersAvailable: Quarter[];
  startDate: string;
  endDate: string;
  title: string;
  description: string;
}

export interface EditProfileFormProps {
  initialName: string;
  initialBio: string;
}

export interface ConfirmSubletButtonProps {
  requesterName: string;
  onConfirm: () => void;
}

// ─── Map Constants ─────────────────────────────────────────────────────────────
export const EVANSTON_COORDINATES = [42.056828,-87.687217] satisfies LatLngExpression;