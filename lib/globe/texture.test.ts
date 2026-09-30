import assert from 'node:assert/strict';
import test from 'node:test';
import { settleGeoLoad, type GeoEntry } from './texture.js';

const fakeEntry = (name: string): GeoEntry => ({
  data: { features: [] },
  created: { tag: name } as unknown as GeoEntry['created'],
});

test('regional detail wins when both the world base and detail settled', () => {
  const world = fakeEntry('world');
  const region = fakeEntry('region');
  const settled = settleGeoLoad(world, region);
  assert.equal(settled.status, 'ready');
  assert.equal(settled.status === 'ready' && settled.entry, region);
});

test('a failed regional load keeps the world base instead of stalling', () => {
  // Regression: the old Promise.all loader discarded a good world response
  // when the regional request failed, leaving the globe with no map.
  const world = fakeEntry('world');
  const settled = settleGeoLoad(world, null);
  assert.equal(settled.status, 'ready');
  assert.equal(settled.status === 'ready' && settled.entry, world);
});

test('the load error surfaces only when no usable map exists at all', () => {
  const settled = settleGeoLoad(null, null);
  assert.equal(settled.status, 'load-error');
});
