export type Season = 'Fall' | 'Winter' | 'Spring' | 'Summer';
export type SortOrder = 'asc' | 'desc' | 'new';

export interface Sublet {
  id: string;
  title: string;
  address: string;
  neighborhood: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  seasons: Season[];
  startDate: string;
  endDate: string;
  description: string;
  imageHue: string;
}

export const MOCK_SUBLETS: Sublet[] = [
  {
    id: '1',
    title: 'Sunny Studio Near Campus',
    address: '1234 Hinman Ave, Evanston, IL',
    neighborhood: 'Central Evanston',
    price: 1200,
    beds: 0,
    baths: 1,
    sqft: 450,
    seasons: ['Fall', 'Winter'],
    startDate: '2025-09-01',
    endDate: '2025-12-31',
    description:
      'Cozy studio apartment just 5 minutes from Northwestern campus. Fully furnished with modern appliances, high-speed WiFi, and in-unit washer/dryer. Perfect for a student studying abroad or taking a quarter off.',
    imageHue: '230',
  },
  {
    id: '2',
    title: 'Modern 2BR in South Evanston',
    address: '567 Chicago Ave, Evanston, IL',
    neighborhood: 'South Evanston',
    price: 2100,
    beds: 2,
    baths: 1,
    sqft: 850,
    seasons: ['Spring', 'Summer'],
    startDate: '2026-03-15',
    endDate: '2026-08-31',
    description:
      'Spacious two-bedroom apartment with open floor plan, stainless steel appliances, and private deck. Close to the Purple Line and Whole Foods. Split between two for only $1,050/mo each.',
    imageHue: '250',
  },
  {
    id: '3',
    title: 'Cozy 1BR Near Downtown',
    address: '890 Church St, Evanston, IL',
    neighborhood: 'Downtown Evanston',
    price: 1650,
    beds: 1,
    baths: 1,
    sqft: 620,
    seasons: ['Fall'],
    startDate: '2025-09-01',
    endDate: '2025-11-30',
    description:
      'Charming one-bedroom in the heart of downtown Evanston. Walk to restaurants, shops, and the Davis Street Metra station. Hardwood floors, exposed brick, and tons of natural light.',
    imageHue: '210',
  },
  {
    id: '4',
    title: 'Spacious 3BR House with Yard',
    address: '245 Greenwood St, Evanston, IL',
    neighborhood: 'West Evanston',
    price: 3200,
    beds: 3,
    baths: 2,
    sqft: 1400,
    seasons: ['Summer'],
    startDate: '2026-06-01',
    endDate: '2026-08-31',
    description:
      'Beautiful house with private backyard patio. Perfect for a group of students. Updated kitchen, two full bathrooms, ample storage, and driveway parking for two cars.',
    imageHue: '270',
  },
  {
    id: '5',
    title: 'Lakeview Studio, Steps from Beach',
    address: '100 Sheridan Rd, Evanston, IL',
    neighborhood: 'Lakefront',
    price: 1450,
    beds: 0,
    baths: 1,
    sqft: 380,
    seasons: ['Spring', 'Summer'],
    startDate: '2026-04-01',
    endDate: '2026-08-15',
    description:
      'Beautiful studio with partial lake views and direct beach access. Walking distance to Northwestern campus and the lakefront trail. Includes a rooftop deck.',
    imageHue: '195',
  },
  {
    id: '6',
    title: 'Furnished 2BR Near Tech Campus',
    address: '320 Foster St, Evanston, IL',
    neighborhood: 'North Evanston',
    price: 1900,
    beds: 2,
    baths: 1,
    sqft: 780,
    seasons: ['Fall', 'Winter', 'Spring'],
    startDate: '2025-09-01',
    endDate: '2026-05-31',
    description:
      'Well-maintained two-bedroom fully furnished apartment. Utilities included, fast WiFi, and just a short walk to the Tech campus. Ideal for the full academic year.',
    imageHue: '245',
  },
  {
    id: '7',
    title: 'Bright 1BR with Parking',
    address: '789 Ridge Ave, Evanston, IL',
    neighborhood: 'Central Evanston',
    price: 1500,
    beds: 1,
    baths: 1,
    sqft: 550,
    seasons: ['Winter', 'Spring'],
    startDate: '2026-01-01',
    endDate: '2026-05-31',
    description:
      'Sunny one-bedroom with dedicated parking spot in the back lot. Pet-friendly, in-unit laundry, updated bathroom with walk-in shower.',
    imageHue: '220',
  },
  {
    id: '8',
    title: 'Newly Renovated Studio',
    address: '456 Main St, Evanston, IL',
    neighborhood: 'Downtown Evanston',
    price: 1100,
    beds: 0,
    baths: 1,
    sqft: 400,
    seasons: ['Summer', 'Fall'],
    startDate: '2026-06-01',
    endDate: '2026-12-31',
    description:
      'Brand new renovations with stainless steel appliances, quartz countertops, and hardwood floors throughout. Building has a rooftop deck and fitness center.',
    imageHue: '260',
  },
  {
    id: '9',
    title: '4BR House, Perfect for Groups',
    address: '1023 Dempster St, Evanston, IL',
    neighborhood: 'South Evanston',
    price: 4000,
    beds: 4,
    baths: 2,
    sqft: 1800,
    seasons: ['Summer'],
    startDate: '2026-06-01',
    endDate: '2026-08-31',
    description:
      'Large house perfect for groups of four. Two separate living rooms, fully stocked kitchen, backyard patio with grill. Only $1,000/person for summer.',
    imageHue: '200',
  },
  {
    id: '10',
    title: 'Quiet 1BR Near Norris Center',
    address: '654 Emerson St, Evanston, IL',
    neighborhood: 'Central Evanston',
    price: 1350,
    beds: 1,
    baths: 1,
    sqft: 500,
    seasons: ['Fall', 'Winter'],
    startDate: '2025-09-15',
    endDate: '2026-01-15',
    description:
      'Peaceful one-bedroom in a quiet building. Close to Norris Center, the main library, and multiple dining options. Bike storage available.',
    imageHue: '235',
  },
  {
    id: '11',
    title: 'Stylish 2BR Loft',
    address: '333 Davis St, Evanston, IL',
    neighborhood: 'Downtown Evanston',
    price: 2400,
    beds: 2,
    baths: 2,
    sqft: 950,
    seasons: ['Spring'],
    startDate: '2026-03-01',
    endDate: '2026-05-31',
    description:
      'Open loft-style apartment with exposed brick, 12-foot ceilings, and gourmet kitchen with island. Walking distance to the Davis Street L stop.',
    imageHue: '215',
  },
  {
    id: '12',
    title: 'Affordable Studio, Great Location',
    address: '777 Maple Ave, Evanston, IL',
    neighborhood: 'West Evanston',
    price: 950,
    beds: 0,
    baths: 1,
    sqft: 350,
    seasons: ['Fall', 'Winter', 'Spring', 'Summer'],
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    description:
      'Budget-friendly studio available year-round. Utilities included, bicycle storage, and coin-op laundry in building. Great for anyone who needs flexibility.',
    imageHue: '240',
  },
];

export const ITEMS_PER_PAGE = 6;

export function getFilteredSublets({
  seasons,
  minPrice,
  maxPrice,
  sortOrder,
  query,
}: {
  seasons?: Season[];
  minPrice?: number;
  maxPrice?: number;
  sortOrder?: SortOrder;
  query?: string;
}): Sublet[] {
  let results = [...MOCK_SUBLETS];

  if (query && query.trim()) {
    const q = query.toLowerCase();
    results = results.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q)
    );
  }

  if (seasons && seasons.length > 0) {
    results = results.filter((s) =>
      s.seasons.some((season) => seasons.includes(season))
    );
  }

  if (minPrice !== undefined) {
    results = results.filter((s) => s.price >= minPrice);
  }

  if (maxPrice !== undefined) {
    results = results.filter((s) => s.price <= maxPrice);
  }

  if (sortOrder === 'asc') {
    results.sort((a, b) => a.price - b.price);
  } else if (sortOrder === 'desc') {
    results.sort((a, b) => b.price - a.price);
  }

  return results;
}
