import assert from 'node:assert/strict';
import test from 'node:test';
import { destinations } from './destinations.js';
import { hierarchyCrumbs } from './hierarchy.js';

const continentNames = { africa: 'Africa', europe: 'Europe' };

test('the hierarchy starts at World', () => {
  assert.deepEqual(hierarchyCrumbs({ activeContinentId: null, continentNames, destination: null, selected: null }), [
    { level: 'world', label: 'WORLD' },
  ]);
});

test('a map selection establishes its continent without inventing a football destination', () => {
  assert.deepEqual(hierarchyCrumbs({
    activeContinentId: 'europe', continentNames, destination: null,
    selected: { name: 'United Kingdom', iso3: 'GBR' },
  }).map(crumb => crumb.label), ['WORLD', 'EUROPE']);
});

test('a football destination adds the country level', () => {
  assert.deepEqual(hierarchyCrumbs({
    activeContinentId: 'europe', continentNames, destination: destinations[0],
    selected: { name: 'United Kingdom', iso3: 'GBR' },
  }).map(crumb => crumb.label), ['WORLD', 'EUROPE', 'ENGLAND']);
});

test('Nigeria receives HOME treatment without becoming an abroad destination', () => {
  assert.deepEqual(hierarchyCrumbs({
    activeContinentId: 'africa', continentNames, destination: null,
    selected: { name: 'Nigeria', iso3: 'NGA' },
  }).map(crumb => crumb.label), ['WORLD', 'AFRICA', 'NIGERIA · HOME']);
});
