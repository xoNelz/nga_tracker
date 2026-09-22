import assert from 'node:assert/strict';
import test from 'node:test';
import { assignRegionCoverage, createTapGuard, regionAtUv, type RegionLookup } from './selection.js';

const lookup: RegionLookup = {
  width: 2, height: 2, ids: new Uint16Array([1, 2, 0, 1]),
  regions: [{ name: 'West', iso3: 'WST' }, { name: 'East', iso3: 'EST' }],
};

test('nearest-texel selection follows north/south and east/west orientation', () => {
  assert.equal(regionAtUv(lookup, 0.25, 0.75)?.iso3, 'WST');
  assert.equal(regionAtUv(lookup, 0.75, 0.75)?.iso3, 'EST');
  assert.equal(regionAtUv(lookup, 0.25, 0.25), null);
  assert.equal(regionAtUv(lookup, 0.75, 0.25)?.iso3, 'WST');
});

test('seam edges and poles clamp to edge texels, not out-of-bounds indices', () => {
  assert.equal(regionAtUv(lookup, 0, 1)?.iso3, 'WST');
  assert.equal(regionAtUv(lookup, 1, 1)?.iso3, 'EST');
  assert.equal(regionAtUv(lookup, 0, 0), null);
  assert.equal(regionAtUv(lookup, 1, 0)?.iso3, 'WST');
  assert.equal(regionAtUv(lookup, -0.01, 1)?.iso3, 'WST');
  assert.equal(regionAtUv(lookup, NaN, 0), null);
});

test('border coverage selects the dominant region; ties follow drawing order', () => {
  const ids = new Uint16Array(3), coverage = new Uint8Array(3);
  assignRegionCoverage(ids, coverage, new Uint8ClampedArray([0,0,0,200, 0,0,0,100, 0,0,0,0]), 1);
  assignRegionCoverage(ids, coverage, new Uint8ClampedArray([0,0,0,50, 0,0,0,100, 0,0,0,0]), 2);
  assert.deepEqual([...ids], [1, 2, 0]);
});

test('single click/tap permits small movement and is consumed once', () => {
  const guard = createTapGuard();
  guard.down(1, 20, 20); guard.move(1, 23, 22);
  assert.equal(guard.up(1, 23, 22), true);
  assert.equal(guard.up(1, 23, 22), false);
  assert.equal(guard.active, false);
});

test('dragging away and back does not count as a tap', () => {
  const guard = createTapGuard();
  guard.down(1, 20, 20); guard.move(1, 40, 20); guard.move(1, 20, 20);
  assert.equal(guard.up(1, 20, 20), false);
});

test('movement first detected on release also rejects selection', () => {
  const guard = createTapGuard(); guard.down(1, 0, 0);
  assert.equal(guard.up(1, 7, 0), false);
});

test('two-finger gesture cannot select even if the last finger returns to its start', () => {
  const guard = createTapGuard(); guard.down(1, 0, 0); guard.down(2, 50, 0);
  assert.equal(guard.up(2, 50, 0), false);
  assert.equal(guard.up(1, 0, 0), false);
  guard.down(3, 10, 10); assert.equal(guard.up(3, 10, 10), true);
});

test('cancel, wheel rejection, window blur, and non-primary buttons cannot select', () => {
  const guard = createTapGuard();
  guard.down(1, 0, 0); guard.cancel(1); assert.equal(guard.up(1, 0, 0), false);
  guard.down(2, 0, 0); guard.reject(); assert.equal(guard.up(2, 0, 0), false);
  guard.down(3, 0, 0); guard.clear(); assert.equal(guard.up(3, 0, 0), false);
  guard.down(4, 0, 0, false); assert.equal(guard.up(4, 0, 0), false);
});
