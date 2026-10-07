import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cameraPositionForFocus,
  continentCameraFocus,
  destinationCameraFocus,
} from './cameraFocus.js';
import { tierForDistance } from './zoomTiers.js';

test('continent navigation lands in the continent zoom tier', () => {
  const focus = continentCameraFocus([15.72, 3.9]);
  assert.equal(tierForDistance(focus.distance), 'continent');
});

test('every current football destination has a country-tier focus', () => {
  for (const id of ['england', 'scotland', 'wales', 'northern-ireland', 'ireland', 'nigeria']) {
    const focus = destinationCameraFocus(id);
    assert.ok(focus, `${id} needs a camera focus`);
    assert.equal(tierForDistance(focus.distance), 'country');
  }
  assert.equal(destinationCameraFocus('unknown'), null);
});

test('focus positions preserve distance and globe orientation', () => {
  const origin = cameraPositionForFocus({ latitude: 0, longitude: 0, distance: 3 });
  assert.ok(Math.abs(origin[0] - 3) < 1e-12);
  assert.ok(Math.abs(origin[1]) < 1e-12);
  assert.ok(Math.abs(origin[2]) < 1e-12);
  const north = cameraPositionForFocus({ latitude: 90, longitude: 20, distance: 2.75 });
  assert.ok(Math.abs(north[0]) < 1e-12);
  assert.ok(Math.abs(north[1] - 2.75) < 1e-12);
  assert.ok(Math.abs(north[2]) < 1e-12);
});
