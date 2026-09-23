import assert from 'node:assert/strict';
import test from 'node:test';
import { destinations, destinationsForMapRegion } from './destinations.js';

test('five distinct European football destinations have unique stable identities', () => {
  assert.equal(destinations.length, 5);
  assert.equal(new Set(destinations.map(d => d.country_id)).size, 5);
  assert.equal(new Set(destinations.map(d => d.country_code)).size, 5);
  assert.ok(destinations.every(d => d.continent_id === 'europe' && !d.is_home));
});
test('UK map selection offers four choices without choosing one or including Ireland', () => {
  assert.deepEqual(destinationsForMapRegion('GBR').map(d => d.country_name),
    ['England', 'Scotland', 'Wales', 'Northern Ireland']);
});
test('Ireland is separate and unrelated map selections never infer a destination', () => {
  assert.deepEqual(destinationsForMapRegion('IRL').map(d => d.country_id), ['ireland']);
  assert.deepEqual(destinationsForMapRegion('NGA'), []);
  assert.deepEqual(destinationsForMapRegion(null), []);
});
