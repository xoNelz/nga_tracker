import { destinations, type Destination } from './destinations';

export type ContinentOption = { continent_id: string; continent_name: string };

export type HierarchyNavigationItem =
  | { kind: 'continent'; id: string; label: string }
  | { kind: 'destination'; id: string; label: string; destination: Destination }
  | { kind: 'home'; id: 'nigeria'; label: 'Nigeria · Home' };

/** Return the next HTML navigation choices for the active hierarchy level. */
export function hierarchyNavigationItems(
  activeContinentId: string | null,
  continents: readonly ContinentOption[],
): HierarchyNavigationItem[] {
  if (!activeContinentId) {
    return continents.map(continent => ({
      kind: 'continent',
      id: continent.continent_id,
      label: continent.continent_name,
    }));
  }

  if (activeContinentId === 'europe') {
    return destinations.map(destination => ({
      kind: 'destination',
      id: destination.country_id,
      label: destination.country_name,
      destination,
    }));
  }

  if (activeContinentId === 'africa') {
    return [{ kind: 'home', id: 'nigeria', label: 'Nigeria · Home' }];
  }

  return [];
}

/** Map a league destination back to the sovereign boundary used by the globe. */
export function mapRegionForDestination(destination: Destination): { iso3: string; name: string } {
  return destination.country_id === 'ireland'
    ? { iso3: 'IRL', name: 'Ireland' }
    : { iso3: 'GBR', name: 'United Kingdom' };
}
