# Redesign, upcoming releases and personal suggestions

- New black, burgundy and old-gold theme with subtle motion and animated dropdowns.
- Filter bar with several genres, a year range, half-point score and airing status; hide-watched tick box.
- Upcoming and My upcoming pages, a Releasing this week strip, and a bell to follow unreleased titles.
- "For you" rebuilt: separate TMDB-keyword and AniList-tag taste models, weighted by watching, ratings, favourites and rewatches.
- "Tonight, decided" is now a three-question game that mixes the watchlist with suggestions.
- People pages (photo, biography, age, sortable credits), an in-app trailer player, star ratings, episode tracking with a watched percentage, ongoing/ended labels and a next-episode banner.
- Cards update in place (rating box after "watched", smooth removal) instead of rebuilding the page.
- Removed: Undo, the Watch diary menu entry, the per-title notes/tags/priority panel and the "Log a watch" dialog.
- Hardened image URL validation, malformed-URL handling, and refreshed the offline cache.

# Phone pass

- Finger-sized controls, whole-star rating taps on touch, a scrolling type selector, calendar events as posters, and no hover states that stick after a tap.
- Title and person views are full-screen pages and Settings/Tonight are bottom sheets on phones; safe-area spacing for notches.
- The Android back button (and a browser's) closes the top dialog before leaving the page.

# Standalone data layer

- The catalogue code and the API routes (`api-core.js`) now run in the app itself, so it works with no Node server: the TMDB read token is pasted, tested and saved in Settings (kept only on the device, never in backups).
- The server and the in-app adapter share the same validation and answers.
- Fixed anime lists ignoring the chosen sort (AniList was never sent a sort order).

# Small library improvements

- Added reversible Not interested filtering, a restore list and exclusion from taste signals and tonight picks.
- Added single-step undo for saved library changes, with a storage check to protect updates from other tabs.
- Added collection notes, escaped display, backward-compatible backup migration and import limits.
- Updated the offline shell cache and added regression coverage for dismissal, restore, undo, collection deletion and note persistence.

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
