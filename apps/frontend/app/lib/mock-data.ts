// Re-export all domain types from the single source of truth.
// Import types from '@/app/lib/definitions' directly in new code;
// these re-exports exist for backward compatibility.
export type {
  Quarter,
  SortOrder,
  SubletStatus,
  SubletDisplayStatus,
  MatchStatus,
  NotificationKind,
  Sublet,
  MatchRequest,
  UserProfile,
  Notification,
  Thread,
  MessageMedia,
  Message,
  ListingFormData,
} from '@/app/lib/definitions';

import type {
  SortOrder,
  Sublet,
  MatchRequest,
  UserProfile,
  Notification,
  Thread,
  Message,
} from '@/app/lib/definitions';
import { formatApproximateStreet } from '@/app/lib/util-address';
import { matchesTermSelection, termBadges, type Term } from '@sublet-nu/shared';
import { ACADEMIC_TERMS } from '@/app/lib/academic-terms';

// The currently logged-in user (replace with real auth session later)
export const CURRENT_USER_ID = 'user-jon';

// Dates were shifted forward one year on 10/27/26 so listings fall in
// current/upcoming terms. Quarters aren't listed: they're derived from the
// dates (terms below), the same way the database derives them.
const MOCK_SUBLET_ROWS: Omit<Sublet, 'terms'>[] = [
  {
    id: '1',
    title: 'Sunny Studio Near Campus',
    streetAddress: '1234 Hinman Ave',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60202',
    coords: { lat: 42.0399533, lng: -87.6789093 },
    monthlyRent: 1200,
    bedroomCount: 0,
    bathroomCount: 1,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    description:
      'Cozy studio apartment just 5 minutes from Northwestern campus. Fully furnished with modern appliances, high-speed WiFi, and in-unit washer/dryer. Perfect for a student studying abroad or taking a quarter off.',
    imageHue: '230',
    images: [
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-artbovich-7019016.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 100,
    ownerId: 'user-jon',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '2',
    title: 'Modern 2BR in South Evanston',
    streetAddress: '567 Chicago Ave',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60202',
    coords: { lat: 42.0285498, lng: -87.6782254 },
    monthlyRent: 2100,
    bedroomCount: 2,
    bathroomCount: 1,
    startDate: '2027-03-15',
    endDate: '2027-08-31',
    description:
      'Spacious two-bedroom apartment with open floor plan, stainless steel appliances, and private deck. Close to the Purple Line and Whole Foods. Split between two for only $1,050/mo each.',
    imageHue: '250',
    images: [
      '/stock_images/pexels-artbovich-7511695.jpg',
      '/stock_images/pexels-umudicreative-37460692.jpg',
      '/stock_images/pexels-artbovich-7019016.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852529.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 160,
    ownerId: 'user-kelly',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '3',
    title: 'Cozy 1BR Near Downtown',
    streetAddress: '890 Church St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0483936, lng: -87.6983340 },
    monthlyRent: 1650,
    bedroomCount: 1,
    bathroomCount: 1,
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    description:
      'Charming one-bedroom in the heart of downtown Evanston. Walk to restaurants, shops, and the Davis Street Metra station. Hardwood floors, exposed brick, and tons of natural light.',
    imageHue: '210',
    images: [
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852536.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 120,
    ownerId: 'user-jon',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '4',
    title: 'Spacious 3BR House with Yard',
    streetAddress: '245 Greenwood St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60202',
    coords: { lat: 42.0426483, lng: -87.6735997 },
    monthlyRent: 3200,
    bedroomCount: 3,
    bathroomCount: 2,
    startDate: '2027-06-01',
    endDate: '2027-08-31',
    description:
      'Beautiful house with private backyard patio. Perfect for a group of students. Updated kitchen, two full bathrooms, ample storage, and driveway parking for two cars.',
    imageHue: '270',
    images: [
      '/stock_images/pexels-artbovich-7511695.jpg',
      '/stock_images/pexels-artbovich-7019016.jpg',
      '/stock_images/pexels-umudicreative-37460692.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852529.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-strangehappenings-11757075.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 250,
    ownerId: 'user-kelly',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '5',
    title: 'Lakeview Studio, Steps from Beach',
    streetAddress: '100 Sheridan Rd',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0605004, lng: -87.6770944 },
    monthlyRent: 1450,
    bedroomCount: 0,
    bathroomCount: 1,
    startDate: '2027-04-01',
    endDate: '2027-08-15',
    description:
      'Beautiful studio with partial lake views and direct beach access. Walking distance to Northwestern campus and the lakefront trail. Includes a rooftop deck.',
    imageHue: '195',
    images: [
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 90,
    ownerId: 'user-alex',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '6',
    title: 'Furnished 2BR Near Tech Campus',
    streetAddress: '320 Foster St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0539410, lng: -87.6836839 },
    monthlyRent: 1900,
    bedroomCount: 2,
    bathroomCount: 1,
    startDate: '2026-09-01',
    endDate: '2027-05-31',
    description:
      'Well-maintained two-bedroom fully furnished apartment. Utilities included, fast WiFi, and just a short walk to the Tech campus. Ideal for the full academic year.',
    imageHue: '245',
    images: [
      '/stock_images/pexels-artbovich-7019016.jpg',
      '/stock_images/pexels-artbovich-7511695.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852529.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852536.jpg',
      '/stock_images/pexels-umudicreative-37460692.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: true,
    ownerId: 'user-jon',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '7',
    title: 'Bright 1BR with Parking',
    streetAddress: '789 Ridge Ave',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60202',
    coords: { lat: 42.0519802, lng: -87.6799612 },
    monthlyRent: 1500,
    bedroomCount: 1,
    bathroomCount: 1,
    startDate: '2027-01-01',
    endDate: '2027-05-31',
    description:
      'Sunny one-bedroom with dedicated parking spot in the back lot. Pet-friendly, in-unit laundry, updated bathroom with walk-in shower.',
    imageHue: '220',
    images: [
      '/stock_images/pexels-umudicreative-37460692.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 110,
    ownerId: 'user-alex',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '8',
    title: 'Newly Renovated Studio',
    streetAddress: '456 Main St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60202',
    coords: { lat: 42.0338423, lng: -87.6771186 },
    monthlyRent: 1100,
    bedroomCount: 0,
    bathroomCount: 1,
    startDate: '2027-06-01',
    endDate: '2027-12-31',
    description:
      'Brand new renovations with stainless steel appliances, quartz countertops, and hardwood floors throughout. Building has a rooftop deck and fitness center.',
    imageHue: '260',
    images: [
      '/stock_images/pexels-artbovich-7511695.jpg',
      '/stock_images/pexels-artbovich-7019016.jpg',
      '/stock_images/pexels-strangehappenings-11757075.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 80,
    ownerId: 'user-jordan',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '9',
    title: '4BR House, Perfect for Groups',
    streetAddress: '1023 Dempster St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60202',
    coords: { lat: 42.0413283, lng: -87.6861941 },
    monthlyRent: 4000,
    bedroomCount: 4,
    bathroomCount: 2,
    startDate: '2027-06-01',
    endDate: '2027-08-31',
    description:
      'Large house perfect for groups of four. Two separate living rooms, fully stocked kitchen, backyard patio with grill. Only $1,000/person for summer.',
    imageHue: '200',
    images: [
      '/stock_images/pexels-artbovich-7019016.jpg',
      '/stock_images/pexels-umudicreative-37460692.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852529.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852536.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
      '/stock_images/pexels-strangehappenings-11757075.jpg',
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-artbovich-7511695.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 350,
    ownerId: 'user-jordan',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '10',
    title: 'Quiet 1BR Near Norris Center',
    streetAddress: '654 Emerson St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0519802, lng: -87.6799612 },
    monthlyRent: 1350,
    bedroomCount: 1,
    bathroomCount: 1,
    startDate: '2026-09-15',
    endDate: '2027-01-15',
    description:
      'Peaceful one-bedroom in a quiet building. Close to Norris Center, the main library, and multiple dining options. Bike storage available.',
    imageHue: '235',
    images: [
      '/stock_images/pexels-rachel-claire-5490367.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-artbovich-6447384.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 100,
    ownerId: 'user-maya',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '11',
    title: 'Stylish 2BR Loft',
    streetAddress: '333 Davis St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0452045, lng: -87.6755761 },
    monthlyRent: 2400,
    bedroomCount: 2,
    bathroomCount: 2,
    startDate: '2027-03-01',
    endDate: '2027-05-31',
    description:
      'Open loft-style apartment with exposed brick, 12-foot ceilings, and gourmet kitchen with island. Walking distance to the Davis Street L stop.',
    imageHue: '215',
    images: [
      '/stock_images/pexels-artbovich-7511695.jpg',
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-misbaa-eri-426041722-36852536.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-artbovich-7019016.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: false,
    monthlyUtilitiesCost: 175,
    ownerId: 'user-maya',
    displayStatus: 'private',
    isDraft: false,
  },
  {
    id: '12',
    title: 'Affordable Studio, Great Location',
    streetAddress: '777 Maple Ave',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0418248, lng: -87.6851034 },
    monthlyRent: 950,
    bedroomCount: 0,
    bathroomCount: 1,
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    description:
      'Budget-friendly studio available year-round. Utilities included, bicycle storage, and coin-op laundry in building. Great for anyone who needs flexibility.',
    imageHue: '240',
    images: [
      '/stock_images/pexels-artbovich-6447384.jpg',
      '/stock_images/pexels-nadin-sh-78971847-33537442.jpg',
      '/stock_images/pexels-rachel-claire-5490367.jpg',
    ],
    placeType: 'entire',
    utilitiesIncluded: true,
    ownerId: 'user-maya',
    displayStatus: 'public',
    isDraft: false,
  },
  {
    id: '13',
    title: 'Renovated 1BR, Utilities Included',
    streetAddress: '512 Noyes St',
    city: 'Evanston',
    state: 'IL',
    zipCode: '60201',
    coords: { lat: 42.0519802, lng: -87.6799612 },
    monthlyRent: 1750,
    bedroomCount: 1,
    bathroomCount: 1,
    startDate: '2027-01-01',
    endDate: '2027-05-31',
    description:
      'Fully renovated one-bedroom with all utilities included. Modern finishes, in-unit laundry, and a private deck. Steps from the Purple Line and downtown Evanston.',
    imageHue: '200',
    placeType: 'entire',
    utilitiesIncluded: true,
    ownerId: 'user-jon',
    displayStatus: 'restricted',
    isDraft: false,
    confirmedRenterId: 'user-kelly',
  },
];

export const MOCK_SUBLETS: Sublet[] = MOCK_SUBLET_ROWS.map((sublet) => ({
  ...sublet,
  terms: termBadges(sublet.startDate, sublet.endDate, ACADEMIC_TERMS),
}));

// Derive featuredImage from the first gallery image for every sublet that has one.
MOCK_SUBLETS.forEach((s) => {
  if (s.images?.length && !s.featuredImage) s.featuredImage = s.images[0];
});

export { ITEMS_PER_PAGE } from '@/app/lib/definitions';

// ─── User Profiles ────────────────────────────────────────────────────────────

export const MOCK_USER_PROFILES: UserProfile[] = [
  { id: 'user-jon',    name: 'Jon Doe',      email: 'jonodono@gmail.com',              bio: "NU '27, Kellogg MBA student. Subletting my place while on exchange.",                   isPublic: true,  joinedAt: '2024-09-01', avatarInitials: 'JD' },
  { id: 'user-kelly',  name: 'Kelly Tween',  email: 'kelly.tween@u.northwestern.edu',  bio: "McCormick '26. Looking for a place for Fall quarter near tech campus.",                 isPublic: true,  joinedAt: '2024-09-15', avatarInitials: 'KT' },
  { id: 'user-alex',   name: 'Alex Park',    email: 'alex.park@u.northwestern.edu',    bio: "Weinberg '25. Subletting my studio while studying abroad in Seoul.",                    isPublic: true,  joinedAt: '2023-09-01', avatarInitials: 'AP' },
  { id: 'user-jordan', name: 'Jordan Lee',   email: 'jordan.lee@u.northwestern.edu',   bio: "Medill '26. Profile is private.",                                                       isPublic: false, joinedAt: '2024-01-10', avatarInitials: 'JL' },
  { id: 'user-maya',   name: 'Maya Patel',   email: 'maya.patel@u.northwestern.edu',   bio: "SESP '27. Have three listings available across Evanston neighborhoods.",                isPublic: true,  joinedAt: '2024-06-05', avatarInitials: 'MP' },
];

// ─── Match Requests ───────────────────────────────────────────────────────────

export const MOCK_MATCH_REQUESTS: MatchRequest[] = [
  // Requests TO Jon's listings (shown in his dashboard / listings)
  {
    id: 'mr1',
    subletId: '1',
    subletTitle: 'Sunny Studio Near Campus',
    ownerId: 'user-jon',
    requesterId: 'user-kelly',
    requesterName: 'Kelly Tween',
    requesterInitials: 'KT',
    requesterEmail: 'kelly.tween@u.northwestern.edu',
    isRequesterPublic: true,
    message: 'Hey, I wanted to talk about the subletting details for your Sunny Studio listing. Is parking included? Also, are pets allowed?',
    status: 'pending',
    createdAt: '2026-05-31T10:22:00',
  },
  {
    id: 'mr2',
    subletId: '1',
    subletTitle: 'Sunny Studio Near Campus',
    ownerId: 'user-jon',
    requesterId: 'user-alex',
    requesterName: 'Alex Park',
    requesterInitials: 'AP',
    requesterEmail: 'alex.park@u.northwestern.edu',
    isRequesterPublic: true,
    message: 'Is the unit still available for Fall quarter? I can move in September 1st and am flexible on end date.',
    status: 'accepted',
    createdAt: '2026-05-30T09:10:00',
    threadId: 't2',
  },
  {
    id: 'mr3',
    subletId: '3',
    subletTitle: 'Cozy 1BR Near Downtown',
    ownerId: 'user-jon',
    requesterId: 'user-jordan',
    requesterName: 'Jordan Lee',
    requesterInitials: 'JL',
    requesterEmail: 'jordan.lee@u.northwestern.edu',
    isRequesterPublic: false,
    message: '',
    status: 'pending',
    createdAt: '2026-06-01T08:45:00',
  },
  {
    id: 'mr4',
    subletId: '6',
    subletTitle: 'Furnished 2BR Near Tech Campus',
    ownerId: 'user-jon',
    requesterId: 'user-maya',
    requesterName: 'Maya Patel',
    requesterInitials: 'MP',
    requesterEmail: 'maya.patel@u.northwestern.edu',
    isRequesterPublic: true,
    message: "I'm looking for a Fall–Spring sublet for two people. Is the second bedroom furnished as well?",
    status: 'declined',
    createdAt: '2026-05-28T14:30:00',
  },
  // Requests FROM Jon to other listings (shown on those sublet detail pages / browse)
  {
    id: 'mr5',
    subletId: '2',
    subletTitle: 'Modern 2BR in South Evanston',
    ownerId: 'user-kelly',
    requesterId: 'user-jon',
    requesterName: 'Jon Doe',
    requesterInitials: 'JD',
    requesterEmail: 'jonodono@gmail.com',
    isRequesterPublic: true,
    message: "Hi! I'm interested in the Spring sublet. I have references from my current building.",
    status: 'pending',
    createdAt: '2026-06-01T11:00:00',
  },
  {
    id: 'mr6',
    subletId: '5',
    subletTitle: 'Lakeview Studio, Steps from Beach',
    ownerId: 'user-alex',
    requesterId: 'user-jon',
    requesterName: 'Jon Doe',
    requesterInitials: 'JD',
    requesterEmail: 'jonodono@gmail.com',
    isRequesterPublic: true,
    message: '',
    status: 'accepted',
    createdAt: '2026-05-29T16:20:00',
    threadId: 't3',
  },
  {
    id: 'mr7',
    subletId: '13',
    subletTitle: 'Renovated 1BR, Utilities Included',
    ownerId: 'user-jon',
    requesterId: 'user-kelly',
    requesterName: 'Kelly Tween',
    requesterInitials: 'KT',
    requesterEmail: 'kelly.tween@u.northwestern.edu',
    isRequesterPublic: true,
    message: 'Looking forward to subletting! See you in January.',
    status: 'confirmed',
    createdAt: '2026-05-20T09:00:00',
    threadId: 't4',
  },
];

// ─── Favorites ────────────────────────────────────────────────────────────────

export const MOCK_FAVORITE_IDS = ['5', '7', '2'];
export const MOCK_FAVORITE_SUBLETS = MOCK_SUBLETS.filter((s) =>
  MOCK_FAVORITE_IDS.includes(s.id)
);

// ─── Notifications ────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    kind: 'match_request_received',
    title: 'New subletting request',
    body: 'Kelly Tween sent a request for your Sunny Studio Near Campus listing.',
    timestamp: '2026-05-31T10:30:00',
    read: false,
  },
  {
    id: 'n2',
    kind: 'match_request_accepted',
    title: 'Request accepted',
    body: 'Your request for Modern 2BR in South Evanston was accepted. Reach out to confirm details.',
    timestamp: '2026-05-31T08:15:00',
    read: false,
  },
  {
    id: 'n3',
    kind: 'new_message',
    title: 'New message from Alex Park',
    body: 'Hey, I wanted to ask about the availability for the Fall quarter...',
    timestamp: '2026-05-30T21:45:00',
    read: true,
  },
];

// ─── Messages ─────────────────────────────────────────────────────────────────

export const MOCK_THREADS: Thread[] = [
  { id: 't1', name: 'Kelly Tween',    email: 'kelly.tween@u.northwestern.edu',  initials: 'KT', preview: 'Hey, I wanted to talk about the subletting details…',         timestamp: '10 min ago',  unread: 2, userId: 'user-kelly'   },
  { id: 't2', name: 'Alex Park',      email: 'alex.park@u.northwestern.edu',    initials: 'AP', preview: 'Is the unit still available for Fall quarter?',                 timestamp: '1 hr ago',    unread: 1, userId: 'user-alex'    },
  { id: 't3', name: 'Jordan Lee',     email: 'jordan.lee@u.northwestern.edu',   initials: 'JL', preview: 'Sounds good, let me know if you have any questions.',           timestamp: 'Yesterday',   unread: 0, userId: 'user-jordan'  },
  { id: 't4', name: 'Maya Patel',     email: 'maya.patel@u.northwestern.edu',   initials: 'MP', preview: 'Can I schedule a time to see the place this week?',             timestamp: 'Yesterday',   unread: 0, userId: 'user-maya'    },
  { id: 't5', name: 'Chris Nguyen',   email: 'chris.nguyen@u.northwestern.edu', initials: 'CN', preview: "Thanks for the quick response! I'll follow up soon.",           timestamp: 'Mon',         unread: 0, userId: 'user-chris'   },
  { id: 't6', name: 'Sam Torres',     email: 'sam.torres@u.northwestern.edu',   initials: 'ST', preview: 'Do utilities come included with the rent?',                      timestamp: 'Sun',         unread: 0, userId: 'user-sam'     },
  { id: 't7', name: 'Priya Sharma',   email: 'priya.sharma@u.northwestern.edu', initials: 'PS', preview: "Perfect, I'll bring a co-signer as requested.",                 timestamp: 'May 28',      unread: 0, userId: 'user-priya'   },
  { id: 't8', name: 'Drew Mitchell',  email: 'drew.mitchell@u.northwestern.edu',initials: 'DM', preview: "Hey! Just confirming we're still on for the tour.",             timestamp: 'May 26',      unread: 0, userId: 'user-drew'    },
];

export const MOCK_MESSAGES: Message[] = [
  { id: 'm1',  threadId: 't1', fromMe: false, body: 'Hey, I wanted to talk about the subletting details for your Sunny Studio listing.',            timestamp: '10:22 AM' },
  { id: 'm2',  threadId: 't1', fromMe: true,  body: 'Hi Kelly! Sure, happy to chat. What would you like to know?',                                  timestamp: '10:25 AM' },
  { id: 'm3',  threadId: 't1', fromMe: false, body: 'Is parking included? Also, are pets allowed?',                                                  timestamp: '10:27 AM' },
  { id: 'm4',  threadId: 't1', fromMe: true,  body: 'Parking is street only, unfortunately. The building is pet-free, though.',                      timestamp: '10:29 AM' },
  { id: 'm5',  threadId: 't1', fromMe: false, body: 'Got it. And is the price negotiable at all?',                                                   timestamp: '10:31 AM' },

  { id: 'm6',  threadId: 't2', fromMe: false, body: 'Is the unit still available for Fall quarter?',                                                 timestamp: '9:10 AM' },
  { id: 'm7',  threadId: 't2', fromMe: true,  body: "Yes, it's available September through December. Interested?",                                   timestamp: '9:45 AM' },

  { id: 'm8',  threadId: 't3', fromMe: true,  body: 'Just confirming the lease starts September 1st.',                                               timestamp: 'Yesterday 3:00 PM' },
  { id: 'm9',  threadId: 't3', fromMe: false, body: 'Sounds good, let me know if you have any questions.',                                           timestamp: 'Yesterday 3:15 PM' },

  { id: 'm10', threadId: 't4', fromMe: false, body: 'Can I schedule a time to see the place this week?',                                             timestamp: 'Yesterday 11:00 AM' },
  { id: 'm11', threadId: 't4', fromMe: true,  body: 'Absolutely! How does Thursday at 4pm work for you?',                                            timestamp: 'Yesterday 11:30 AM' },
];

/** Mock /browse query: the same filters searchSublets applies, run over MOCK_SUBLETS. */
export function getFilteredSublets({
  terms,
  minPrice,
  maxPrice,
  sortOrder,
  query,
}: {
  /** A validated, contiguous selection (parseTermParam). */
  terms?: Term[];
  minPrice?: number;
  maxPrice?: number;
  sortOrder?: SortOrder;
  query?: string;
}): Sublet[] {
  let results = MOCK_SUBLETS.filter(s => s.displayStatus === 'public');

  if (query && query.trim()) {
    const q = query.toLowerCase();
    results = results.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        formatApproximateStreet(s.streetAddress).toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
    );
  }

  if (terms && terms.length > 0) {
    results = results.filter((s) => matchesTermSelection(s.startDate, s.endDate, terms, ACADEMIC_TERMS));
  }

  if (minPrice !== undefined) {
    results = results.filter((s) => s.monthlyRent >= minPrice);
  }

  if (maxPrice !== undefined) {
    results = results.filter((s) => s.monthlyRent <= maxPrice);
  }

  if (sortOrder === 'asc') {
    results.sort((a, b) => a.monthlyRent - b.monthlyRent);
  } else if (sortOrder === 'desc') {
    results.sort((a, b) => b.monthlyRent - a.monthlyRent);
  }

  return results;
}
