// Run with the built-in Node test runner after compiling these files to work/.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tierForDistance,
  regionFileForTier,
  labelsForTier,
  continentForIso3,
  type CountryIndex,
} from './zoomTiers.js';

test('camera distance selects the zoom tier at the documented thresholds', () => {
  assert.equal(tierForDistance(6.5), 'world');
  assert.equal(tierForDistance(4.4), 'world');
  assert.equal(tierForDistance(4.39), 'continent');
  assert.equal(tierForDistance(3.1), 'continent');
  assert.equal(tierForDistance(3.09), 'country');
  assert.equal(tierForDistance(2.5), 'country');
});

test('region files are world-scoped at the top tier and continent-scoped below', () => {
  assert.equal(regionFileForTier('world', 'europe'), '/data/world.geojson');
  assert.equal(regionFileForTier('continent', null), '/data/world.geojson');
  assert.equal(regionFileForTier('continent', 'europe'), '/data/regions/europe.geojson');
  assert.equal(regionFileForTier('country', 'africa'), '/data/regions/africa.geojson');
});

test('label layers appear progressively with depth', () => {
  assert.deepEqual(labelsForTier('world'), { countries: false, cities: false });
  assert.deepEqual(labelsForTier('continent'), { countries: true, cities: false });
  assert.deepEqual(labelsForTier('country'), { countries: true, cities: true });
});

test('iso3 resolves to its continent through the generated index', () => {
  const index: CountryIndex = { NGA: 'africa', GBR: 'europe', IRL: 'europe' };
  assert.equal(continentForIso3(index, 'NGA'), 'africa');
  assert.equal(continentForIso3(index, 'GBR'), 'europe');
  assert.equal(continentForIso3(index, null), null);
  assert.equal(continentForIso3(index, 'XXX'), null);
});
