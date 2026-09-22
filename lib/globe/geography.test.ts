// Run with the built-in Node test runner after compiling these two files to work/.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SphereGeometry } from 'three';
import { globeUvToLonLat, lonLatToTexturePixel, unwrapRing, wrapLongitude } from './geography.js';

test('map landmarks retain their established pixel coordinates and orientation', () => {
  assert.deepEqual(lonLatToTexturePixel(0, 0), { x: 256, y: 128 });
  assert.deepEqual(lonLatToTexturePixel(90, 0), { x: 384, y: 128 });
  assert.deepEqual(lonLatToTexturePixel(-90, 0), { x: 128, y: 128 });
  assert.deepEqual(lonLatToTexturePixel(0, 90), { x: 256, y: 0 });
  assert.deepEqual(lonLatToTexturePixel(0, -90), { x: 256, y: 256 });
  assert.deepEqual(lonLatToTexturePixel(3.3792, 6.5244), { x: 261, y: 119 });
});

test('path coordinates retain both seam edges and off-canvas copies', () => {
  assert.equal(lonLatToTexturePixel(-180, 0).x, 0);
  assert.equal(lonLatToTexturePixel(180, 0).x, 512);
  assert.equal(lonLatToTexturePixel(540, 0).x, 1024);
  assert.equal(lonLatToTexturePixel(-540, 0).x, -512);
});

test('canonical longitude wraps either direction and multiple turns', () => {
  for (const longitude of [-900, -540, -180, 180, 540, 900]) {
    assert.equal(wrapLongitude(longitude), -180);
  }
  assert.equal(wrapLongitude(181), -179);
  assert.equal(wrapLongitude(-181), 179);
  assert.equal(wrapLongitude(720), 0);
  assert.equal(wrapLongitude(7.5), 7.5);
});

test('sphere UVs have the expected north/south direction and seam', () => {
  assert.deepEqual(globeUvToLonLat(0.5, 1), { longitude: 0, latitude: 90 });
  assert.deepEqual(globeUvToLonLat(0.5, 0), { longitude: 0, latitude: -90 });
  assert.deepEqual(globeUvToLonLat(0.75, 0.5), { longitude: 90, latitude: 0 });
  assert.deepEqual(globeUvToLonLat(0, 0.5), globeUvToLonLat(1, 0.5));
});

test('UV conversion agrees with the installed Three.js sphere orientation', () => {
  const sphere = new SphereGeometry(1, 16, 8);
  try {
    const positions = sphere.getAttribute('position');
    const uv = sphere.getAttribute('uv');
    for (let i = 0; i < positions.count; i++) {
      // Longitude is undefined at the poles; Three.js also offsets pole UVs.
      if (Math.abs(positions.getY(i)) > 0.99999) continue;
      const { longitude, latitude } = globeUvToLonLat(uv.getX(i), uv.getY(i));
      const expectedLongitude = Math.atan2(-positions.getZ(i), positions.getX(i)) * 180 / Math.PI;
      const expectedLatitude = Math.asin(positions.getY(i)) * 180 / Math.PI;
      assert.ok(Math.abs(wrapLongitude(longitude - expectedLongitude)) < 0.0001);
      assert.ok(Math.abs(latitude - expectedLatitude) < 0.0001);
    }
  } finally {
    sphere.dispose();
  }
});

test('unwrapping handles crossings in both directions without altering input', () => {
  const ring = [[179, 10], [-179, 10], [-179, -10], [179, -10], [179, 10]];
  const original = structuredClone(ring);
  assert.deepEqual(unwrapRing(ring).map(point => point[0]), [179, 181, 181, 179, 179]);
  assert.deepEqual(unwrapRing([...ring].reverse()).map(point => point[0]), [179, 179, 181, 181, 179]);
  assert.deepEqual(unwrapRing([[-179, 0], [179, 0]]), [[-179, 0], [-181, 0]]);
  assert.deepEqual(ring, original);
  assert.deepEqual(unwrapRing([]), []);
});

test('ordinary rings and exactly 180-degree edges retain their coordinates', () => {
  const ring = [[0, 0], [180, 10], [0, 0]];
  assert.deepEqual(unwrapRing(ring), ring);
});

test('custom texture dimensions retain the same projection', () => {
  assert.deepEqual(lonLatToTexturePixel(90, 45, 1024, 512), { x: 768, y: 128 });
});
