import type { Destination } from './destinations';

export type HierarchyLevel = 'world' | 'continent' | 'country';
export type HierarchyCrumb = { level: HierarchyLevel; label: string };

type HierarchyContext = {
  activeContinentId: string | null;
  continentNames: Readonly<Record<string, string>>;
  destination: Destination | null;
  selected: { iso3: string; name?: string } | null;
};

/** Build the visible product hierarchy without treating map regions as league destinations. */
export function hierarchyCrumbs({ activeContinentId, continentNames, destination, selected }: HierarchyContext): HierarchyCrumb[] {
  const crumbs: HierarchyCrumb[] = [{ level: 'world', label: 'WORLD' }];
  const continentId = destination?.continent_id ?? activeContinentId;
  const continentName = continentId ? continentNames[continentId] : null;
  if (continentName) crumbs.push({ level: 'continent', label: continentName.toUpperCase() });
  if (destination) {
    crumbs.push({ level: 'country', label: destination.country_name.toUpperCase() });
  } else if (selected?.iso3 === 'NGA') {
    crumbs.push({ level: 'country', label: 'NIGERIA · HOME' });
  }
  return crumbs;
}
