import { z } from 'zod';

const id = z.string().trim().min(1);
const optionalText = z.string().trim().min(1).nullable();
const countryCode = z.string().trim().min(2).max(8);
const hexColour = z.string().regex(/^#[0-9A-F]{6}$/i, 'Expected a six-digit hex colour');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date').nullable();
const sourceUrl = z.string().url().nullable();

export const continentSchema = z.object({
  continent_id: id,
  continent_name: z.string().trim().min(1),
}).strict();

export const countrySchema = z.object({
  country_id: id,
  country_name: z.string().trim().min(1),
  country_code: countryCode,
  continent_id: id,
  is_home: z.boolean(),
  boundary_key: optionalText.optional(),
}).strict();

export const leagueSchema = z.object({
  league_id: id,
  league_name: z.string().trim().min(1),
  country_id: id,
}).strict();

export const clubSchema = z.object({
  club_id: id,
  club_name: z.string().trim().min(1),
  league_id: id,
  city: z.string().trim().min(1),
  location_country_code: countryCode,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  kit_primary: hexColour,
  kit_secondary: hexColour,
  kit_accent: hexColour,
}).strict();

export const playerSchema = z.object({
  player_id: id,
  full_name: z.string().trim().min(1),
  gender: z.enum(['men', 'women']),
  date_of_birth: date,
  position: optionalText,
  shirt_number: z.number().int().positive().nullable(),
  club_id: id,
  on_loan_from: optionalText,
  national_team_level: optionalText,
  skin_tone: optionalText,
  hairstyle_id: optionalText,
  facial_hair_id: optionalText,
  accessory_id: optionalText,
  boots_color: z.union([hexColour, z.null()]),
  sprite_override_url: sourceUrl.optional(),
  last_verified: date,
  source_url: sourceUrl,
}).strict();

const metadataSchema = z.discriminatedUnion('data_kind', [
  z.object({
    data_kind: z.literal('sample'),
    display_label: z.string().trim().regex(/sample/i, 'Sample datasets must be visibly labelled as sample data'),
  }).strict(),
  z.object({
    data_kind: z.literal('verified'),
    display_label: z.string().trim().min(1),
  }).strict(),
]);

function addDuplicateIssues(
  values: readonly string[],
  path: string,
  context: z.RefinementCtx,
  identity = 'stable ID',
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate ${identity}: ${value}`,
        path: [path, index],
      });
    }
    seen.add(value);
  });
}

export const footballDataSchema = z.object({
  metadata: metadataSchema,
  continents: z.array(continentSchema),
  countries: z.array(countrySchema),
  leagues: z.array(leagueSchema),
  clubs: z.array(clubSchema),
  players: z.array(playerSchema),
}).strict().superRefine((data, context) => {
  addDuplicateIssues(data.continents.map(item => item.continent_id), 'continents', context);
  addDuplicateIssues(data.countries.map(item => item.country_id), 'countries', context);
  addDuplicateIssues(data.countries.map(item => item.country_code), 'countries', context, 'country code');
  addDuplicateIssues(data.leagues.map(item => item.league_id), 'leagues', context);
  addDuplicateIssues(data.clubs.map(item => item.club_id), 'clubs', context);
  addDuplicateIssues(data.players.map(item => item.player_id), 'players', context);

  const continentIds = new Set(data.continents.map(item => item.continent_id));
  const countryIds = new Set(data.countries.map(item => item.country_id));
  const leagueIds = new Set(data.leagues.map(item => item.league_id));
  const clubIds = new Set(data.clubs.map(item => item.club_id));

  data.countries.forEach((country, index) => {
    if (!continentIds.has(country.continent_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown continent: ${country.continent_id}`,
        path: ['countries', index, 'continent_id'],
      });
    }
  });

  data.leagues.forEach((league, index) => {
    if (!countryIds.has(league.country_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown league country: ${league.country_id}`,
        path: ['leagues', index, 'country_id'],
      });
    }
  });

  data.clubs.forEach((club, index) => {
    if (!leagueIds.has(club.league_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown league: ${club.league_id}`,
        path: ['clubs', index, 'league_id'],
      });
    }
    if (['NG', 'NGA'].includes(club.location_country_code.toUpperCase())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Domestic Nigerian playing locations are outside this product scope',
        path: ['clubs', index, 'location_country_code'],
      });
    }
  });

  data.players.forEach((player, index) => {
    if (!clubIds.has(player.club_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown current club: ${player.club_id}`,
        path: ['players', index, 'club_id'],
      });
    }

    if (data.metadata.data_kind === 'verified' && (!player.last_verified || !player.source_url)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Verified player records require last_verified and source_url',
        path: ['players', index],
      });
    }
  });
});

export type ContinentRecord = z.infer<typeof continentSchema>;
export type CountryRecord = z.infer<typeof countrySchema>;
export type LeagueRecord = z.infer<typeof leagueSchema>;
export type ClubRecord = z.infer<typeof clubSchema>;
export type PlayerRecord = z.infer<typeof playerSchema>;
export type FootballData = z.infer<typeof footballDataSchema>;

/** Parse local football data before it reaches globe markers, filters or panels. */
export function parseFootballData(input: unknown): FootballData {
  return footballDataSchema.parse(input);
}
