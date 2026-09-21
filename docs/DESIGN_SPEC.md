# Naija Player Tracker — Design Spec v1.2

Finalized product decisions and implementation brief. This document is the source of truth for Codex and Claude Code. Spline is not required.

## 1. Product and scope

An interactive football discovery platform for Nigerian male and female footballers currently playing club football **outside Nigeria**. The experience should feel like a polished retro football exploration game. **The globe is the product.**

Domestic Nigerian clubs and competitions are excluded. A loan player's current playing club determines their location; the parent club is display-only metadata. A player loaned abroad from Nigeria is included; a player loaned into Nigeria is excluded. Give Nigeria a deliberate green HOME treatment without player markers.

National-team appearances are profile metadata, not a requirement to appear in the prototype. The exact eligibility rule for uncapped dual nationals must be settled before importing a production dataset; do not silently impose a capped-only rule.

## 2. Exploration hierarchy and geography

**World → Continent → Country → Club → Player**

For navigation, Country means the country housing the club's league. England, Scotland, Wales, Northern Ireland and Ireland are distinct destinations within Europe. Use a simple explicit league-to-country mapping; do not add a confederation hierarchy or confederation filters in V1.

Example: World → Europe → England → Club → Player.

Store the club's actual geographic location separately from its league country. A Welsh club in an English league is reached under England while its marker retains its actual coordinates. Country selection presents all matching league clubs, including cross-border exceptions, with enough camera coverage to reach them.

Do not derive league destinations from a sovereign-country map dataset. Use suitable constituent-country boundaries where needed, with HTML destination lists as an equally valid way to navigate. The user's football navigation rule takes precedence over a map provider's grouping.

World view: full globe and continent labels; optional aggregated player/club counts; no club-marker clutter.

Continent view: center the region; emphasize destinations with tracked players; show country-level counts.

Country view: reveal clubs belonging to that league country. Club view: show tracked Nigerian players. Player view: open a pixel-character profile.

Always show context through a breadcrumb such as WORLD > EUROPE > ENGLAND > CLUB > PLAYER. Allow returning to earlier levels and resetting to World. Counts must reflect the active gender filter.

## 3. Pixel-art globe direction

Smooth 3D sphere with a low-resolution pixel-art Earth texture; simplified but recognizable geography; deep navy background; crisp outlines; restrained ocean blues, greens and sandy land tones; subtle pixel clouds later.

The pixel texture creates the retro appearance. Do not use chunky voxel geometry, photorealistic satellite imagery, neon halos, glassmorphism, toy proportions, oversized tables or generic SaaS styling.

Use Three.js through React Three Fiber and WebGL. Optional drei helpers are permitted. Support drag rotation, wheel/pinch zoom with limits, idle auto-rotation, pause/resume and reset. Pause spin on user interaction. Respect reduced motion.

Start with an explicitly documented provisional texture. Prove selectable geography in the next milestone before adding data or polishing clouds. Visible boundaries and selectable regions should share a consistent geographic source and projection. Test alignment, antimeridian cases and close zoom. Prefer texture resolution changes while retaining the globe; do not switch to a flat country map without a later product decision.

## 4. Club markers and gender filter

ALL | MEN | WOMEN.

Men use pixel eagle markers; women use pixel falcon markers, inspired by Super Eagles and Super Falcons identity. These symbols identify groups, not national-team cap status.

One club marker represents all matching players at that club. Default: crisp static sprite. Hover: small bounce/scale change and club label. Selected: stronger outline, brackets or a small base ring. Never glowing dots.

Prevent overlap for clubs sharing a city: cluster in screen space and open a club list on selection. Cluster counts explicitly mean number of clubs. Any player count must be separately labelled. Under ALL, a shared location can use a combined eagle/falcon badge.

## 5. Club identity — no logos

Do not display, fetch, store or link club logos or badges. Use club kit colours and the player's shirt number on the **front of the pixel-art kit**, following the Osimhen reference. Do not reproduce sponsor marks or crest artwork. This is a firm visual choice intended to reduce legal concerns, not a guarantee of legal clearance.

Club panel: club name, city, league country, league, number of tracked Nigerian players and their sprites/names/positions. Selecting a player opens their profile.

## 6. Player sprites and profiles

Football RPG character sprites, not photographs or pixelated photographs. Prefer full-body sprites. Choose one shared canvas size (64×96 or 96×128), consistent pose, lighting, proportions, pixel density and transparent background.

Use reusable body, hairstyle, facial-hair and accessory layers with skin and kit palettes. Custom artwork may be used for distinctive players if it follows the same template. Sprite attributes and an optional artwork override are supported. Kit colours follow the current club. Numbers appear on the front when supplied.

Recognizable traits can include skin tone, hair, beard, mask/headband, boots and athletic silhouette. The Osimhen reference uses a blond top and protective mask. Do not invent likeness details for unknown players.

V1 profile: name, Nigerian nationality, position, current club, league country, shirt number, age calculated from date of birth and national-team level. Show parent club when on loan. Unknown fields remain unknown. Do not invent overall ratings or football statistics.

## 7. Desktop and mobile layouts

Desktop: compact NAIJA PLAYER TRACKER header, gender controls, dominant globe, subtle breadcrumbs, rotation/zoom controls and a contextual side panel. The panel must not permanently consume the main screen.

Mobile: compact header, gender controls, globe and a bottom sheet for continent/country/club/player information. Support touch rotation, pinch zoom and tap selection. Do not shrink the desktop sidebar. Keep controls comfortably tappable and text readable.

Use a pixel/display font for identity, names and short headings; a clean sans-serif for metadata, descriptions and forms. Avoid long paragraphs in a pixel font.

## 8. Starting colour tokens

- Background: #0B132B, #101A34.
- Nigeria green: #008751; secondary green: #23B26D.
- Off-white: #F3F1E8.
- Ocean: #2794D8, #48B6EE.
- Land: #6CBF54, #A8D35F, #D2B36F.
- Outline: #16213E.

These are starting tokens; preserve the direction rather than treating every colour as immutable.

## 9. Data model

Continents: continent_id, continent_name.

Countries / league destinations: country_id, country_name, country_code, continent_id, is_home, optional boundary_key. Use stable distinct codes/IDs for the four UK constituent destinations. Boundary IDs are separate from application IDs.

Leagues: league_id, league_name, country_id. The league country determines the navigation path.

Clubs: club_id, club_name, league_id, city, location_country_code, latitude, longitude, kit_primary, kit_secondary, kit_accent. No logo field. Coordinates locate the actual playing club; league_id determines the country in the navigation tree.

Players: player_id, full_name, gender, date_of_birth, position, shirt_number, club_id, on_loan_from, national_team_level, skin_tone, hairstyle_id, facial_hair_id, accessory_id, boots_color, optional sprite_override_url, last_verified, source_url.

Use stable references instead of duplicating club coordinates on players. The current club/location determines abroad-only inclusion, independently of league navigation. Record verification date and a usable source for real data; development fixtures are explicitly labelled sample data.

## 10. Data loading and future import

V1 uses local JSON or CSV-backed sample data. Start with 15–25 players, men and women, 8–12 league destinations, several continents and 10–15 clubs. Include shared-city clubs, a loan and an African club outside Nigeria. Sample records must not be presented as verified current rosters.

A later importer resolves player → club → league → league country → continent, while using actual club coordinates for markers. Reject domestic Nigerian playing locations with an explicit abroad-only message. Preserve source/verification metadata and warn about stale records. Do not repeat coordinates for players sharing a club.

## 11. Rendering, accessibility and performance

React Three Fiber handles the globe, camera, geography, markers and clouds. React/HTML handles controls, breadcrumbs, destination lists, panels and profiles. Keep the canvas client-only and the globe module isolated.

Provide keyboard-accessible HTML navigation through the same hierarchy. A user must be able to reach every player without operating the globe. Respect prefers-reduced-motion, show visible focus states, expose meaningful control labels and provide a WebGL failure fallback.

Measure performance on representative mobile hardware rather than promising an unmeasured device-independent frame rate. Aim for smooth interaction, lazy-load geographic detail, cap device pixel ratio and texture size, and use a functional HTML fallback on unsupported devices. Document measured bundle/texture sizes and limitations before V1 release.

## 12. V1 scope

Interactive pixel-art globe; world/continent/league-country navigation; drag rotation and limited zoom; idle spin/pause/resume/reset; abroad-only sample data; ALL/MEN/WOMEN; eagle/falcon club markers and overlap handling; club panels; player lists; pixel player profiles; desktop and mobile layouts; local data; keyboard navigation and reduced-motion support.

## 13. Out of scope for V1

Accounts, authentication, favourites, social features, comments, live scores, news, transfer rumours, scouting models, fantasy football, AI recommendations, player comparisons, confederation filters, native apps, large admin systems and advanced analytics.

Latest-match statistics, current-season statistics and a regularly refreshed transfer/status feed belong to the next version. Search-driven globe navigation is also deferred.

## 14. Next version — latest player information

Clicking a player should eventually provide current club, confirmed transfer/loan status, latest match (opponent, date, result, minutes, goals and assists), and current-season appearances, starts, minutes, goals and assists.

Use a documented football-data source with relevant coverage and permitted use. Attach source and last-updated time; distinguish confirmed moves from rumours. Display unavailable stats as unavailable. Separate season/competition identifiers and match dates so aggregates are meaningful. Do not imply a real-time feed where periodic refreshes are used. A provider and refresh cadence are later implementation decisions.

## 15. Milestones

M1 — Globe prototype: application structure, dominant smooth sphere with provisional pixel geography, rotation, zoom limits, idle spin, pause/resume, reset, responsive layout and reduced-motion handling. No player data, selection, markers, filters or profiles yet.

M2 — Geographic selection: prove texture/selection alignment and simple league destinations, including UK constituent countries. Validate hover/tap and close zoom before art polish.

M3 — Hierarchy: continent and league-country transitions, breadcrumbs, HTML navigation and Nigeria HOME treatment.

M4 — Club data: local sample dataset, markers, overlap handling, gender filtering and club panels.

M5 — Players: sprite layers/consistent custom assets, front-of-kit numbers and player profiles.

M6 — Release polish: mobile bottom sheets, accessibility checks, performance measurements, geographic edge cases, error/fallback states and restrained clouds/motion.

## Appendix A — Coding-agent master prompt

You are building Naija Player Tracker. Read docs/DESIGN_SPEC.md completely before architectural or UI decisions; treat it as the source of truth. No Spline dependency.

Build an explorable football world for Nigerian men and women playing outside Nigeria. The hierarchy is World → Continent → Country → Club → Player. Country means the country housing the club's league; England, Scotland, Wales, Northern Ireland and Ireland are separate European destinations. Keep league grouping separate from actual marker coordinates. Follow the current playing club for loans and exclude domestic Nigerian playing locations.

The globe is the dominant interface. Use a smooth Three.js sphere through React Three Fiber with pixel-art geography, navy background, restrained colours and crisp retro football-game controls. Avoid satellite imagery, neon glow, glassmorphism, voxel geometry and generic dashboard layouts. Use HTML/React for controls and panels.

Use eagle club markers for men and falcon club markers for women. Aggregate players by club and handle overlapping clubs. Do not use club logos, badges or sponsors. Player sprites wear club-inspired colours and their shirt number on the front. Use consistent reusable sprite layers, with custom artwork overrides permitted. Never invent player facts, ratings or stats.

Desktop uses contextual panels; mobile uses bottom sheets. Provide keyboard-accessible HTML navigation, reduced-motion handling and WebGL fallback. V1 uses clearly labelled local sample data. Defer confederation filters, search, accounts, live information and advanced features. Latest match, season stats and confirmed transfer status belong to the next version.

Work milestone by milestone. Explain major architectural/file changes briefly, then implement the authorized milestone without waiting for routine approval. Keep modules isolated and do not rewrite working sections unnecessarily. Verify the delivered milestone and report its limitations honestly.

## Appendix B — Milestone 1 prompt

Read docs/DESIGN_SPEC.md. Implement only M1: TypeScript/React application structure and a client-only React Three Fiber globe with a clearly documented provisional pixel-art texture, drag rotation, wheel/pinch zoom limits, idle spin that pauses on interaction, pause/resume, reset, responsive navy layout and reduced-motion support. Keep globe logic isolated for future picking. Do not build player data, geography selection, markers, filters, panels or profiles. Check the build and available preview; report what is implemented and what remains provisional.
