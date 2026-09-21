# Naija Player Tracker

An interactive pixel-art globe for discovering Nigerian male and female footballers playing outside Nigeria.

## Current milestone

Milestone 1 contains the application shell and first globe prototype:

- smooth 3D Earth generated from Natural Earth country boundaries
- deliberately low-resolution, palette-limited pixel geography
- mouse/touch rotation and wheel/pinch zoom
- idle rotation that pauses on interaction
- pause/resume and reset controls
- reduced-motion support and browser error states
- responsive navy retro-game layout

Country selection, club markers, filters, player data, and profiles are intentionally deferred to later milestones in [the design spec](docs/DESIGN_SPEC.md).

## Run locally

Run `npm install`, then `npm run dev`. The dependency lockfile still reflects the generated starter until the first successful install.

## Source data

The provisional globe uses Natural Earth `ne_110m_admin_0_countries` boundaries from `nvkelso/natural-earth-vector`. It generates the visible map at runtime and will underpin selectable geography in Milestone 2.

## Product rules

- Coverage is Nigerian players at clubs outside Nigeria.
- Navigation is World → Continent → League Country → Club → Player.
- Markers use actual coordinates; league country determines navigation.
- England, Scotland, Wales, Northern Ireland, and Ireland are separate European football destinations.
- Club identity uses kit colours and front-of-shirt player numbers—no club logos or sponsors.
- Current match, season, and confirmed transfer information is planned after V1.
