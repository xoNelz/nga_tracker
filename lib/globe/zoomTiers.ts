// Zoom tiers for the granular continent/country views (spec section 16).
// Tiers are driven by camera distance; the globe stays a sphere at every tier,
// so detail appears as the user zooms, Google-Maps-style, with no flat-map switch.

export type ZoomTier = 'world' | 'continent' | 'country';

// OrbitControls clamps camera distance to [2.5, 6.5]; the default view sits at ~4.2.
export const CONTINENT_TIER_DISTANCE = 4.4;
export const COUNTRY_TIER_DISTANCE = 3.1;

export function tierForDistance(distance: number): ZoomTier {
  if (distance >= CONTINENT_TIER_DISTANCE) return 'world';
  if (distance >= COUNTRY_TIER_DISTANCE) return 'continent';
  return 'country';
}

/** Region-scoped boundary file for a tier; world falls back to the 110m dataset. */
export function regionFileForTier(tier: ZoomTier, continentId: string | null): string {
  if (tier === 'world' || !continentId) return '/data/world.geojson';
  return `/data/regions/${continentId}.geojson`;
}

export interface LabelVisibility {
  countries: boolean;
  cities: boolean;
}

/**
 * Countries label the continent tier; major cities join at the country tier.
 * Cities are orientation only — club markers stay the emphasized product layer.
 */
export function labelsForTier(tier: ZoomTier): LabelVisibility {
  return { countries: tier !== 'world', cities: tier === 'country' };
}

/** iso3 -> continent id, loaded from /data/country-index.json. */
export type CountryIndex = Record<string, string>;

export function continentForIso3(index: CountryIndex, iso3: string | null | undefined): string | null {
  if (!iso3) return null;
  return index[iso3] ?? null;
}
