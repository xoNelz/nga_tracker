// Run with the built-in Node test runner after compiling these files to work/.
import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { latLonToGlobePoint, projectLabel, GLOBE_RADIUS } from './labels.js';

function cameraAt(x: number, y: number, z: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, 800 / 600, 0.1, 100);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

test('lon/lat maps onto the textured sphere surface', () => {
  // Texture center (lon 0, lat 0) sits on +x, matching lonLatToTexturePixel.
  const origin = latLonToGlobePoint(0, 0);
  assert.ok(Math.abs(origin.x - GLOBE_RADIUS) < 1e-9);
  assert.ok(Math.abs(origin.y) < 1e-9);
  assert.ok(Math.abs(origin.z) < 1e-9);
  const lagos = latLonToGlobePoint(6.5244, 3.3792);
  assert.ok(Math.abs(lagos.length() - GLOBE_RADIUS) < 1e-9);
  const northPole = latLonToGlobePoint(90, 123);
  assert.ok(Math.abs(northPole.y - GLOBE_RADIUS) < 1e-9);
});

test('a facing label projects to screen center and stays visible', () => {
  const camera = cameraAt(5, 0, 0);
  const label = projectLabel(0, 0, camera, 800, 600);
  assert.ok(Math.abs(label.x - 400) < 1);
  assert.ok(Math.abs(label.y - 300) < 1);
  assert.equal(label.visible, true);
});

test('a label on the far side of the globe is hidden', () => {
  const camera = cameraAt(5, 0, 0);
  const label = projectLabel(0, 180, camera, 800, 600);
  assert.equal(label.visible, false);
});

test('the globe hides a label that its curve blocks from a finite camera', () => {
  const camera = cameraAt(5, 0, 0);
  // The old centre-to-camera approximation showed this point even though the
  // globe's curved surface blocks the direct line from the label to the camera.
  const label = projectLabel(0, 75, camera, 800, 600);
  assert.equal(label.visible, false);
});

test('label visibility responds to the camera distance', () => {
  const distant = projectLabel(0, 65, cameraAt(5, 0, 0), 800, 600);
  const close = projectLabel(0, 65, cameraAt(3, 0, 0), 800, 600);
  assert.equal(distant.visible, true);
  assert.equal(close.visible, false);
});
