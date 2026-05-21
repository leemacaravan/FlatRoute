# FlatRoute

A hill-aware navigation web app. Regular maps give you the fastest route but
won't warn you it climbs a brutal hill. FlatRoute does. Built first for San
Francisco, where hill grade massively changes the experience.

## Guiding principle: own everything, depend on no one

This app is built to eventually ship on the App Store with no licensing risk,
no third party that can revoke access, and no one who can object to its use.
Therefore:

- ALL software is open source and permissively licensed (MIT / BSD / Apache).
- ALL map data is openly licensed (OpenStreetMap ODbL, public-domain elevation
  data). The only obligation that comes with this is ATTRIBUTION — see below.
- Any hosted service used is a temporary convenience on a free tier, chosen so
  it can be swapped or self-hosted later WITHOUT changing app code.
- Data the app itself generates (user GPS traces, route choices) is owned by
  the project and is the long-term path to better accuracy without third parties.

## Tech stack (all open source)

- React + Vite
- MapLibre GL JS for the map (open-source, BSD; a community fork of Mapbox GL)
- OpenRouteService (ORS) for routing AND elevation — open source, OSM-based,
  returns elevation along routes, has a free API key tier to start
- OpenStreetMap data, served via an OSM-based tile provider. Default is
  OpenFreeMap (free, no API key). Optionally Stadia Maps if VITE_TILE_KEY is
  set. Swappable later for self-hosted tiles without changing app code.
- Public-domain elevation data (SRTM/USGS) — ORS already provides this in route
  responses; no separate elevation call needed
- recharts for the elevation profile chart
- Plain CSS or CSS modules — no heavy UI framework

## Attribution (REQUIRED — non-negotiable)

The map must always display "© OpenStreetMap contributors" and credit the tile
provider and ORS as their licenses require. This is the only obligation that
comes with the open data and it must never be removed.

## API keys

`.env` holds the keys. `.env` is in `.gitignore` — never hardcode keys.
- `VITE_ORS_KEY` — REQUIRED. The OpenRouteService key. Search, routing, and
  elevation all fail without it. Get a free key at openrouteservice.org.
- `VITE_TILE_KEY` — OPTIONAL. A Stadia Maps key for a nicer map style. The map
  works without it via OpenFreeMap.
These are two different services from two different companies; their keys are
not interchangeable. Keep all hosted-service usage on free tiers.

## Grade thresholds

Grade = rise / run, as a percentage. Color-code route segments and flag steep
sections with these cutoffs:

- 0-4%   : flat        (green)
- 4-8%   : moderate    (yellow)
- 8-12%  : steep       (orange)
- 12%+   : very steep  (red)

Mode-aware warnings: warn cyclists at 8%+, walkers at 12%+, drivers at 15%+.
Map color coding is the same for all modes.

## v1 — hill-avoidance core — COMPLETE

All of v1 is built and working:
1. Origin + destination search with autocomplete (ORS geocoding)
2. Fetch a route from ORS and draw it on the map
3. Compute grade from the elevation data ORS returns
4. Show total distance, total elevation gain, max grade
5. Elevation profile chart with chart-to-map hover sync
6. "Fastest" vs "Flattest" route toggle (Flattest = lowest elevation gain,
   tie-broken by lowest max grade)
7. Route line color-coded by steepness; steep-section warnings per mode

## v1.5 — navigation — CURRENT WORK

FlatRoute must let users actually FOLLOW the flat route. The core problem:
handing off to an external maps app loses our exact route, because external
apps only accept origin/destination/waypoints and re-plan with their own
router. So FlatRoute offers TWO navigation paths, both honestly labeled:

A. In-app turn-by-turn (the headline feature — keeps our EXACT route):
   - ORS route responses already contain step-by-step instructions; parse them
     in src/utils/ into a clean step list (instruction, distance, duration,
     maneuver type, maneuver coordinate).
   - Show the user's live position via the browser Geolocation API
     (watchPosition).
   - A navigation mode: follow-the-user map view, current step shown large,
     auto-advance steps as the user passes maneuver points, ETA + remaining
     distance, off-route detection.
   - Optional voice via the browser SpeechSynthesis API, with a mute toggle.
   - Built in stages, each tested before the next: (1) step list, (2) live
     location dot, (3) navigation mode, (4) off-route + voice + polish.

B. External handoff (convenience — route is approximate):
   - "Open in Google Maps / Apple Maps / Waze" options.
   - To preserve flatness, pass a small set (~3-6) of intermediate WAYPOINTS
     selected from the active route — specifically points where our route
     diverges from the straight-line path (the deliberate hill-avoiding
     detours). Logic lives in src/utils/.
   - Degrade gracefully per app: Google handles multiple waypoints well, Apple
     is limited, Waze mainly supports a single destination.
   - Always show an honest note that external apps may adjust the route.

GPS limitation to respect: while FlatRoute is still a web app (pre-Capacitor),
the browser only updates location while the app is open and on screen.
Background/screen-off navigation needs the native wrap (v3). Build the
navigation UI now; it will simply work better once wrapped. Do not fake
background location.

## Long-term target: this becomes a mobile app

FlatRoute will be wrapped as a native iOS/Android app using Capacitor. Build
with that in mind from day one:

- Build it as a Progressive Web App (PWA): web app manifest + service worker,
  so it is installable and behaves like an app.
- Keep ALL business logic (route math, grade calc, API calls) in `src/services/`
  and `src/utils/`, never inside components. UI is a thin swappable layer.
- Mobile-first layout. Phone screen first, desktop second. Touch targets at
  least 44x44px. No hover-only interactions.
- For location, use the standard browser Geolocation API only — it maps cleanly
  to a Capacitor native plugin later.
- Keep dependencies lean; every heavy library is friction when wrapping.

## User data for future accuracy (build the plumbing, use later)

From day one, structure the app so user GPS traces and chosen routes CAN be
logged locally with explicit user consent. Do not send this anywhere yet and do
not build analytics on it yet — just keep the data model clean so a future
version can use real user data to improve grade and route accuracy. This data
belongs to the project; it is the path to accuracy without third parties.

## Future phases (do NOT build yet, just don't block them)

- v2: parking suggestions + fuel cost calculator
- v3: wrap with Capacitor for iOS/Android App Store submission; enables
  background/screen-off navigation
- v4: use logged user data to refine accuracy; optionally self-host tiles

## Code conventions

- Functional components with hooks
- One file per external API under `src/services/`
- Route math (grade, gain totals) in `src/utils/`
- Mobile-responsive; the map must be usable on a phone