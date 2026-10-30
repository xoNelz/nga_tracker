import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleFootballData } from './sampleData.js';

test('loads a visibly labelled historical sample through the production validator', () => {
  assert.equal(sampleFootballData.metadata.data_kind, 'sample');
  assert.match(sampleFootballData.metadata.display_label, /historical sample data/i);
  assert.match(sampleFootballData.metadata.display_label, /not current rosters/i);
});

test('matches the design-spec sample size and coverage', () => {
  assert.ok(sampleFootballData.players.length >= 15 && sampleFootballData.players.length <= 25);
  assert.ok(sampleFootballData.countries.length >= 8 && sampleFootballData.countries.length <= 12);
  assert.ok(sampleFootballData.clubs.length >= 10 && sampleFootballData.clubs.length <= 15);
  assert.ok(new Set(sampleFootballData.countries.map(country => country.continent_id)).size >= 3);
  assert.deepEqual(new Set(sampleFootballData.players.map(player => player.gender)), new Set(['men', 'women']));
});

test('includes fixtures for overlap, loan and outside-Nigeria African-club behaviour', () => {
  const cityClubCounts = new Map<string, number>();
  sampleFootballData.clubs.forEach(club => {
    cityClubCounts.set(club.city, (cityClubCounts.get(club.city) ?? 0) + 1);
  });

  assert.ok([...cityClubCounts.values()].some(count => count > 1));
  assert.ok(sampleFootballData.players.some(player => player.on_loan_from));

  const countryById = new Map(sampleFootballData.countries.map(country => [country.country_id, country]));
  const leagueById = new Map(sampleFootballData.leagues.map(league => [league.league_id, league]));
  assert.ok(sampleFootballData.clubs.some(club => {
    const league = leagueById.get(club.league_id);
    return league && countryById.get(league.country_id)?.continent_id === 'africa';
  }));
});

test('keeps the fixture sourced, dated and free of invented sprite traits', () => {
  assert.ok(sampleFootballData.players.every(player => player.last_verified === '2025-09-30'));
  assert.ok(sampleFootballData.players.every(player => player.source_url?.startsWith('https://')));
  assert.ok(sampleFootballData.players.every(player =>
    player.skin_tone === null &&
    player.hairstyle_id === null &&
    player.facial_hair_id === null &&
    player.accessory_id === null &&
    player.boots_color === null &&
    player.sprite_override_url === null,
  ));
});
