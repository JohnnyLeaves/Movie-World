# Movie World

A personal movie, TV and anime discovery app with a cinematic cyberpunk interface. Built for desktop and mobile browsers with a small Node.js server, native ES modules and **zero runtime dependencies**.

The app combines discovery, tracking and personal suggestions across movies, series and anime, with the data kept in your own browser.

## Run locally

Install [Node.js 22.9+](https://nodejs.org/), open a terminal in this repository, then:

```powershell
npm start
```

Open **http://127.0.0.1:3000**. No install step, build step, database or API key is required for the demo. `npm run dev` restarts the server when source files change; refresh the browser to pick up frontend changes.

## Features

### Discover

- **Filter bar** on the explore pages: pick up to four genres (a title must match all of them), a release-year range with decade shortcuts, a minimum score in half-point steps and, for series and anime, an airing status (new, on TV now, ended). Active filters show as removable chips.
- **Hide titles I have watched** tick box under the filters on Discover, Movies, TV series and Anime. It filters the loaded page and is remembered.
- **Upcoming** page for movies, series and anime that have not released yet (TMDB for movies and series, AniList for anime). Tap the bell on a card to follow a title; followed titles live on **My upcoming**, grouped into releasing this week, later, to be announced and already out. Discover also shows a **Releasing this week** strip.
- **For you** builds a separate taste profile for movies and series (TMDB keywords) and for anime (AniList tags), from what you watched, rated and favourited. A watched title counts a little, a 5 a little, 7.5 more, a favourite more again whatever its rating, and a rewatch more still. Low ratings and dropped titles steer away. Candidates come from keyword searches and TMDB's similar-title lists, and each card says why it was picked. Tabs: All, Movies, TV series, Anime.
- **Tonight, decided** is a small game: three quick questions (mood, time, genre), then one card drawn from your watchlist and your personal suggestions, with **Pick another**.
- **Title pages** with cast and crew, streaming services you can subscribe to in your region, related titles, an in-app trailer player, seasons and episodes, and a next-episode banner for shows still airing.
- **People**: click Starring or Created by to browse the cast, then open anyone for their photo, biography, age and credits, sortable by popularity, year or rating.

### Track what you watch

- **Mark watched** on cards and title pages. On a card it opens a quick rating box; unmarking works the same way.
- **Star rating** (half-point steps) on every title page, with the percentage of a series you have watched below it.
- **Episode tracking**: tick individual episodes or a whole season; the title's status follows (watching, completed, or "up to date" for shows still airing). Each episode shows its runtime, score and date.
- **Ongoing / Ended** labels for series and anime, with a rewatch option only once everything has been watched and the show has ended.
- Favourites, a Rewatch list, **Not interested** (hides a title from discovery and suggestions; restore it from its list), collections with notes, multi-select organisation, and a Watchlist page.
- A dashboard with library totals and an annual goal, and a calendar of next-episode and release dates taken from saved live metadata. Demo dates are never invented.
- JSON export and validated import with an explicit replacement confirmation.

### Interface

- Black, burgundy and crimson theme with old-gold accents, subtle motion (disabled automatically for reduced-motion users), animated dropdowns that replace the browser's native list, and keyboard-friendly controls.
- Grid and list layouts, accessible dialogs, responsive layouts and image fallbacks.
- Service-worker support caches the demo catalogue, bundled artwork and app shell after the first successful visit. The demo and your local library can then open offline. Live search, uncached live artwork and trailers require connectivity.

For live movie/TV browsing, filters are sent to TMDB's discover API. Live anime filters are sent to AniList. TMDB text-search results, the combined All worlds feed and Jikan fallback results are filtered within the current provider page. Provider totals may therefore exceed the number of matches visible on that page.

Suggestions are a transparent local ranking, not a claim of AI-based or whole-catalogue prediction. Movies and series are never mixed into the anime model, because the two providers use different vocabularies. Demo mode keeps a simpler genre-based version.

## Enable the full catalogue

The app starts with 24 clearly labelled preview titles and bundled preview artwork. Demo metadata is an editorial snapshot, not current provider data. Live catalogue images require internet access; fallback artwork remains usable when images cannot load.

1. Create a [TMDB account and request API access](https://www.themoviedb.org/settings/api).
2. Copy `.env.example` to `.env` in the repository root:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Put the **API Read Access Token** in `.env`:

   ```dotenv
   TMDB_READ_TOKEN=your_read_access_token
   ```

4. Restart the server. Open **Settings → Catalogue mode → Live**.

The app expects a TMDB **Bearer read token**, not the shorter v3 API key and not a user session ID. Never commit `.env`. The token is used only by the server and is never sent to the browser. No in-app account or TMDB user login is needed to save your personal library.

**Anime works without a key:** select Live in Settings, then browse the Anime tab. When no TMDB token is configured, switching to live automatically selects Anime. The combined All worlds live feed requires a TMDB token and searches TMDB and the anime provider. The movie/TV and anime catalogues may list the same anime separately; provider identities remain separate to prevent incorrect merges. Combined pages follow each provider’s own pagination and ranking. Sorting is available in individual browse tabs; search uses provider relevance.

**No server (phone app):** when the page is opened without the Node server (for example from a static host or a packaged app), it calls TMDB, AniList and Jikan directly. Paste the token in **Settings → TMDB**, press Test, then Save. The token is stored only on that device and is not part of library backups.

## Android app

Needs Android Studio (for its bundled Java 21 and the Android SDK). In PowerShell:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
"sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk" | Set-Content android\local.properties
npm run apk
```

Back closes a dialog, then steps back through pages, then leaves the app. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`; copy it to the phone and install it (allow installs from your file manager). Re-run `npm run apk` after any change in `public/`. `npm run icons` regenerates the launcher icon and splash screen from `public/assets/icon.svg`'s drawing in `scripts/make-icons.mjs`. Library backups are exported through the Android share sheet.

## Data and privacy

The personal library is stored under `movie-world.library.v1` in **this browser’s localStorage**. It is not sent to TMDB or Jikan. There is no cloud sync, account backend or server-side user database in this MVP. A different browser, profile or origin (including changing ports) has a separate library. Export a JSON backup before clearing browser data or moving devices. Import replaces the current library after confirmation.

The app does not stream films or episodes. Trailers, when available, play in an embedded YouTube player (youtube-nocookie.com), which receives a normal browser request; ads inside a trailer are up to YouTube. Live artwork and Google Fonts are fetched from their respective providers, which receive normal browser requests. Demo artwork is bundled locally. Searches and title lookups go through the local server to TMDB/AniList/Jikan. After a successful initial visit and service-worker installation, the app shell, demo search, preview details, bundled artwork and local library are available offline. Live API responses and provider credentials are never placed in the service-worker cache. Browser support and permission to use service workers are required; localhost is supported without HTTPS.

## APIs and licensing

| Provider | Purpose                                                            | Authentication                    | Documentation                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TMDB     | Movie / TV search, discovery, metadata, cast, trailers and artwork | Server-side API Read Access Token | [Application authentication](https://developer.themoviedb.org/docs/authentication-application), [multi-search](https://developer.themoviedb.org/reference/search-multi), [FAQ and licensing](https://developer.themoviedb.org/docs/faq) |
| AniList  | Primary anime search and metadata                                  | No API key                        | [Public API](https://docs.anilist.co/guide/auth/), [media queries](https://docs.anilist.co/guide/graphql/queries/media)                                                                                                                 |
| Jikan v4 | Fallback anime search and metadata from MyAnimeList                | No API key                        | [REST API documentation](https://docs.api.jikan.moe/), [Jikan](https://jikan.moe/)                                                                                                                                                      |

TMDB’s developer API is free for non-commercial use with attribution. Revenue-generating use requires discussing commercial licensing with TMDB. API access and availability are controlled by each provider; no catalogue guarantees coverage of every title ever made. Jikan is an unofficial MyAnimeList API and has rate limits. The server serialises AniList requests with a 2.1-second minimum interval, Jikan requests with a 400 ms minimum interval and caches successful responses for five minutes (maximum 300 entries). Upstream timeouts, rate limits and partial combined-provider outages are surfaced in the interface.

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie and anime artwork belongs to its respective rights holders.

## Verification

```powershell
npm ci
npm run check
npm test
```

`npm ci` installs development-only test dependencies. It is unnecessary for running the app. In addition to the Node tests, a Happy DOM integration test exercises the filter bar, rating, watched and rewatch controls, collections, hide-watched, dismissal, the tonight game and navigation in an isolated in-memory DOM. It does not replace visual browser QA.

The automated tests cover taste weights, ranking and the tonight pick, library persistence/backup round trips, title updates, collection lifecycle, filtering, import validation, provider normalization, demo search, authorization headers, cache reuse, upstream failure handling, and actual HTTP routes, validation, static files and security headers. Tests mock upstream catalogue services; live TMDB verification requires your read token.

## Structure

```text
public/            Browser UI, CSS, icons and manifest
public/js/app.js    View rendering, dialogs, routes and interactions
public/js/library.js  Pure library operations and backup validation
public/js/insights.js  Taste profiles, ranking, tonight pick, stats
public/js/select-menu.js  Animated dropdown lists
public/theme.css   Colour theme, motion and the newer components
server/index.js    HTTP server, static assets, API routes and security headers
public/js/catalog.js  TMDB / AniList / Jikan adapters, cache and request scheduling (runs in the server and in the app)
public/js/demo.js  Editorial preview catalogue
public/js/api-core.js  The /api/* routes and validation, shared by the server and the app
public/js/local-api.js  In-app API for the no-server mode, with the pasted TMDB token
public/mobile.css  Phone layout, touch sizes and safe areas
tests/             Node test runner tests
```

`HOST` defaults to `127.0.0.1`; `PORT` defaults to `3000`. A hosted Node deployment can set `HOST=0.0.0.0`, supply `TMDB_READ_TOKEN` through the host’s secret manager, and run `npm start`. This repository has no deployment-specific service dependency. Before opening a deployment to the public, add authentication or request quotas to protect the shared API token and provider limits. A next release can add a user database and optional cross-device sync without changing the catalogue provider interface.
