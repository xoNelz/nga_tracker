import assert from 'node:assert/strict';
import test from 'node:test';
import { destinations } from './destinations.js';
import { hierarchyNavigationItems, mapRegionForDestination } from './navigation.js';

const continents = [
  { continent_id: 'africa', continent_name: 'Africa', label: [15.72, 3.9] as const },
  { continent_id: 'europe', continent_name: 'Europe', label: [14.09, 49.46] as const },
  { continent_id: 'asia', continent_name: 'Asia', label: [77.58, 26.46] as const },
];

test('World navigation exposes every continent', () => {
  assert.deepEqual(
    hierarchyNavigationItems(null, continents).map(item => item.label),
    ['Africa', 'Europe', 'Asia'],
  );
});

test('Europe navigation exposes the explicit football destinations', () => {
  assert.deepEqual(
    hierarchyNavigationItems('europe', continents).map(item => item.label),
    destinations.map(destination => destination.country_name),
  );
});

test('Africa navigation exposes Nigeria as HOME', () => {
  assert.deepEqual(hierarchyNavigationItems('africa', continents), [
    { kind: 'home', id: 'nigeria', label: 'Nigeria · Home' },
  ]);
});

test('continents without V1 navigation records do not invent destinations', () => {
  assert.deepEqual(hierarchyNavigationItems('asia', continents), []);
});

test('football destinations select the matching sovereign globe boundary', () => {
  assert.deepEqual(mapRegionForDestination(destinations[0]), { iso3: 'GBR', name: 'United Kingdom' });
  assert.deepEqual(mapRegionForDestination(destinations[4]), { iso3: 'IRL', name: 'Ireland' });
});
