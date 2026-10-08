import assert from 'node:assert/strict';
import test from 'node:test';
import { footballDataSchema, parseFootballData } from './data.js';

const validData = {
  metadata: { data_kind: 'sample', display_label: 'SAMPLE DATA · NOT CURRENT ROSTERS' },
  continents: [{ continent_id: 'europe', continent_name: 'Europe' }],
  countries: [{
    country_id: 'england',
    country_name: 'England',
    country_code: 'GB-ENG',
    continent_id: 'europe',
    is_home: false,
    boundary_key: 'GBR',
  }],
  leagues: [{ league_id: 'sample-league', league_name: 'Sample League', country_id: 'england' }],
  clubs: [{
    club_id: 'sample-club',
    club_name: 'Sample Club',
    league_id: 'sample-league',
    city: 'Sample City',
    location_country_code: 'GB',
    latitude: 51.5,
    longitude: -0.1,
    kit_primary: '#008751',
    kit_secondary: '#F3F1E8',
    kit_accent: '#101A34',
  }],
  players: [{
    player_id: 'sample-player',
    full_name: 'Sample Player',
    gender: 'women',
    date_of_birth: null,
    position: null,
    shirt_number: null,
    club_id: 'sample-club',
    on_loan_from: null,
    national_team_level: null,
    skin_tone: null,
    hairstyle_id: null,
    facial_hair_id: null,
    accessory_id: null,
    boots_color: null,
    sprite_override_url: null,
    last_verified: null,
    source_url: null,
  }],
} as const;

test('accepts a clearly labelled sample dataset with linked records', () => {
  const parsed = parseFootballData(validData);
  assert.equal(parsed.metadata.data_kind, 'sample');
  assert.equal(parsed.players[0].club_id, parsed.clubs[0].club_id);
});

test('rejects broken hierarchy references and duplicate stable IDs', () => {
  const result = footballDataSchema.safeParse({
    ...validData,
    countries: [validData.countries[0], validData.countries[0]],
    leagues: [{ ...validData.leagues[0], country_id: 'missing-country' }],
    clubs: [{ ...validData.clubs[0], league_id: 'missing-league' }],
    players: [{ ...validData.players[0], club_id: 'missing-club' }],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map(issue => issue.message);
    assert.ok(messages.some(message => message.includes('Duplicate stable ID')));
    assert.ok(messages.some(message => message.includes('Unknown league country')));
    assert.ok(messages.some(message => message.includes('Unknown league')));
    assert.ok(messages.some(message => message.includes('Unknown current club')));
  }
});

test('rejects domestic Nigerian club locations using actual club geography', () => {
  const result = footballDataSchema.safeParse({
    ...validData,
    clubs: [{ ...validData.clubs[0], location_country_code: 'NGA' }],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /Domestic Nigerian playing locations/);
  }
});

test('keeps coordinates on clubs and rejects logo-like club fields', () => {
  const result = footballDataSchema.safeParse({
    ...validData,
    clubs: [{ ...validData.clubs[0], logo_url: 'https://example.com/logo.png' }],
    players: [{ ...validData.players[0], latitude: 51.5, longitude: -0.1 }],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map(issue => issue.path.join('.'));
    assert.ok(paths.some(path => path.startsWith('clubs.0')));
    assert.ok(paths.some(path => path.startsWith('players.0')));
  }
});

test('requires verification metadata only when records claim to be verified', () => {
  const result = footballDataSchema.safeParse({
    ...validData,
    metadata: { data_kind: 'verified', display_label: 'Verified player records' },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /require last_verified and source_url/);
  }
});

test('requires a visible sample label and distinct football destination codes', () => {
  const result = footballDataSchema.safeParse({
    ...validData,
    metadata: { data_kind: 'sample', display_label: 'Local football records' },
    countries: [
      validData.countries[0],
      { ...validData.countries[0], country_id: 'scotland', country_name: 'Scotland' },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map(issue => issue.message);
    assert.ok(messages.some(message => message.includes('visibly labelled as sample data')));
    assert.ok(messages.some(message => message.includes('Duplicate country code')));
  }
});
