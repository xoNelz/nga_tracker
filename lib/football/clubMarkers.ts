import type { FootballData, PlayerRecord } from './data';

export const genderFilters = ['all', 'men', 'women'] as const;

export type GenderFilter = (typeof genderFilters)[number];
export type ClubMarkerIdentity = 'eagle' | 'falcon' | 'combined';

export type ClubMarkerRecord = {
  clubId: string;
  clubName: string;
  city: string;
  locationCountryCode: string;
  latitude: number;
  longitude: number;
  kitPrimary: string;
  kitSecondary: string;
  kitAccent: string;
  leagueId: string;
  leagueName: string;
  countryId: string;
  countryName: string;
  continentId: string;
  playerCount: number;
  players: readonly PlayerRecord[];
  identity: ClubMarkerIdentity;
};

function markerIdentity(players: readonly PlayerRecord[]): ClubMarkerIdentity {
  const hasMen = players.some(player => player.gender === 'men');
  const hasWomen = players.some(player => player.gender === 'women');

  if (hasMen && hasWomen) return 'combined';
  return hasMen ? 'eagle' : 'falcon';
}

/**
 * Resolve the validated football dataset into one marker-ready record per club.
 * League relationships provide navigation context; the current club provides
 * the physical marker coordinates and the players visible under the filter.
 */
export function clubMarkersForFilter(
  data: FootballData,
  filter: GenderFilter,
): ClubMarkerRecord[] {
  const playersByClub = new Map<string, PlayerRecord[]>();
  for (const player of data.players) {
    if (filter !== 'all' && player.gender !== filter) continue;
    const players = playersByClub.get(player.club_id) ?? [];
    players.push(player);
    playersByClub.set(player.club_id, players);
  }

  const leaguesById = new Map(data.leagues.map(league => [league.league_id, league]));
  const countriesById = new Map(data.countries.map(country => [country.country_id, country]));

  return data.clubs.flatMap(club => {
    const players = playersByClub.get(club.club_id);
    if (!players?.length) return [];

    // These links are guaranteed by parseFootballData before this selector runs.
    const league = leaguesById.get(club.league_id);
    const country = league ? countriesById.get(league.country_id) : undefined;
    if (!league || !country) return [];

    return [{
      clubId: club.club_id,
      clubName: club.club_name,
      city: club.city,
      locationCountryCode: club.location_country_code,
      latitude: club.latitude,
      longitude: club.longitude,
      kitPrimary: club.kit_primary,
      kitSecondary: club.kit_secondary,
      kitAccent: club.kit_accent,
      leagueId: league.league_id,
      leagueName: league.league_name,
      countryId: country.country_id,
      countryName: country.country_name,
      continentId: country.continent_id,
      playerCount: players.length,
      players,
      identity: markerIdentity(players),
    }];
  });
}
