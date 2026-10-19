# Movie World v2.0

## Added

- Personal observatory: metrics, genre profile, monthly activity, annual watch goal and continue-watching controls.
- Watch diary: finish dates, rewatches, ratings, reflections and individual episode sessions.
- Collection galleries, grid/list layouts, priority watchlists, personal tags and bulk organisation.
- Genre/year/score discovery filters, a runtime-aware watch-night picker and explainable taste recommendations.
- Calendar of diary activity and available release/next-episode dates from saved live metadata.
- Live regional streaming/rental/purchase availability, season exploration, spoiler-collapsed episode descriptions and related titles.
- One-click refresh of demo titles into live metadata, using the same stable library identities.
- Automatic migration of existing local libraries and richer export/import validation.
- Offline app shell, preview search, demo details and bundled artwork through a service worker; live API data and credentials are excluded from its cache.
- Development-only DOM integration testing and expanded backend/domain tests.

## Verification scope

The initial release was visually reviewed in desktop and mobile browsers. Browser control was unavailable during this v2 session. V2 is verified through syntax checks, domain tests, HTTP endpoint tests, in-memory DOM interaction tests, and live AniList lookups. Real TMDB calls remain unverified until a read token is configured.

The app remains local-first: no account service, cloud sync, social network or video streaming is included. The server keeps provider credentials out of browser code. Browser libraries are private to their browser profile and origin; exported backups can move them between devices.
