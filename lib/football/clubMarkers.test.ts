import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFootballData, type FootballData } from './data.js';
import { clubMarkersForFilter } from './clubMarkers.js';
import { sampleFootballData } from './sampleData.js';

test('creates one marker-ready record for each club with matching players', () => {
  const markers = clubMarkersForFilter(sampleFootballData, 'all');

  assert.equal(markers.length, sampleFootballData.clubs.length);
  assert.equal(new Set(markers.map(marker => marker.clubId)).size, markers.length);
  assert.equal(
    markers.reduce((total, marker) => total + marker.playerCount, 0),
    sampleFootballData.players.length,
  );
});

test('filters players before calculating club visibility and counts', () => {
  const men = clubMarkersForFilter(sampleFootballData, 'men');
  const women = clubMarkersForFilter(sampleFootballData, 'women');

  assert.ok(men.every(marker => marker.identity === 'eagle'));
  assert.ok(women.every(marker => marker.identity === 'falcon'));
  assert.ok(men.every(marker => marker.players.every(player => player.gender === 'men')));
  assert.ok(women.every(marker => marker.players.every(player => player.gender === 'women')));
  assert.equal(
    men.reduce((total, marker) => total + marker.playerCount, 0),
    sampleFootballData.players.filter(player => player.gender === 'men').length,
  );
  assert.equal(
    women.reduce((total, marker) => total + marker.playerCount, 0),
    sampleFootballData.players.filter(player => player.gender === 'women').length,
  );
});

test('uses club geography for markers and league relationships for navigation', () => {
  const markers = clubMarkersForFilter(sampleFootballData, 'all');
  const fulham = markers.find(marker => marker.clubId === 'fulham');

  assert.ok(fulham);
  assert.equal(fulham.latitude, 51.4749);
  assert.equal(fulham.longitude, -0.2216);
  assert.equal(fulham.locationCountryCode, 'GB');
  assert.equal(fulham.countryId, 'england');
  assert.equal(fulham.countryName, 'England');
  assert.equal(fulham.continentId, 'europe');
});

test('keeps shared-city clubs separate for later screen-space clustering', () => {
  const istanbul = clubMarkersForFilter(sampleFootballData, 'all')
    .filter(marker => marker.city === 'Istanbul');

  assert.deepEqual(
    new Set(istanbul.map(marker => marker.clubId)),
    new Set(['galatasaray', 'besiktas']),
  );
  assert.notDeepEqual(
    istanbul[0] && [istanbul[0].latitude, istanbul[0].longitude],
    istanbul[1] && [istanbul[1].latitude, istanbul[1].longitude],
  );
});

test('uses the combined identity only when the active players include both genders', () => {
  const basePlayer = sampleFootballData.players.find(player => player.club_id === 'fulham');
  assert.ok(basePlayer);

  const mixedClubData = parseFootballData({
    ...sampleFootballData,
    players: [
      basePlayer,
      {
        ...basePlayer,
        player_id: 'sample-woman-at-fulham',
        full_name: 'Sample Woman',
        gender: 'women',
      },
    ],
  }) as FootballData;

  assert.equal(clubMarkersForFilter(mixedClubData, 'all')[0]?.identity, 'combined');
  assert.equal(clubMarkersForFilter(mixedClubData, 'men')[0]?.identity, 'eagle');
  assert.equal(clubMarkersForFilter(mixedClubData, 'women')[0]?.identity, 'falcon');
});
