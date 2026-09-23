/** Football destinations are explicit application records, not sovereign map features. */
export const destinations = [
  { country_id: 'england', country_name: 'England', country_code: 'GB-ENG', continent_id: 'europe', is_home: false },
  { country_id: 'scotland', country_name: 'Scotland', country_code: 'GB-SCT', continent_id: 'europe', is_home: false },
  { country_id: 'wales', country_name: 'Wales', country_code: 'GB-WLS', continent_id: 'europe', is_home: false },
  { country_id: 'northern-ireland', country_name: 'Northern Ireland', country_code: 'GB-NIR', continent_id: 'europe', is_home: false },
  { country_id: 'ireland', country_name: 'Ireland', country_code: 'IE', continent_id: 'europe', is_home: false },
] as const;
export type Destination = typeof destinations[number];

// This association offers choices; it never assigns a UK constituent from a map tap.
export function destinationsForMapRegion(iso3: string | null): readonly Destination[] {
  if (iso3 === 'GBR') return destinations.filter(item => item.country_code.startsWith('GB-'));
  if (iso3 === 'IRL') return destinations.filter(item => item.country_id === 'ireland');
  return [];
}
