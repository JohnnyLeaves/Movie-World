import {
  STORAGE_KEY,
  emptyLibrary,
  parseLibrary,
  saveTitle,
  removeTitle,
  addFolder,
  deleteFolder,
  renameFolder,
  filterEntries,
  STATUSES,
  validateTitle,
  toggleInterested,
} from "./library.js";
import {
  filterBar,
  renderExperience,
  detailExtras,
  weekRange,
  GENRES,
} from "./experience.js";
import {
  logWatch,
  tonightPick,
  tasteProfiles,
  topKeywords,
  rankForYou,
  entryWeight,
  today,
  validDate,
  hasWatched,
} from "./insights.js";
import { matchesFilters } from "./catalog-filters.js";
import { initSelectMenus } from "./select-menu.js";

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// The rarely used library views live behind a "···" toggle; open it automatically when one is the current page.
let navMore = false;
try {
  navMore = localStorage.getItem("movie-world.nav-more") === "1";
} catch {}
const moreOpen = () =>
  navMore || ["favorites", "rewatch", "dismissed"].includes(route);
const REGIONS = [
  ["PT", "Portugal"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["ES", "Spain"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["JP", "Japan"],
  ["BR", "Brazil"],
];
const paths = {
  search: "m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  compass:
    "m16.2 7.8-3 5.4-5.4 3 3-5.4 5.4-3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  film: "M4 3h16v18H4zM4 7h16M4 17h16M8 3v18M16 3v18",
  tv: "M3 7h18v14H3zM8 2l4 5 4-5",
  anime: "m13 2-3 8H4l7 5-2 7 11-12h-7l3-8",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8",
  folder: "M3 7V4h6l3 3h9v13H3z",
  plus: "M12 5v14M5 12h14",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  play: "m8 5 12 7-12 7V5",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  more: "M12 5h.01M12 12h.01M12 19h.01",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  library: "M4 4h4v16H4zM11 4h4v16h-4zM18 4l4 15",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
  edit: "m15 4 5 5-11 11H4v-5L15 4",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  globe:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2c5 5 5 15 0 20-5-5-5-15 0-20",
  menu: "M3 6h18M3 12h18M3 18h18",
  chevron: "m9 5 7 7-7 7",
  sliders: "M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M15 4v4M9 10v4M17 16v4",
  clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.film}"/></svg>`;
const labels = { movie: "Movie", tv: "Series", anime: "Anime" };
const statusLabels = {
  planned: "Want to watch",
  watching: "Watching",
  completed: "Completed",
  "on-hold": "On hold",
  dropped: "Dropped",
};
let library = emptyLibrary(),
  storageProblem = "",
  mode = "demo",
  config = { tmdbConfigured: false };
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) library = parseLibrary(raw);
  mode = localStorage.getItem("movie-world.mode") === "live" ? "live" : "demo";
} catch {
  storageProblem =
    "Your saved library could not be loaded. The original data has been left untouched. Export it from your browser before replacing it.";
}
let route = "discover",
  folderId = "",
  query = "",
  sort = "popular",
  libraryStatus = "all",
  libraryKind = "all",
  page = 1,
  catalogData = null,
  loading = false,
  error = "",
  controller,
  searchTimer,
  selected = null,
  detailController,
  detailLoading = false,
  detailError = "",
  toastTimer;
const emptyFilters = () => ({ genres: [], yearFrom: "", yearTo: "", minScore: 0, airing: "" });
let filtersOpen = false;
// "Hide titles I've watched" on the explore pages (not on your own lists).
const EXPLORE = ["discover", "movie", "tv", "anime"];
let hideWatched = false;
try {
  hideWatched = localStorage.getItem("movie-world.hide-watched") === "true";
} catch {}
let discoveryFilters = emptyFilters(),
  viewMode = "grid",
  selectionMode = false,
  selection = new Set(),
  calendarMonth = today().slice(0, 7),
  watchRegion = "PT";
try {
  viewMode =
    localStorage.getItem("movie-world.view") === "list" ? "list" : "grid";
  watchRegion = localStorage.getItem("movie-world.region") || "PT";
} catch {}
const availabilityCache = new Map(),
  seasonCache = new Map();
let seasonNumber = 1,
  recommendationOffset = 0;
const titleCache = new Map();
const isPersonal = () =>
  [
    "library",
    "favorites",
    "folder",
    "watched",
    "rewatch",
    "dismissed",
  ].includes(route);
const isExperience = () =>
  ["dashboard", "diary", "collections", "calendar", "interested", "recommendations"].includes(
    route,
  );
let upcomingKind = "movie";
let forYouTab = "all";
const kind = () =>
  route === "upcoming"
    ? upcomingKind
    : ["movie", "tv", "anime"].includes(route)
      ? route
      : "all";
function toast(text) {
  $("#toast").innerHTML =
    `<span>${esc(text)}</span>`;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function persist(next) {
  if (storageProblem) {
    toast(
      "Resolve the saved-library issue in Settings before changing your library.",
    );
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    library = next;
    renderSidebar();
    renderStats();
    return true;
  } catch {
    toast(
      "Unable to save: browser storage is full or disabled. Export a backup in Settings.",
    );
    return false;
  }
}
function shell() {
  $("#app").innerHTML =
    `<aside class="sidebar" id="sidebar"><a href="#discover" class="brand"><img src="/assets/icon.svg" alt=""/><span>MOVIE<span class="brand-light">WORLD</span><small>YOUR CINEMATIC UNIVERSE</small></span></a><div id="sidebar-nav"></div></aside><button class="nav-scrim" data-action="close-menu" aria-label="Close navigation"></button>
  <div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false" data-action="menu">${icon("menu")}</button><div class="breadcrumb"><span>Movie World</span>${icon("chevron")}<strong id="breadcrumb">Discover</strong></div><div class="search-wrap">${icon("search")}<input type="search" id="global-search" maxlength="150" placeholder="Search movies, series, anime…" aria-label="Search titles" autocomplete="off"/><kbd>/</kbd></div><button class="mode-indicator" data-action="settings" id="mode-indicator"></button><button class="top-avatar" data-action="settings" aria-label="Open settings">MW</button></header><main id="main" tabindex="-1"></main><footer><span>Made for the love of the screen.</span><button data-action="settings">Catalogue credits & settings ${icon("arrow")}</button></footer></div>`;
  renderSidebar();
  renderMode();
}
function syncNavigation() {
  const sidebar = $("#sidebar");
  if (!sidebar) return;
  const mobile = matchMedia("(max-width: 620px)").matches;
  sidebar.inert = mobile && !sidebar.classList.contains("open");
  $(".mobile-menu")?.setAttribute(
    "aria-expanded",
    String(sidebar.classList.contains("open")),
  );
}
function renderSidebar() {
  const entries = Object.values(library.entries),
    favorites = entries.filter((e) => e.favorite).length;
  const nav = (id, label, ico, count) =>
    `<a href="#${id}" class="nav-link ${route === id ? "active" : ""}" ${route === id ? 'aria-current="page"' : ""}>${icon(ico)}<span>${label}</span>${count !== undefined ? `<span class="nav-count">${count}</span>` : ""}${route === id ? "<i></i>" : ""}</a>`;
  const sidebarHtml =
    `<div class="nav-label">EXPLORE</div><nav aria-label="Explore">${nav("discover", "Discover", "compass")}${nav("movie", "Movies", "film")}${nav("tv", "TV series", "tv")}${nav("anime", "Anime", "anime")}</nav><div class="nav-label">YOUR LIBRARY</div><nav aria-label="Your library">${nav("dashboard", "Dashboard", "grid")}${nav("library", "Watchlist", "library", entries.length)}${nav("calendar", "Calendar", "tv")}${nav("upcoming", "Upcoming", "spark")}${nav("interested", "My upcoming", "bell", Object.keys(library.interested || {}).length)}${nav("recommendations", "For you", "star")}<button class="nav-link nav-more-toggle" data-action="nav-more" aria-expanded="${moreOpen()}" aria-label="More library views">${icon("dots")}</button><div class="nav-more ${moreOpen() ? "open" : ""}"><div>${nav("favorites", "Favourites", "heart", favorites)}${nav("rewatch", "Rewatch list", "clock", entries.filter((e) => e.rewatchQueued).length)}${nav("dismissed", "Not interested", "close", Object.keys(library.dismissed || {}).length)}</div></div></nav><div class="nav-label collection-label">COLLECTIONS<button data-action="new-folder" class="icon-button" aria-label="Create collection">${icon("plus")}</button></div><nav aria-label="Collections">${library.folders.map((f, i) => `<a href="#folder/${esc(f.id)}" class="nav-link folder-link ${route === "folder" && folderId === f.id ? "active" : ""}" ${route === "folder" && folderId === f.id ? 'aria-current="page"' : ""}><span class="folder-color color-${i % 4}">${icon("folder")}</span><span>${esc(f.name)}</span><span class="nav-count">${entries.filter((e) => e.folders.includes(f.id)).length}</span></a>`).join("")}</nav><button class="create-collection" data-action="new-folder">${icon("plus")} New collection</button>`;
  const side = $("#sidebar-nav");
  if (side.dataset.sig === sidebarHtml) return;
  side.dataset.sig = sidebarHtml;
  side.innerHTML = sidebarHtml;
  syncNavigation();
}
function renderMode() {
  const el = $("#mode-indicator");
  el.innerHTML = `<span class="status-dot ${mode === "live" ? "live" : ""}"></span>${mode === "live" ? "Live catalogue" : "Demo catalogue"}`;
}
function renderStats() {
  const el = $("#library-stats");
  if (!el) return;
  const entries = Object.values(library.entries);
  const statsHtml = `<span>${icon("library")} <b>${entries.length}</b> in your library</span><span>${icon("heart")} <b>${entries.filter((e) => e.favorite).length}</b> favourites</span><span>${icon("folder")} <b>${library.folders.length}</b> collections</span>`;
  if (el.dataset.sig === statsHtml) return;
  el.dataset.sig = statsHtml;
  el.innerHTML = statsHtml;
}
// With no Node server (the phone app) the same /api/... calls are answered by the in-app adapter instead.
let localApi = null,
  backendReady = Promise.resolve();
async function api(path, signal) {
  await backendReady;
  if (localApi) return localApi.request(path);
  const response = await fetch(path, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function readRoute() {
  const [next, id] = location.hash.slice(1).split("/"),
    prevRoute = route;
  route = [
    "discover",
    "movie",
    "tv",
    "anime",
    "library",
    "favorites",
    "folder",
    "watched",
    "rewatch",
    "dismissed",
    "dashboard",
    "diary",
    "collections",
    "calendar",
    "upcoming",
    "interested",
    "recommendations",
  ].includes(next)
    ? next
    : "discover";
  folderId = id || "";
  upcomingKind = ["movie", "tv", "anime"].includes(id) ? id : "movie";
  forYouTab = ["movie", "tv", "anime"].includes(id) ? id : "all";
  query = "";
  $("#global-search").value = "";
  page = 1;
  sort = isPersonal() ? "recent" : "popular";
  libraryStatus = "all";
  libraryKind = "all";
  discoveryFilters = emptyFilters();
  recommendationOffset = 0;
  selectionMode = false;
  selection.clear();
  $("#sidebar").classList.remove("open");
  renderSidebar();
  $("#breadcrumb").textContent =
    route === "folder"
      ? library.folders.find((f) => f.id === folderId)?.name || "Collection"
      : {
          discover: "Discover",
          movie: "Movies",
          tv: "TV series",
          anime: "Anime",
          library: "Watchlist",
          favorites: "Favourites",
          dashboard: "Dashboard",
          diary: "Watch diary",
          collections: "Collections",
          calendar: "Calendar",
          upcoming: "Upcoming",
          interested: "My upcoming",
          recommendations: "For you",
          watched: "Watched",
          rewatch: "Rewatch list",
          dismissed: "Not interested",
        }[route];
  if (prevRoute === "recommendations" && route === "recommendations" && forYouRaw && mode === "live") return renderMain();
  load();
}
// Discover's "Releasing this week" strip: followed titles first, then the week's most popular releases.
let weekData = null;
let weekAt = 0;
async function loadWeek() {
  if (mode !== "live" || (weekData && Date.now() - weekAt < 30 * 60000)) return;
  const results = await Promise.allSettled(
    ["movie", "tv", "anime"].map((k) =>
      api(`/api/catalog?mode=live&kind=${k}&airing=week&sort=popular`),
    ),
  );
  weekData = results.flatMap((r) =>
    r.status === "fulfilled"
      ? r.value.results.filter((t) => t.poster).slice(0, 4)
      : [],
  );
  weekAt = Date.now();
  if (route === "discover" && !query) renderMain();
}
function weekStrip() {
  const [from, to] = weekRange(),
    mine = Object.values(library.interested || {}).filter(
      (t) => t.releaseDate >= from && t.releaseDate <= to,
    ),
    items = [...mine, ...(weekData || []).filter((t) => !mine.some((m) => m.key === t.key))].slice(0, 12);
  if (!items.length && weekData) return "";
  return `<section class="week-strip" aria-label="Releasing this week"><div class="week-head"><div><div class="eyebrow">RELEASING THIS WEEK</div><h2>New on the horizon.</h2></div><a class="text-link" href="#upcoming">See all upcoming ${icon("arrow")}</a></div>${items.length ? `<div class="week-row">${items.map((t) => card(t, true)).join("")}</div>` : '<p class="inline-loading" role="status">Checking this week’s releases…</p>'}</section>`;
}
// --- "For you": per-provider candidates ranked against the user's taste ----------------
let forYouRaw = null;
const enrichTried = new Set();
// Saved titles from before keywords existed get them fetched once, so the profile has something to match on.
async function enrichLiked() {
  const need = Object.values(library.entries)
    .filter((e) => !e.title.demo && !e.title.keywords?.length && !enrichTried.has(e.title.key))
    .map((e) => [e, Math.abs(entryWeight(library, e))])
    .filter(([, w]) => w >= 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  if (!need.length) return;
  need.forEach(([e]) => enrichTried.add(e.title.key));
  const fetched = await Promise.allSettled(
    need.map(([e]) => api(`/api/title/${e.title.source}/${e.title.kind}/${e.title.id}?mode=live`)),
  );
  const entries = { ...library.entries };
  fetched.forEach((r, i) => {
    const key = need[i][0].title.key;
    if (r.status === "fulfilled" && entries[key])
      entries[key] = { ...entries[key], title: validateTitle({ ...entries[key].title, keywords: r.value.keywords || [] }) };
  });
  persist({ ...library, entries });
}
async function fetchForYou(signal) {
  await configReady;
  await enrichLiked();
  const profiles = tasteProfiles(library),
    jobs = [
      ["movie", profiles.tmdb],
      ["tv", profiles.tmdb],
      ["anime", profiles.anime],
    ].filter(([k]) => k === "anime" || config.tmdbConfigured);
  const settled = await Promise.allSettled(
    jobs.map(([k, p]) => {
      const payload = {
        keywords: topKeywords(p, 6).map(({ id, name }) => ({ id, name })),
        seeds: p.seeds.filter((s) => s.kind === k).slice(0, 4).map(({ id, title }) => ({ id, title })),
      };
      return api(`/api/foryou?kind=${k}&profile=${encodeURIComponent(JSON.stringify(payload))}`, signal);
    }),
  );
  const raw = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") raw[jobs[i][0]] = r.value.results;
  });
  if (!Object.keys(raw).length) throw new Error("Suggestions are unavailable right now. Please try again.");
  return raw;
}
async function loadForYou() {
  controller?.abort();
  const own = (controller = new AbortController());
  loading = true;
  error = "";
  renderMain();
  try {
    const raw = await fetchForYou(own.signal);
    if (own !== controller) return;
    forYouRaw = raw;
  } catch (e) {
    if (e.name === "AbortError") return;
    error = e.message;
  }
  loading = false;
  renderMain();
}
// Ranked suggestions per type, recomputed on every render so saving or dismissing a title drops it at once.
function forYouView() {
  if (!forYouRaw) return null;
  const profiles = tasteProfiles(library),
    section = (kind, p) => ({
      kind,
      items: rankForYou(p, forYouRaw[kind] || [], library, 32),
    });
  return {
    movie: section("movie", profiles.tmdb).items,
    tv: section("tv", profiles.tmdb).items,
    anime: section("anime", profiles.anime).items,
    taste: {
      tmdb: topKeywords(profiles.tmdb, 6).map((k) => k.name),
      anime: topKeywords(profiles.anime, 6).map((k) => k.name),
    },
  };
}
function applyFilters(next) {
  discoveryFilters = next;
  page = 1;
  load();
}
const catalogUrl = (p) =>
  `/api/catalog?${new URLSearchParams({ kind: route === "recommendations" && mode === "live" && !config.tmdbConfigured ? "anime" : kind(), query: route === "recommendations" ? "" : query, sort, page: String(p), mode, genre: discoveryFilters.genres.join(","), yearFrom: discoveryFilters.yearFrom, yearTo: discoveryFilters.yearTo, minScore: String(discoveryFilters.minScore), airing: discoveryFilters.airing, ...(route === "upcoming" ? { airing: "upcoming" } : {}) })}`;
// Infinite scroll: a sentinel under the grid asks for the next page when it nears the screen, and the new cards
// are appended in place so the ones already shown never re-render.
let moreObserver = null,
  loadingMore = false;
const listed = (t) => !library.dismissed?.[t.key] && !(hideWatched && EXPLORE.includes(route) && hasWatched(library, t.key));
function watchSentinel() {
  moreObserver?.disconnect();
  const sentinel = $(".load-sentinel");
  if (!sentinel || typeof IntersectionObserver === "undefined") return;
  moreObserver = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: "800px 0px" });
  moreObserver.observe(sentinel);
}
async function loadMore() {
  const sentinel = $(".load-sentinel");
  if (loadingMore || !catalogData || !sentinel) return;
  loadingMore = true;
  const own = controller,
    next = page + 1;
  sentinel.classList.remove("failed");
  sentinel.textContent = "Loading more…";
  try {
    const data = await api(catalogUrl(next), own.signal);
    if (own !== controller) return;
    page = next;
    const seen = new Set(catalogData.results.map((t) => t.key)),
      fresh = data.results.filter((t) => !seen.has(t.key));
    catalogData = { ...catalogData, results: [...catalogData.results, ...fresh], totalPages: data.totalPages };
    fresh.forEach((t) => titleCache.set(t.key, t));
    $(".title-grid:not(.skeleton-grid)")?.insertAdjacentHTML("beforeend", fresh.filter(listed).map(card).join(""));
    bindImages();
    if (page >= Math.min(data.totalPages, 500)) sentinel.replaceWith(Object.assign(document.createElement("p"), { className: "end-note", textContent: "You have reached the end." }));
  } catch (e) {
    if (e.name === "AbortError" || own !== controller) return;
    sentinel.classList.add("failed");
    sentinel.textContent = "Could not load more. Tap to try again.";
  } finally {
    loadingMore = false;
    if (own === controller) watchSentinel();
  }
}
async function load() {
  controller?.abort();
  loadingMore = false;
  if (route === "recommendations" && mode === "live") return loadForYou();
  if (route === "discover" && !query) loadWeek();
  if (isPersonal() || (isExperience() && route !== "recommendations")) {
    loading = false;
    error = "";
    renderMain();
    return;
  }
  controller = new AbortController();
  const own = controller;
  loading = true;
  error = "";
  catalogData = null;
  // A fresh list starts at the top; otherwise the old scroll position would trigger the next page at once.
  window.scrollTo?.({ top: 0, behavior: "instant" });
  renderMain();
  try {
    const data = await api(catalogUrl(page), own.signal);
    if (own !== controller) return;
    catalogData = data;
    data.results.forEach((t) => titleCache.set(t.key, t));
  } catch (e) {
    if (e.name === "AbortError") return;
    error = e.message;
  }
  if (own !== controller) return;
  loading = false;
  renderMain();
}
const upcomingLabel = (t) =>
  /^\d{4}-\d{2}-\d{2}$/.test(t.releaseDate || "")
    ? new Date(`${t.releaseDate}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : t.year || "TBA";
const savedBadge = (entry) =>
  entry
    ? `<span class="saved-status ${entry.status === "completed" ? "completed" : ""}">${icon(entry.status === "completed" ? "check" : "plus")}${esc(statusLabels[entry.status])}</span>`
    : "";
const ratingChip = (entry) =>
  entry?.rating ? `<span class="personal-score" title="Your rating">${icon("star")}${entry.rating}</span>` : "";
function card(t, dated = false) {
  titleCache.set(t.key, t);
  const entry = library.entries[t.key];
  return `<article class="title-card"><div class="poster-wrap"><button class="poster-button" data-action="detail" data-key="${esc(t.key)}" aria-label="View ${esc(t.title)}"><div class="poster-fallback"><span>${icon(t.kind === "anime" ? "anime" : "film")}</span><strong>${esc(t.title)}</strong></div>${t.poster ? `<img class="poster" src="${esc(t.poster)}" alt="" loading="lazy"/>` : ""}<span class="poster-shade"></span>${t.score ? `<span class="score">${icon("star")} ${Number(t.score).toFixed(1)}</span>` : ""}<span class="poster-open">Explore title ${icon("arrow")}</span></button><button class="quick-favorite ${entry?.favorite ? "is-favorite" : ""}" data-action="favorite" data-key="${esc(t.key)}" aria-label="${entry?.favorite ? "Remove" : "Add"} ${esc(t.title)} ${entry?.favorite ? "from" : "to"} favourites" aria-pressed="${Boolean(entry?.favorite)}">${icon("heart")}</button>${savedBadge(entry)}</div><div class="card-heading"><button data-action="detail" data-key="${esc(t.key)}">${esc(t.title)}</button>${ratingChip(entry)}</div><div class="card-meta"><span>${dated === true || route === "upcoming" || route === "interested" ? upcomingLabel(t) : t.year || "TBA"}</span><span class="meta-dot">·</span><span>${labels[t.kind]}</span>${airTag(t)}<span class="card-genre">${esc(t.genres[0] || "")}</span></div></article>`;
}
function renderHero() {
  const title = { key: "tmdb:movie:335984", title: "Blade Runner 2049" };
  return `<section class="hero" aria-label="Featured film"><img class="hero-image" src="/assets/spotlight.jpg" alt="The atmospheric world of Blade Runner 2049" fetchpriority="high"/><div class="hero-overlay"></div><div class="hero-grid"></div><div class="hero-content"><div class="eyebrow"><span></span> THE SPOTLIGHT <span class="eyebrow-line"></span><span class="hero-number">001 / CURATED PICKS</span></div><p class="hero-kicker">MORE HUMAN THAN HUMAN.</p><h1>BLADE RUNNER<span>2049<span class="title-period">.</span></span></h1><div class="hero-meta"><span class="hero-score">${icon("star")} 8.0</span><span>2017</span><span>2h 44m</span><span class="hero-tag">SCI-FI / THRILLER</span></div><p class="hero-description">Some stories stay with you.<br/>Step into a future that feels dangerously close.</p><div class="hero-actions"><button class="button primary" data-action="spotlight">${icon("play")} Explore the film</button><button class="button glass" data-action="watchlist" data-key="${title.key}">${icon(library.entries[title.key] ? "check" : "plus")}${library.entries[title.key] ? "In your library" : "Add to watchlist"}</button></div></div><div class="hero-bottom"><span><i></i> YOUR NEXT OBSESSION STARTS HERE</span><span class="hero-coordinate">LOS ANGELES · 2049</span></div><div class="hero-side-label">A DENIS VILLENEUVE FILM</div></section>`;
}
function renderMain() {
  if (isExperience()) {
    Object.values(library.entries).forEach((e) =>
      titleCache.set(e.title.key, e.title),
    );
    $("#main").innerHTML =
      renderExperience({
        route,
        library,
        esc,
        icon,
        card,
        candidates: catalogData?.results || [],
        forYou: mode === "live" ? forYouView() : null,
        tab: forYouTab,
        offset: recommendationOffset,
        month: calendarMonth,
        query,
      }) +
      (loading
        ? '<p class="inline-loading loading-banner" role="status">Finding your next great story...</p>'
        : "") +
      (error ? `<div class="notice warning">${esc(error)}</div>` : "");
    bindImages();
    return;
  }
  const personal = isPersonal(),
    folder = library.folders.find((f) => f.id === folderId);
  const rawTitles =
    route === "dismissed"
      ? Object.values(library.dismissed || {}).filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) &&
            (libraryKind === "all" || t.kind === libraryKind) &&
            matchesFilters(t, discoveryFilters),
        )
      : personal
        ? filterEntries(library, {
            view: route,
            folder: route === "folder" ? folderId : "",
            query,
            kind: libraryKind,
            status: libraryStatus,
            sort,
          })
            .map((e) => e.title)
            .filter((t) => matchesFilters(t, discoveryFilters))
        : (catalogData?.results || []).filter(
            (t) => !library.dismissed?.[t.key],
          );
  const titles =
    hideWatched && EXPLORE.includes(route)
      ? rawTitles.filter((t) => !hasWatched(library, t.key))
      : rawTitles;
  const discover = route === "discover" && !query && page === 1;
  const heading = personal
    ? route === "folder"
      ? folder?.name || "Collection not found"
      : route === "favorites"
        ? "Your favourites."
        : route === "dismissed"
          ? "Not for your universe."
          : route === "watched"
            ? "The stories you have watched."
            : route === "rewatch"
              ? "Worth another watch."
              : "Your cinematic archive."
    : query
      ? `Results for “${query}”`
      : route === "upcoming"
        ? "Coming soon."
        : route === "movie"
        ? "Cinema without limits."
        : route === "tv"
          ? "One more episode."
          : route === "anime"
            ? "Beyond imagination."
            : "Find your next obsession.";
  $("#main").innerHTML =
    `${discover ? (library.dismissed?.["tmdb:movie:335984"] ? "" : renderHero()) + `<nav class="universe-launcher" aria-label="Your universe shortcuts"><a href="#dashboard">${icon("grid")}<span>Your observatory<small>Stats, goals and current watches</small></span>${icon("arrow")}</a><a href="#recommendations">${icon("star")}<span>Made for your taste<small>Find a story that feels like you</small></span>${icon("arrow")}</a><button data-action="tonight">${icon("play")}<span>Tonight, decided<small>One pick from your watchlist</small></span>${icon("arrow")}</button></nav>` + weekStrip() : ""}<section class="catalog-section"><div class="section-heading"><div><div class="eyebrow section-eyebrow">${personal ? "PERSONAL COLLECTION" : "THE DISCOVERY FEED"}</div><h2>${esc(heading)}</h2><p>${personal ? (route === "folder" && folder?.notes ? esc(folder.notes) : route === "dismissed" ? "Hidden from discovery and recommendations. Restore a title whenever you change your mind." : "Every world you've entered. Every story still waiting.") : mode === "demo" ? "A curated preview of movies, series and anime. Your universe starts here." : route === "discover" ? "Movies, series and anime from TMDB and AniList." : "Explore the live catalogue. Find something worth your time."}</p></div>${personal ? `<div class="heading-actions">${route === "folder" && folder ? `<button class="icon-button bordered" data-action="rename-folder" aria-label="Edit collection">${icon("edit")}</button><button class="icon-button bordered" data-action="delete-folder" aria-label="Delete collection">${icon("trash")}</button>` : ""}<button class="button secondary" data-action="export">${icon("download")} Export library</button></div>` : `<button class="button secondary" data-action="tonight">${icon("play")} Pick tonight</button>`}</div>
  ${storageProblem ? `<div class="notice warning">${esc(storageProblem)}</div>` : ""}
  ${!personal && mode === "demo" ? `<div class="mode-banner"><span>${icon(mode === "demo" ? "compass" : "globe")} ${mode === "demo" ? "You’re exploring the demo. Connect TMDB for the full movie & TV catalogue. Anime needs no key." : "Live catalogue enabled. Your personal library stays on this browser."}</span><button data-action="${mode === "demo" ? "settings" : "toggle-mode"}">${mode === "demo" ? "Connect catalogue" : "Use demo"} ${icon("arrow")}</button></div>` : ""}
  <div class="catalog-toolbar">${
    personal
      ? `<div class="filter-group"><label class="sr-only" for="kind-filter">Title type</label><select id="kind-filter"><option value="all">All types</option>${Object.entries(
          labels,
        )
          .map(
            ([v, l]) =>
              `<option value="${v}" ${libraryKind === v ? "selected" : ""}>${l}</option>`,
          )
          .join(
            "",
          )}</select><label class="sr-only" for="status-filter">Watch status</label><select id="status-filter"><option value="all">All statuses</option>${STATUSES.map((s) => `<option value="${s}" ${libraryStatus === s ? "selected" : ""}>${statusLabels[s]}</option>`).join("")}</select></div>`
      : route === "upcoming"
        ? `<nav class="type-tabs segmented" aria-label="Content type">${[
            ["movie", "Movies"],
            ["tv", "TV series"],
            ["anime", "Anime"],
          ]
            .map(
              ([r, l]) =>
                `<a class="${upcomingKind === r ? "selected" : ""}" href="#upcoming/${r}">${l}${r === "anime" ? "<span>アニメ</span>" : ""}</a>`,
            )
            .join("")}</nav>`
        : `<nav class="type-tabs segmented" aria-label="Content type">${[
          ["discover", "All worlds"],
          ["movie", "Movies"],
          ["tv", "TV series"],
          ["anime", "Anime"],
        ]
          .map(
            ([r, l]) =>
              `<a class="${route === r ? "selected" : ""}" href="#${r}">${l}${r === "anime" ? "<span>アニメ</span>" : ""}</a>`,
          )
          .join("")}</nav>`
  }<div class="sort-wrap"><span class="result-count">${loading ? "Connecting…" : `${personal ? titles.length : (catalogData?.total ?? 0)} ${mode === "demo" || personal ? "titles" : "provider results"}`}</span><label class="sr-only" for="sort-select">Sort titles</label><select id="sort-select" ${!personal && ((route === "discover" && mode === "live") || query) ? 'disabled title="Combined feeds and search use provider relevance order"' : ""}>${(personal
    ? [
        ["recent", "Recently saved"],
        ["rating", "Your top rated"],
        ["priority", "Priority first"],
        ["title", "Title A–Z"],
      ]
    : [
        ["popular", "Popular first"],
        ["rating", "Top rated"],
        ["newest", route === "upcoming" ? "Soonest first" : "Newest first"],
      ]
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${sort === v ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></div></div>
  ${route === "upcoming" ? "" : filterBar({ filters: discoveryFilters, esc, icon, query, route, mode: personal ? "demo" : mode, open: filtersOpen, hideWatched, explore: EXPLORE.includes(route) })}
  <div class="view-toolbar"><span>${personal ? "YOUR PERSONAL ARCHIVE" : "EXPLORE THE CATALOGUE"}</span><div>${personal ? `<button class="button secondary" data-action="toggle-selection">${icon("check")} ${selectionMode ? "Done selecting" : "Select titles"}</button>` : ""}<button class="icon-button ${viewMode === "grid" ? "selected-view" : ""}" data-action="grid-view" aria-label="Grid view" aria-pressed="${viewMode === "grid"}">${icon("grid")}</button><button class="icon-button ${viewMode === "list" ? "selected-view" : ""}" data-action="list-view" aria-label="List view" aria-pressed="${viewMode === "list"}">${icon("menu")}</button></div></div>
  ${selectionMode ? `<div class="bulk-toolbar"><span>${selection.size} selected</span><button data-action="select-visible">Select visible</button><button class="button primary" data-action="bulk-edit" ${selection.size ? "" : "disabled"}>Organise selected ${icon("folder")}</button></div>` : ""}
  ${catalogData?.warning ? `<div class="notice warning">${esc(catalogData.warning)}</div>` : ""}
  ${error ? `<div class="empty-state error-state">${icon("globe")}<h3>Connection interrupted</h3><p>${esc(error)}</p><div><button class="button primary" data-action="retry">Try again</button><button class="button secondary" data-action="toggle-mode">${mode === "live" ? "Explore demo" : "Use live catalogue"}</button></div></div>` : loading ? `<div class="title-grid skeleton-grid" aria-label="Loading titles" aria-busy="true">${Array.from({ length: 6 }, () => '<div class="skeleton-card"><div></div><span></span><small></small></div>').join("")}</div>` : titles.length ? `<div class="title-grid">${titles.map(card).join("")}</div>` : `<div class="empty-state">${icon(personal ? "library" : "search")}<span class="eyebrow">THE NEXT CHAPTER IS YOURS</span><h3>${personal ? "Make this space your own." : "No titles found."}</h3><p>${personal ? (query || libraryStatus !== "all" || libraryKind !== "all" ? "Try changing your filters or search." : "Save a title, tap a heart, or add something to a collection. Your story starts with a discovery.") : "Try a different title or switch content type."}</p><a href="#discover" class="button primary">Explore titles ${icon("arrow")}</a></div>`}
  ${!personal && catalogData && !loading && !error && catalogData.results.length ? (page < Math.min(catalogData.totalPages, 500) ? '<div class="load-sentinel" data-action="retry-more" role="status">Loading more…</div>' : catalogData.totalPages > 1 ? '<p class="end-note">You have reached the end.</p>' : "") : ""}
  <div class="library-stats" id="library-stats"></div></section>`;
  renderStats();
  if (viewMode === "list")
    document
      .querySelector(".title-grid:not(.skeleton-grid)")
      ?.classList.add("list-view");
  bindImages();
  watchSentinel();
}
function bindImages() {
  decorateCards();
  document
    .querySelectorAll("img.poster,img.hero-image,img.detail-backdrop")
    .forEach((img) =>
      img.addEventListener(
        "error",
        () => {
          img.style.display = "none";
        },
        { once: true },
      ),
    );
}
function decorateCards() {
  document
    .querySelectorAll(".title-card:not([data-decorated])")
    .forEach((article) => {
      article.dataset.decorated = "true";
      const key = article.querySelector("[data-key]")?.dataset.key,
        t = titleCache.get(key),
        e = library.entries[key];
      if (!t) return;
      if (route === "dismissed" && article.closest("#main")) {
        article.insertAdjacentHTML(
          "beforeend",
          `<button class="button secondary" data-action="restore-title" data-key="${esc(key)}">Restore title</button>`,
        );
        return;
      }
      const wrap = article.querySelector(".poster-wrap"),
        soon =
          ["upcoming", "interested"].includes(route) ||
          article.closest(".week-strip");
      if (soon) {
        const on = Boolean(library.interested?.[key]);
        wrap.insertAdjacentHTML(
          "beforeend",
          `<button class="quick-save quick-interest ${on ? "is-saved" : ""}" data-action="interest" data-key="${esc(key)}" aria-pressed="${on}" aria-label="${on ? "Stop following" : "Follow"} ${esc(t.title)}">${icon("bell")}</button>`,
        );
        return;
      }
      wrap.insertAdjacentHTML(
        "beforeend",
        `<button class="quick-more" data-action="card-menu" aria-label="More actions for ${esc(t.title)}" aria-haspopup="menu" aria-expanded="false">${icon("more")}</button><div class="card-menu" role="menu"><button role="menuitem" data-action="dismiss-title" data-key="${esc(key)}">Not interested</button></div><button class="quick-watched ${hasWatched(library, key) ? "is-watched" : ""}" data-action="mark-watched" data-key="${esc(key)}" aria-pressed="${hasWatched(library, key)}" aria-label="${hasWatched(library, key) ? "Unmark watched:" : "Mark watched:"} ${esc(t.title)}">${icon("eye")}</button><button class="quick-save ${e ? "is-saved" : ""}" data-action="card-save" data-key="${esc(key)}" aria-label="${e ? "Remove from library:" : "Save"} ${esc(t.title)}">${icon(e ? "check" : "plus")}</button>`,
      );
      if (selectionMode && isPersonal() && article.closest("#main")) {
        wrap.insertAdjacentHTML(
          "beforeend",
          `<label class="selection-box"><input type="checkbox" data-selection="${esc(key)}" aria-label="Select ${esc(t.title)}" ${selection.has(key) ? "checked" : ""}/></label>`,
        );
        article.classList.toggle("is-selected", selection.has(key));
      }
      article.insertAdjacentHTML(
        "beforeend",
        `<p class="list-synopsis">${esc(t.overview.slice(0, 210))}</p>${e?.priority === "high" ? '<span class="priority-badge">HIGH PRIORITY</span>' : ""}${
            e?.tags?.length
              ? `<div class="entry-tags">${e.tags
                  .slice(0, 3)
                  .map((tag) => `<span>${esc(tag)}</span>`)
                  .join("")}</div>`
              : ""
          }`,
      );
    });
}
// "Tonight, decided" as a small game: three quick questions narrow things down, then a card is drawn.
const TONIGHT_STEPS = [
  {
    field: "kind",
    title: "What are you in the mood for?",
    options: [["all", "Surprise me"], ["movie", "A movie"], ["tv", "A series"], ["anime", "Anime"]],
  },
  {
    field: "minutes",
    title: "How much time do you have?",
    options: [[0, "No limit"], [30, "Up to 30 min"], [90, "Up to 90 min"], [120, "Up to 2 hours"], [180, "Up to 3 hours"]],
  },
  {
    field: "genre",
    title: "Any genre in mind?",
    options: [["", "Any genre"], ...GENRES.map((g) => [g, g])],
  },
];
let tonight = null;
function tonightDialog() {
  tonight = { step: 0, kind: "all", minutes: 0, genre: "", seen: [], pool: null };
  // Suggestions load in the background while the questions are answered.
  tonight.suggestions =
    mode === "live" && !forYouRaw
      ? fetchForYou().then((raw) => (forYouRaw = raw)).catch(() => null)
      : Promise.resolve();
  renderTonight();
}
function renderTonight() {
  const t = tonight;
  if (t.step >= TONIGHT_STEPS.length) return drawTonight();
  const step = TONIGHT_STEPS[t.step];
  utility(
    `<div class="tonight-dots" aria-label="Question ${t.step + 1} of 3">${TONIGHT_STEPS.map((_, i) => `<i class="${i === t.step ? "now" : i < t.step ? "done" : ""}"></i>`).join("")}</div><div class="tonight-step"><h2>${step.title}</h2><div class="tonight-options ${step.field === "genre" ? "many" : ""}">${step.options.map(([v, l]) => `<button class="${String(t[step.field]) === String(v) ? "chosen" : ""}" data-action="tonight-answer" data-field="${step.field}" data-value="${esc(v)}">${esc(l)}</button>`).join("")}</div>${t.step ? '<button class="tonight-back" data-action="tonight-back">\u2190 Back</button>' : ""}</div>`,
    "Pick something to watch",
  );
}
async function drawTonight() {
  const t = tonight;
  utility(
    '<div class="tonight-stage"><div class="tonight-slot" id="tonight-slot"><div class="tonight-reel"></div></div><p class="tonight-line" id="tonight-line">Shuffling the deck\u2026</p></div><div class="tonight-actions"><button class="button primary" data-action="tonight-again" id="tonight-again" disabled>Pick another</button></div>',
    "Pick something to watch",
  );
  await t.suggestions;
  if (tonight !== t) return;
  const view = forYouView(),
    suggestions = view ? [...view.movie, ...view.tv, ...view.anime].sort(() => Math.random() - 0.5) : [];
  const ranked = view ? [...view.movie, ...view.tv, ...view.anime] : [];
  const kindOk = (x) => t.kind === "all" || x.title.kind === t.kind;
  const pick = tonightPick(library, {
    kind: t.kind,
    genre: t.genre,
    minutes: t.minutes,
    suggestions: ranked.filter(kindOk).concat(suggestions.filter(kindOk)).filter((x, i, a) => a.findIndex((y) => y.title.key === x.title.key) === i),
    exclude: t.seen,
  });
  const slot = $("#tonight-slot");
  if (!slot) return;
  if (!pick) {
    $("#tonight-line").textContent = "Nothing fits those answers. Try loosening them.";
    $("#tonight-again").textContent = "Start over";
    $("#tonight-again").dataset.action = "tonight-restart";
    $("#tonight-again").disabled = false;
    slot.remove();
    return;
  }
  if (pick.cycled) t.seen = [];
  t.seen.push(pick.title.key);
  // A quick slot-machine reel of posters, slowing down before the real pick lands.
  const posters = [...new Set([...Object.values(library.entries).map((e) => e.title.poster), ...(forYouRaw ? Object.values(forYouRaw).flat().map((x) => x.poster) : [])].filter(Boolean))].sort(() => Math.random() - 0.5).slice(0, 14);
  const reel = slot.querySelector(".tonight-reel");
  let i = 0;
  const spin = (delay) => {
    if (tonight !== t || !$("#tonight-slot")) return;
    if (delay > 260 || !posters.length) {
      slot.innerHTML = `<div class="tonight-pick">${card(pick.title)}<span class="tonight-badge ${pick.from}">${pick.from === "watchlist" ? "From your watchlist" : "Picked for your taste"}</span></div>`;
      $("#tonight-line").textContent = pick.from === "watchlist" ? "Something you already wanted to see." : pick.reason;
      $("#tonight-again").disabled = false;
      bindImages();
      return;
    }
    reel.innerHTML = `<img src="${esc(posters[i++ % posters.length])}" alt=""/>`;
    setTimeout(() => spin(delay * 1.18), delay);
  };
  spin(70);
}
async function hydrateExtras() {
  const t = selected;
  if (!t) return;
  if (t.source === "tmdb" && !t.demo) {
    const key = `${t.key}:${watchRegion}`,
      region = watchRegion;
    const render = (data) => {
      if (
        selected?.key !== t.key ||
        watchRegion !== region ||
        !$("#watch-availability")
      )
        return;
      // Subscription services only; rent, buy, free and ad-supported offers are left out on purpose.
      const groups = [["Subscription", "stream"]].filter(([, g]) => data[g]?.length);
      $("#watch-availability").innerHTML = groups.length
        ? groups
            .map(
              ([label, g]) =>
                `<div class="provider-group"><h4>${label}</h4><div>${data[g].map((p) => `<span>${p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy"/>` : ""}${esc(p.name)}</span>`).join("")}</div></div>`,
            )
            .join("")
        : '<p class="panel-empty">Not on any subscription service in your region. Change the region in Settings.</p>';
    };
    if (availabilityCache.has(key)) render(availabilityCache.get(key));
    else
      try {
        const data = await api(
          `/api/availability/${t.kind}/${t.id}?region=${watchRegion}`,
        );
        availabilityCache.set(key, data);
        render(data);
      } catch (e) {
        if (
          selected?.key === t.key &&
          watchRegion === region &&
          $("#watch-availability")
        )
          $("#watch-availability").innerHTML =
            `<p class="panel-empty">${esc(e.message)}</p>`;
      }
  }
  if (t.kind === "tv" && !t.demo && t.seasonList?.length) {
    const select = $("#season-select");
    if (select) {
      select.value = String(seasonNumber);
      if (!select.value) {
        seasonNumber = Number(select.options[0]?.value || 1);
        select.value = String(seasonNumber);
      }
      await loadSeason(seasonNumber);
    }
  }
}
// --- Episode tracking -------------------------------------------------------
const airedBy = (e) => !e.airDate || e.airDate <= today();
function allSeen(t) {
  return Object.fromEntries(
    (t.seasonList || [])
      .filter((s) => s.number > 0 && s.episodes)
      .map((s) => [s.number, Array.from({ length: s.episodes }, (_, i) => i + 1)]),
  );
}
// Per-season sets of watched episode numbers. Falls back to the overall progress count (oldest episodes first)
// when no per-episode record exists, or when progress was changed by something else.
function episodeSeen(t, e) {
  const count = (o) => Object.values(o).reduce((n, a) => n + a.length, 0);
  if (e?.seen && count(e.seen) === (e.progress || 0))
    return Object.fromEntries(Object.entries(e.seen).map(([k, a]) => [k, new Set(a)]));
  const out = {};
  let left = e?.progress || 0;
  for (const s of (t.seasonList || []).filter((s) => s.number > 0)) {
    if (left <= 0) break;
    const n = Math.min(left, s.episodes || 0);
    if (n > 0) out[s.number] = new Set(Array.from({ length: n }, (_, i) => i + 1));
    left -= n;
  }
  return out;
}
function saveSeen(t, seen) {
  const obj = Object.fromEntries(
    Object.entries(seen)
      .filter(([, set]) => set.size)
      .map(([k, set]) => [k, [...set].sort((a, b) => a - b)]),
  );
  const count = Object.values(obj).reduce((n, a) => n + a.length, 0),
    cur = library.entries[t.key]?.status,
    done = (t.episodes || 0) > 0 && count >= t.episodes;
  const status = done
    ? isOngoing(t) ? "watching" : "completed"
    : count > 0
      ? ["on-hold", "dropped"].includes(cur) ? cur : "watching"
      : ["completed", "watching"].includes(cur) ? "planned" : cur || "planned";
  if (persist(saveTitle(library, t, { seen: obj, progress: count, status, watched: done }))) {
    renderDetail();
    renderMain();
  }
}
function toggleEpisodes(action, { season, ep }) {
  const t = selected;
  if (!t) return;
  const data = seasonCache.get(`${t.key}:${season}`),
    seen = episodeSeen(t, library.entries[t.key]),
    set = (seen[season] ||= new Set());
  if (action === "episode-toggle") {
    const n = Number(ep);
    set.has(n) ? set.delete(n) : set.add(n);
  } else {
    const aired = (data?.episodes || []).filter(airedBy).map((e) => e.number);
    aired.every((n) => set.has(n)) ? aired.forEach((n) => set.delete(n)) : aired.forEach((n) => set.add(n));
  }
  saveSeen(t, seen);
}
function renderSeason(data, number) {
  const t = selected,
    set = episodeSeen(t, library.entries[t.key])[number] || new Set(),
    aired = data.episodes.filter(airedBy),
    done = data.episodes.filter((e) => set.has(e.number)).length,
    all = aired.length > 0 && aired.every((e) => set.has(e.number));
  $("#season-episodes").innerHTML = data.episodes.length
    ? `<div class="season-head"><div class="season-progress"><span><b>${done}</b> / ${data.episodes.length} watched</span><i style="--p:${Math.round((done / data.episodes.length) * 100)}%"></i></div><button class="season-toggle ${all ? "is-on" : ""}" data-action="season-watched" data-season="${number}" aria-pressed="${all}" ${aired.length ? "" : "disabled"}>${icon("check")} ${all ? "Season watched" : "Mark season watched"}</button></div><div class="episode-list">${data.episodes
        .map((e) => {
          const seen = set.has(e.number),
            out = airedBy(e);
          return `<details class="episode-row ${seen ? "is-seen" : ""}"><summary><button class="ep-check ${seen ? "is-on" : ""}" data-action="episode-toggle" data-season="${number}" data-ep="${e.number}" aria-pressed="${seen}" aria-label="${seen ? "Unmark" : "Mark"} episode ${e.number} watched" ${out ? "" : "disabled"}>${icon("check")}</button><span class="episode-number">${String(e.number).padStart(2, "0")}</span><strong>${esc(e.name)}</strong><span class="ep-meta">${e.runtime ? `<span class="ep-time">${e.runtime}m</span>` : ""}${e.score ? `<span class="ep-score">${icon("star")} ${Number(e.score).toFixed(1)}</span>` : ""}<span class="ep-date">${esc(e.airDate || "TBA")}</span></span></summary><p>${esc(e.overview || "No episode summary available.")}</p></details>`;
        })
        .join("")}</div>`
    : '<p class="panel-empty">No episodes listed for this season.</p>';
}
async function loadSeason(number) {
  const title = selected;
  if (!title) return;
  const key = `${title.key}:${number}`;
  if ($("#season-episodes"))
    $("#season-episodes").innerHTML =
      '<p class="panel-empty">Loading episodes...</p>';
  try {
    const data =
      seasonCache.get(key) || (await api(`/api/season/${title.id}/${number}`));
    seasonCache.set(key, data);
    if (
      selected?.key !== title.key ||
      seasonNumber !== number ||
      !$("#season-episodes")
    )
      return;
    renderSeason(data, number);
  } catch (e) {
    if (selected?.key === title.key && $("#season-episodes"))
      $("#season-episodes").innerHTML =
        `<p class="panel-empty">${esc(e.message)}</p>`;
  }
}
// --- People: credits rows, cast overlay and profile ---------------------------------
const personCache = new Map();
let peopleList = null;
function creditRow(label, text, list, group) {
  if (!text) return "";
  if (!list?.length) return `<p class="credits"><span>${label}</span>${esc(text)}</p>`;
  const names = list.slice(0, 8).map((p) => esc(p.name)).join(" \u00b7 ");
  return `<button class="credits credits-link" data-action="people" data-group="${group}"><span>${label}</span><b>${names}</b>${icon("arrow")}</button>`;
}
const personPhoto = (p, cls = "") =>
  p.photo
    ? `<img class="person-photo ${cls}" src="${esc(p.photo)}" alt="" loading="lazy"/>`
    : `<span class="person-photo person-initial ${cls}">${esc((p.name || "?")[0])}</span>`;
const isoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
function ageLine(p) {
  if (!isoDate(p.birthday)) return "";
  const b = new Date(`${p.birthday}T12:00:00`),
    end = isoDate(p.deathday) ? new Date(`${p.deathday}T12:00:00`) : new Date();
  let age = end.getFullYear() - b.getFullYear();
  if (end < new Date(end.getFullYear(), b.getMonth(), b.getDate())) age--;
  const born = b.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return p.deathday ? `Born ${born} \u00b7 died aged ${age}` : `${age} years old \u00b7 born ${born}`;
}
function showPerson(html) {
  const d = $("#person-dialog");
  d.innerHTML = `<button class="icon-button utility-close" data-action="close-person" aria-label="Close">${icon("close")}</button>${html}`;
  if (!d.open) d.showModal();
}
const backButton = (back) =>
  back ? '<button class="person-back" data-action="people-back">\u2190 Back</button>' : "";
function openPeople(group) {
  const t = selected,
    list = group === "cast" ? t?.castList : t?.creatorList;
  if (!list?.length) return;
  if (list.length === 1) return openPerson(list[0].id, false);
  peopleList = { list, label: group === "cast" ? "Starring" : t.kind === "movie" ? "Directed by" : "Created by" };
  renderPeopleList();
}
function renderPeopleList() {
  const { list, label } = peopleList;
  showPerson(`<div class="person-pane"><div class="eyebrow">${label.toUpperCase()}</div><h2>Choose someone</h2><div class="people-grid">${list
    .map((p) => `<button class="person-card" data-action="person" data-id="${p.id}" data-list="1">${personPhoto(p)}<strong>${esc(p.name)}</strong><small>${esc(p.role || "")}</small></button>`)
    .join("")}</div></div>`);
}
async function openPerson(id, fromList = true) {
  const back = Boolean(fromList && peopleList);
  showPerson(`<div class="person-pane">${backButton(back)}<p class="inline-loading" role="status">Loading profile\u2026</p></div>`);
  try {
    const data = personCache.get(id) || (await api(`/api/person/${id}`));
    personCache.set(id, data);
    data.acting.concat(data.crew).forEach((t) => titleCache.set(t.key, t));
    renderProfile(data, data.acting.length ? "acting" : "crew", back);
  } catch (e) {
    showPerson(`<div class="person-pane">${backButton(back)}<p class="notice warning">${esc(e.message)}</p></div>`);
  }
}
// Credits can be ordered by popularity (the order TMDB returns), year or public rating.
let personSort = "popular";
const SORTS = [
  ["popular", "Most popular"],
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["rating", "Top rated"],
];
function sortCredits(list, by) {
  const order = new Map(list.map((t, i) => [t.key, i])),
    cmp = {
      popular: (a, b) => order.get(a.key) - order.get(b.key),
      // Unreleased/undated titles count as the newest.
      newest: (a, b) => (b.year ?? 9999) - (a.year ?? 9999),
      oldest: (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
      rating: (a, b) => (b.score || 0) - (a.score || 0),
    }[by];
  return [...list].sort((a, b) => cmp(a, b) || order.get(a.key) - order.get(b.key));
}
function renderProfile(p, tab, back) {
  const tabs = [["acting", "Acting", p.acting], ["crew", "Directing & writing", p.crew]].filter(([, , l]) => l.length),
    list = sortCredits(tab === "crew" ? p.crew : p.acting, personSort);
  showPerson(`<div class="person-pane" data-person="${p.id}" data-back="${back ? 1 : 0}" data-tab="${tab}">${backButton(back)}<div class="person-head">${personPhoto(p, "large")}<div><div class="eyebrow">${esc(p.department || "Profile")}</div><h2>${esc(p.name)}</h2>${ageLine(p) ? `<p class="person-facts">${esc(ageLine(p))}</p>` : ""}${p.placeOfBirth ? `<p class="person-facts">${esc(p.placeOfBirth)}</p>` : ""}</div></div>${p.biography ? `<p class="person-bio">${esc(p.biography)}</p>` : '<p class="person-bio muted">No biography available.</p>'}${tabs.length ? `<div class="person-tabs" role="tablist">${tabs.map(([id, l, items]) => `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? "active" : ""}" data-action="person-tab" data-tab="${id}">${l} <span>${items.length}</span></button>`).join("")}<label class="sr-only" for="person-sort">Sort credits</label><select id="person-sort">${SORTS.map(([v, l]) => `<option value="${v}" ${personSort === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="credit-grid">${list.map((t) => `<button class="credit-card" data-action="detail" data-key="${esc(t.key)}">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy"/>` : ""}<strong>${esc(t.title)}</strong><small class="credit-meta">${t.score ? `<span class="credit-score">${icon("star")} ${Number(t.score).toFixed(1)}</span>` : ""}<span>${t.year || "TBA"}</span></small>${t.role ? `<small class="credit-role">${esc(t.role)}</small>` : ""}</button>`).join("")}</div>` : ""}</div>`);
}
// --- Quick rating after "watched" on a card, and smooth card removal -------------------------
let ratePop = null;
// Re-render without replaying every card's entrance animation; a card that is about to disappear
// (suggestions drop titles you save, watch or dismiss) fades out first.
function staysListed(key) {
  if (route === "recommendations") return !library.entries[key] && !library.dismissed?.[key];
  if (EXPLORE.includes(route)) return !library.dismissed?.[key] && !(hideWatched && hasWatched(library, key));
  return true;
}
// Brings one card up to date in place (no page re-render, so nothing flashes or reloads its artwork).
function patchCard(card, key) {
  const e = library.entries[key],
    t = titleCache.get(key) || e?.title;
  if (!t) return;
  const watched = card.querySelector(".quick-watched");
  if (watched) {
    const on = hasWatched(library, key);
    watched.classList.toggle("is-watched", on);
    watched.setAttribute("aria-pressed", String(on));
    watched.setAttribute("aria-label", `${on ? "Unmark watched:" : "Mark watched:"} ${t.title}`);
  }
  const save = card.querySelector(".quick-save:not(.quick-interest)");
  if (save) {
    save.classList.toggle("is-saved", Boolean(e));
    save.innerHTML = icon(e ? "check" : "plus");
    save.setAttribute("aria-label", `${e ? "Remove from library:" : "Save"} ${t.title}`);
  }
  const fav = card.querySelector(".quick-favorite");
  if (fav) {
    fav.classList.toggle("is-favorite", Boolean(e?.favorite));
    fav.setAttribute("aria-pressed", String(Boolean(e?.favorite)));
    fav.setAttribute("aria-label", `${e?.favorite ? "Remove" : "Add"} ${t.title} ${e?.favorite ? "from" : "to"} favourites`);
  }
  card.querySelector(".saved-status")?.remove();
  fav?.insertAdjacentHTML("afterend", savedBadge(e));
  card.querySelector(".personal-score")?.remove();
  card.querySelector(".card-heading button")?.insertAdjacentHTML("afterend", ratingChip(e));
}
// After a change made on a card: patch it, or fade it out and remove it when it no longer belongs in the list.
// Personal lists (which depend on status) and calls without a card fall back to a full, animation-free re-render.
async function softRefresh(card) {
  const key = card?.querySelector("[data-key]")?.dataset.key;
  if (key && !isPersonal() && route !== "dismissed") {
    if (staysListed(key)) patchCard(card, key);
    else {
      // In "For you" each card sits in a wrapper together with its reason line; they leave as one.
      const unit = card.closest(".recommendation-grid > div") || card;
      unit.classList.add("leaving");
      await new Promise((r) => setTimeout(r, 380));
      unit.remove();
    }
    if (selected?.key === key) renderDetail();
    return;
  }
  const main = $("#main");
  main.classList.add("no-rise");
  renderMain();
  if (selected) renderDetail();
  setTimeout(() => main.classList.remove("no-rise"), 700);
}
function miniStars(key) {
  return `<div class="star-rating mini" data-value="0" role="group" aria-label="Rate out of 10">${[1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<span class="star" style="--f:0"><span class="fill">${icon("star")}</span>${icon("star")}<button class="hit l" data-action="rate-card" data-key="${esc(key)}" data-value="${n * 2 - 1}" aria-label="Rate ${n * 2 - 1} out of 10"></button><button class="hit r" data-action="rate-card" data-key="${esc(key)}" data-value="${n * 2}" aria-label="Rate ${n * 2} out of 10"></button></span>`,
    )
    .join("")}<output class="rate-num">\u2013</output></div>`;
}
function openRatePop(wrap, key) {
  closeRatePop(false);
  wrap.querySelector(".quick-watched")?.classList.add("is-watched");
  wrap.insertAdjacentHTML(
    "beforeend",
    `<div class="rate-pop" role="dialog" aria-label="Rate this title"><b>Watched. How was it?</b>${miniStars(key)}<button class="rate-skip" data-action="rate-skip">Skip</button></div>`,
  );
  ratePop = { key, card: wrap.closest(".title-card"), timer: setTimeout(() => closeRatePop(), 12000) };
}
function closeRatePop(refresh = true) {
  if (!ratePop) return;
  const { card, timer } = ratePop;
  clearTimeout(timer);
  card.querySelector(".rate-pop")?.remove();
  ratePop = null;
  if (refresh) softRefresh(card);
}
document.addEventListener("keydown", (e) => e.key === "Escape" && ratePop && closeRatePop());
// Interactive 10-star rating: each star has a left (half) and right (whole) hit area; clicking the current value clears it.
const starFill = (value, n) => (value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0);
function starRating(value) {
  return `<div class="star-rating" data-value="${value}" role="group" aria-label="Your rating out of 10">${Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return `<span class="star" style="--f:${starFill(value, n)}"><span class="fill">${icon("star")}</span>${icon("star")}<button class="hit l" data-action="rate" data-value="${n - 0.5}" aria-label="Rate ${n - 0.5} out of 10"></button><button class="hit r" data-action="rate" data-value="${n}" aria-label="Rate ${n} out of 10"></button></span>`;
  }).join("")}<output class="rate-num">${value ? value.toFixed(1) : "Rate it"}</output></div>`;
}
// Stars plus, for series and anime, the share of episodes the user has ticked off.
function ratingBlock(t, e) {
  const total = t.episodes || 0;
  let pct = "";
  if (t.kind !== "movie" && total > 0) {
    const seen = Object.values(episodeSeen(t, e)).reduce((n, set) => n + set.size, 0);
    pct = `<span class="watched-pct" title="${seen} of ${total} episodes"><b>${Math.min(100, Math.round((seen / total) * 100))}%</b> watched</span>`;
  }
  return `<div class="rating-block">${starRating(e?.rating || 0)}${pct}</div>`;
}
function previewStars(box, value) {
  const v = box.classList.contains("mini") ? value / 2 : value;
  box.querySelectorAll(".star").forEach((el, i) => el.style.setProperty("--f", starFill(v, i + 1)));
  box.querySelector(".rate-num").textContent = value ? (box.classList.contains("mini") ? String(value) : value.toFixed(1)) : box.classList.contains("mini") ? "\u2013" : "Rate it";
}
document.addEventListener("pointerover", (e) => {
  const hit = e.target.closest?.(".star-rating .hit");
  if (hit) previewStars(hit.closest(".star-rating"), Number(hit.dataset.value));
});
document.addEventListener("pointerout", (e) => {
  const box = e.target.closest?.(".star-rating");
  if (box && !box.contains(e.relatedTarget)) previewStars(box, Number(box.dataset.value));
});
function entryUpdate(patch, message) {
  if (!selected) return;
  if (persist(saveTitle(library, selected, patch))) {
    renderDetail();
    renderMain();
  }
}
// Series/anime whose provider status says they are still releasing (or about to).
function isOngoing(t) {
  return (
    t.kind !== "movie" &&
    (Boolean(t.nextAirDate) ||
      /returning|production|planned|pilot|releasing|not_yet|currently airing|hiatus/i.test(
        t.status || "",
      ))
  );
}
const airTag = (t) =>
  t.kind === "movie" || !t.status
    ? ""
    : /not_yet|planned|in production|pilot/i.test(t.status)
      ? '<span class="air-tag soon">Upcoming</span>'
      : isOngoing(t)
        ? '<span class="air-tag ongoing">Ongoing</span>'
      : '<span class="air-tag">Ended</span>';
// A just-added title with nothing else attached can be un-added with one click.
const isBare = (e) =>
  e.status === "planned" &&
  !e.watched &&
  !e.favorite &&
  !e.rewatchQueued &&
  !e.rating &&
  !e.notes &&
  !e.progress &&
  !e.folders.length &&
  !e.tags.length;
async function openDetail(title) {
  selected = title;
  seasonNumber = 1;
  $("#detail-dialog").scrollTop = 0;
  detailLoading = true;
  detailError = "";
  detailController?.abort();
  detailController = new AbortController();
  const own = detailController;
  renderDetail();
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
  try {
    const full = await api(
      `/api/title/${title.source}/${title.kind}/${title.id}?mode=${title.demo ? "demo" : "live"}`,
      own.signal,
    );
    if (own !== detailController) return;
    if (library.entries[full.key])
      persist({
        ...library,
        entries: {
          ...library.entries,
          [full.key]: {
            ...library.entries[full.key],
            title: validateTitle(full),
          },
        },
      });
    selected = full;
    titleCache.set(full.key, full);
  } catch (e) {
    if (e.name === "AbortError") return;
    if (own !== detailController) return;
    detailError = e.message;
  }
  if (own !== detailController) return;
  detailLoading = false;
  renderDetail();
}
// Rewatching only makes sense once everything has been watched (or it is already queued).
const finishedAll = (t, e) =>
  Boolean(e?.rewatchQueued) ||
  (!isOngoing(t) &&
    (t.kind === "movie"
      ? hasWatched(library, t.key)
      : e?.status === "completed" ||
        (t.episodes > 0 && e?.progress >= t.episodes)));
function renderDetail() {
  if (!selected) return;
  const oldScroll = $("#detail-dialog").scrollTop,
    focusId = document.activeElement?.id;
  const t = selected,
    e = library.entries[t.key];
  $("#detail-dialog").innerHTML =
    `<div class="detail-art">${t.backdrop ? `<img class="detail-backdrop" src="${esc(t.backdrop)}" alt=""/>` : ""}<div></div><div class="detail-menu"><button class="icon-button detail-more" data-action="card-menu" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">${icon("more")}</button><div class="card-menu" role="menu"><button role="menuitem" data-action="${library.dismissed?.[t.key] ? "restore-title" : "dismiss-title"}" data-key="${esc(t.key)}">${library.dismissed?.[t.key] ? "Restore title" : "Not interested"}</button></div></div><button class="icon-button close-button" data-action="close-detail" aria-label="Close title details">${icon("close")}</button><span class="detail-source">${t.demo ? "DEMO PREVIEW" : t.source === "jikan" ? (t.provider === "anilist" ? "ANILIST" : "MYANIMELIST · JIKAN") : "TMDB"} / ${labels[t.kind].toUpperCase()}</span></div><div class="detail-body"><div class="detail-header"><div class="detail-poster">${t.poster ? `<img src="${esc(t.poster)}" alt="${esc(t.title)} poster" class="poster"/>` : icon("film")}</div><div><div class="eyebrow">${esc(t.genres.join(" / "))}</div><h2>${esc(t.title)}</h2><div class="detail-meta"><span class="hero-score">${icon("star")} ${t.score ? Number(t.score).toFixed(1) : "Unrated"}</span><span>${t.year || "Release TBA"}</span>${t.runtime ? `<span>${t.runtime} min</span>` : ""}${t.seasons ? `<span>${t.seasons} seasons</span>` : ""}${t.episodes ? `<span>${t.episodes} episodes</span>` : ""}${airTag(t)}${ratingBlock(t, e)}</div><div class="detail-actions"><button class="button primary" data-action="detail-save">${icon(e ? "check" : "plus")}${e ? "Saved to library" : "Add to library"}</button><button class="button ${e?.favorite ? "favorite-button" : "secondary"}" data-action="detail-favorite" aria-pressed="${Boolean(e?.favorite)}">${icon("heart")} ${e?.favorite ? "Favourited" : "Favourite"}</button>${t.demo ? `<button class="button secondary" data-action="live-title">${icon("globe")} Open live details</button>` : ""}${t.trailer ? `<button class="button secondary" data-action="trailer" data-id="${esc(t.trailer)}">${icon("play")} Trailer</button>` : ""}</div><div class="detail-actions watch-actions"><button class="button secondary ${hasWatched(library, t.key) ? "is-on" : ""}" data-action="mark-watched" aria-pressed="${hasWatched(library, t.key)}">${icon("check")} ${hasWatched(library, t.key) ? (isOngoing(t) ? "Up to date" : "Watched") : "Mark as watched"}</button>${finishedAll(t, e) ? `<button class="button secondary" data-action="queue-rewatch" aria-pressed="${Boolean(e?.rewatchQueued)}">${icon("clock")} ${e?.rewatchQueued ? "In rewatch list" : "Want to rewatch"}</button>` : ""}</div></div></div>
  ${detailLoading ? '<p class="inline-loading" role="status">Loading title details…</p>' : ""}${detailError ? `<div class="notice warning">${esc(detailError)} Your saved information is still available.</div>` : ""}
  ${t.nextAirDate ? `<div class="next-airing">${icon("clock")} Next episode: ${esc(t.nextAirDate)}${t.nextEpisode ? ` &middot; ${esc(t.nextEpisode)}` : ""}</div>` : ""}
  <section class="synopsis"><h3>The story</h3><p>${esc(t.overview)}</p>${creditRow(t.kind === "movie" ? "Directed by" : "Created by / studio", t.creator, t.creatorList, "crew")}${creditRow("Starring", (t.cast || []).join(" \u00b7 "), t.castList, "cast")}</section>
  <div class="detail-row">${t.source === "tmdb" && !t.demo ? '<div class="where-to-watch" id="watch-availability" aria-label="Where to watch"></div>' : ""}</div></div>`;
  const body = $("#detail-dialog .detail-body");
  if (body)
    body.insertAdjacentHTML(
      "beforeend",
      detailExtras({
        title: {
          ...t,
          recommendations: (t.recommendations || []).filter(
            (r) => !library.dismissed?.[r.key],
          ),
        },
        entry: e,
        watched: hasWatched(library, t.key),
        esc,
        icon,
        card,
        region: watchRegion,
      }),
    );
  $("#detail-dialog").scrollTop = oldScroll;
  if (focusId && $("#detail-dialog").open)
    document.getElementById(focusId)?.focus({ preventScroll: true });
  hydrateExtras();
  bindImages();
}
function utility(html, label) {
  const d = $("#utility-dialog");
  d.setAttribute("aria-label", label);
  d.innerHTML = `<button class="icon-button utility-close" data-action="close-utility" aria-label="Close dialog">${icon("close")}</button>${html}`;
  if (!d.open) d.showModal();
}
function folderDialog(rename = false) {
  const folder = library.folders.find((f) => f.id === folderId);
  utility(
    `<div class="eyebrow">A HOME FOR YOUR STORIES</div><h2>${rename ? "Edit collection" : "Create a collection"}</h2><p>Group your titles by mood, genre, or whatever makes sense to you.</p><form id="folder-form" data-rename="${rename ? "true" : "false"}"><label for="folder-name">Collection name</label><input id="folder-name" name="name" required maxlength="60" placeholder="e.g. Neon nights" value="${rename ? esc(folder?.name) : ""}"/><label for="folder-notes">Collection notes</label><textarea id="folder-notes" name="notes" rows="3" maxlength="2000" placeholder="Watch together, viewing order, or a theme for this collection.">${rename ? esc(folder?.notes || "") : ""}</textarea><p id="folder-error" class="form-error" role="alert"></p><button class="button primary" type="submit">${icon("folder")} ${rename ? "Save collection" : "Create collection"}</button></form>`,
    "Collection",
  );
  setTimeout(() => $("#folder-name")?.focus(), 0);
}
function settings() {
  utility(
    `<div class="eyebrow">MISSION CONTROL</div><h2>Your universe. Your rules.</h2><p>Connect your catalogue and take care of your library.</p><section class="settings-section"><h3>Catalogue connection</h3><div class="connection-row"><span>${icon("globe")} TMDB <small>Movies & TV series</small></span><span class="connection-pill ${config.tmdbConfigured ? "connected" : ""}">${config.tmdbConfigured ? "Connected" : "Key needed"}</span></div>${localApi ? `<p>Paste your <strong>TMDB API Read Access Token</strong>. It is stored only on this device and is never included in backups.</p><div class="token-row"><input id="tmdb-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="eyJhbGciOi…" value="${esc(localApi.getToken())}" aria-label="TMDB API Read Access Token"/><button class="button secondary" data-action="test-token">Test</button><button class="button primary" data-action="save-token">Save</button></div><p class="token-status" id="token-status" role="status"></p>` : "<p>Add your <strong>TMDB API Read Access Token</strong> to <code>TMDB_READ_TOKEN</code> in the project’s <code>.env</code> file, then restart the server. The token stays on the server.</p>"}<a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" class="text-link">Get a TMDB token ${icon("arrow")}</a><div class="connection-row"><span>${icon("anime")} AniList + Jikan <small>Anime</small></span><span class="connection-pill connected">No key needed</span></div><label class="mode-choice">Catalogue mode<select id="mode-select"><option value="demo" ${mode === "demo" ? "selected" : ""}>Demo — curated preview</option><option value="live" ${mode === "live" ? "selected" : ""}>Live — connected providers</option></select></label><label class="mode-choice">Streaming region<select id="watch-region">${REGIONS.map(([v, l]) => `<option value="${v}" ${v === watchRegion ? "selected" : ""}>${l}</option>`).join("")}</select></label><p class="small-print">Without a TMDB token, choose Anime in live mode. Live search uses provider relevance; combined pages may include the same anime from two sources.</p></section><section class="settings-section"><h3>Your library, backed up</h3><p>Favourites, ratings, collections, watch progress and notes are stored on this device. Export a backup to keep them safe or transfer them to another device.</p><div class="settings-actions"><button class="button secondary" data-action="export">${icon("download")} Export JSON</button><label class="button secondary import-button">${icon("upload")} Import backup<input type="file" id="import-file" accept=".json,application/json"/></label></div>${storageProblem ? `<div class="notice warning">${esc(storageProblem)}</div><button class="danger-text" data-action="recover-storage">Download unreadable data & start a new library</button>` : ""}</section><section class="settings-section credits-section"><h3>Catalogue credits</h3><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"><img class="tmdb-logo" src="/assets/tmdb.svg" alt="The Movie Database"/></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a>.</p><p>Anime metadata supplied by <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a> with <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer">Jikan</a>, an unofficial MyAnimeList API, as a fallback. Demo scores and episode counts are preview snapshots. Movie World is a discovery and tracking app; it does not stream films or episodes.</p></section>`,
    "Settings and catalogue credits",
  );
}
const nativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
// In the Android app a blob link does nothing, so the file is written to the cache and handed to the share sheet.
async function shareFile(content, filename) {
  const { Filesystem, Share } = window.Capacitor.Plugins,
    { uri } = await Filesystem.writeFile({ path: filename, data: content, directory: "CACHE", encoding: "utf8" });
  await Share.share({ title: filename, files: [uri], dialogTitle: "Save or send your backup" });
}
function download(content, filename) {
  if (nativeApp)
    return shareFile(content, filename).catch((e) => {
      if (!/cancel/i.test(e?.message || "")) toast("Could not export the file.");
    });
  const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function spotlight() {
  const cached =
    titleCache.get("tmdb:movie:335984") ||
    library.entries["tmdb:movie:335984"]?.title;
  if (cached) return openDetail(cached);
  try {
    openDetail(await api("/api/title/tmdb/movie/335984?mode=demo"));
  } catch (e) {
    toast(e.message);
  }
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (ratePop && !event.target.closest(".rate-pop")) closeRatePop();
  document.querySelectorAll(".menu-open").forEach((w) => {
    if (button?.dataset.action === "card-menu" && w.contains(button)) return;
    w.classList.remove("menu-open");
    w.querySelector(".quick-more, .detail-more")?.setAttribute("aria-expanded", "false");
  });
  if (!button) return;
  if (button.dataset.action === "card-menu") {
    const w = button.closest(".poster-wrap, .detail-menu"),
      open = w.classList.toggle("menu-open");
    button.setAttribute("aria-expanded", String(open));
    return;
  }
  const action = button.dataset.action,
    key = button.dataset.key,
    title =
      titleCache.get(key) ||
      library.entries[key]?.title ||
      library.interested?.[key];
  if (action === "dismiss-title" || action === "restore-title") {
    const t = title || library.dismissed?.[key] || selected;
    if (!t) return;
    const dismissed = { ...(library.dismissed || {}) };
    if (action === "dismiss-title") {
      if (!dismissed[t.key] && Object.keys(dismissed).length >= 20000)
        return toast("Your not-interested list is full.");
      dismissed[t.key] = validateTitle(t);
    } else delete dismissed[t.key];
    if (persist({ ...library, dismissed })) {
      if (selected && !button.closest(".title-card")) {
        renderMain();
        renderDetail();
      } else softRefresh(button.closest(".title-card"));
    }
    return;
  }
  if (action === "tonight") return tonightDialog();
  if (action === "mark-watched") {
    let t = title || selected;
    if (!t) return;
    if (hasWatched(library, t.key)) {
      const e = library.entries[t.key];
      // Watched via diary logs can't be undone from here; those logs are the record.
      if (!e || !(e.watched || e.status === "completed"))
        return toast("Watched from your diary. Remove the diary entry to undo.");
      if (
        persist(
          saveTitle(library, t, {
            status: "planned",
            watched: false,
            rewatchQueued: false,
            ...(t.episodes && e.progress === t.episodes ? { progress: 0, seen: {} } : {}),
          }),
        )
      ) {
        if (button.classList.contains("quick-watched")) softRefresh(button.closest(".title-card"));
        else {
          renderMain();
          if (selected) renderDetail();
        }
      }
      return;
    }
    // Cards carry no provider status; fetch it so ongoing series aren't marked completed.
    if (t.kind !== "movie" && !t.status && !t.demo)
      try {
        t = await api(`/api/title/${t.source}/${t.kind}/${t.id}?mode=live`);
        titleCache.set(t.key, t);
      } catch {}
    const ongoing = isOngoing(t);
    if (
      persist(
        saveTitle(library, t, {
          status: ongoing ? "watching" : "completed",
          watched: true,
          ...(t.episodes ? { progress: t.episodes, seen: allSeen(t) } : {}),
        }),
      )
    ) {
      // On a card, keep it in place and ask for a rating before anything else changes.
      if (button.classList.contains("quick-watched"))
        openRatePop(button.closest(".poster-wrap"), t.key);
      else {
        renderMain();
        if (selected) renderDetail();
      }
    }
    return;
  }
  if (action === "queue-rewatch") {
    const t = title || selected;
    if (!t) return;
    const queued = !library.entries[t.key]?.rewatchQueued;
    if (persist(saveTitle(library, t, { rewatchQueued: queued }))) {
      renderMain();
      if (selected) renderDetail();
    }
    return;
  }
  if (action === "card-save" && title) {
    const cur = library.entries[key];
    if (cur && isBare(cur)) {
      if (persist(removeTitle(library, key))) {
        renderMain();
        if (selected) renderDetail();
      }
      return;
    }
    if (cur)
      return utility(
        `<h2>Remove this title?</h2><p>This removes its rating, notes, progress and collection memberships from your library.</p><button class="button danger" data-action="confirm-remove" data-key="${esc(key)}">Remove title</button>`,
        "Remove title",
      );
    if (persist(saveTitle(library, title))) softRefresh(button.closest(".title-card"));
    return;
  }
  if (action === "diary-title") {
    const stored = library.entries[key]?.title || titleCache.get(key);
    if (stored) return openDetail(stored);
    const [source, type, id] = key.split(":");
    try {
      const t = await api(`/api/title/${source}/${type}/${id}?mode=${mode}`);
      return openDetail(t);
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "grid-view" || action === "list-view") {
    viewMode = action === "grid-view" ? "grid" : "list";
    try {
      localStorage.setItem("movie-world.view", viewMode);
    } catch {}
    renderMain();
    return;
  }
  if (action === "clear-filters") return applyFilters(emptyFilters());
  if (action === "filters-toggle") {
    filtersOpen = !filtersOpen;
    button.classList.toggle("open", filtersOpen);
    button.setAttribute("aria-expanded", String(filtersOpen));
    $("#filters-panel")?.classList.toggle("open", filtersOpen);
    return;
  }
  if (action === "filter-genre") {
    const g = button.dataset.genre,
      has = discoveryFilters.genres.includes(g);
    if (!has && discoveryFilters.genres.length >= 4) return toast("Pick up to four genres.");
    return applyFilters({
      ...discoveryFilters,
      genres: has ? discoveryFilters.genres.filter((x) => x !== g) : [...discoveryFilters.genres, g],
    });
  }
  if (action === "filter-decade") {
    const { from, to } = button.dataset,
      same = discoveryFilters.yearFrom === from && discoveryFilters.yearTo === to;
    return applyFilters({ ...discoveryFilters, yearFrom: same ? "" : from, yearTo: same ? "" : to });
  }
  if (action === "filter-airing") return applyFilters({ ...discoveryFilters, airing: button.dataset.value });
  if (action === "filter-remove") {
    const { kind: what, value } = button.dataset,
      f = discoveryFilters;
    return applyFilters(
      what === "genre"
        ? { ...f, genres: f.genres.filter((g) => g !== value) }
        : what === "year"
          ? { ...f, yearFrom: "", yearTo: "" }
          : what === "score"
            ? { ...f, minScore: 0 }
            : { ...f, airing: "" },
    );
  }
  if (action === "toggle-selection") {
    selectionMode = !selectionMode;
    if (!selectionMode) selection.clear();
    return renderMain();
  }
  if (action === "select-visible") {
    document
      .querySelectorAll("#main [data-selection]")
      .forEach((el) => selection.add(el.dataset.selection));
    return renderMain();
  }
  if (action === "bulk-edit")
    return utility(
      `<h2>Organise ${selection.size} titles.</h2><p>Change a watch status or add every selected title to a collection.</p><form id="bulk-form"><label>Watch status<select name="status"><option value="">Keep current status</option>${STATUSES.map((s) => `<option value="${s}">${statusLabels[s]}</option>`).join("")}</select></label><label>Add to collection<select name="folder"><option value="">Keep current collections</option>${library.folders.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></label><label class="log-rewatch"><input name="favorite" type="checkbox"/> Add to favourites</label><button class="button primary" type="submit">Apply to selected titles</button></form>`,
      "Bulk organise titles",
    );
  if (action === "quick-episode") {
    const t = title;
    if (!t) return;
    try {
      let next = library;
      if (!next.entries[t.key]) next = saveTitle(next, t);
      if (persist(logWatch(next, t, { type: "episode" }))) {
        renderMain();
        if (selected) renderDetail();
      }
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "edit-goal")
    return utility(
      `<h2>Your annual watch goal.</h2><p>Choose a number that makes room for the stories you love. Progress counts finished-title diary entries this year, including rewatches.</p><form id="goal-form"><label>Titles per year<input type="number" name="goal" min="1" max="1000" required value="${library.goal || 52}"/></label><button class="button primary" type="submit">Save goal</button></form>`,
      "Annual watch goal",
    );
  if (action === "delete-log")
    return utility(
      `<h2>Remove this diary entry?</h2><p>Your saved title, rating and episode progress will stay unchanged. Only this diary record is removed.</p><button class="button danger" data-action="confirm-delete-log" data-id="${esc(button.dataset.id)}">Remove diary entry</button>`,
      "Delete diary entry",
    );
  if (action === "confirm-delete-log") {
    if (
      persist({
        ...library,
        diary: library.diary.filter((l) => l.id !== button.dataset.id),
      })
    ) {
      $("#utility-dialog").close();
      renderMain();
    }
    return;
  }
  if (action === "calendar-next" || action === "calendar-prev") {
    const date = new Date(calendarMonth + "-01T12:00:00");
    date.setMonth(date.getMonth() + (action === "calendar-next" ? 1 : -1));
    calendarMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return renderMain();
  }
  if (action === "refresh-recommendations") {
    if (mode === "demo") {
      recommendationOffset = recommendationOffset
        ? 0
        : Math.min(8, Math.max(0, (catalogData?.results.length || 0) - 12));
      return renderMain();
    }
    if (forYouRaw) {
      recommendationOffset += forYouTab === "all" ? 4 : 12;
      return renderMain();
    }
    page = page >= 3 ? 1 : page + 1;
    return load();
  }
  if (action === "live-title" && selected) {
    try {
      const t = await api(
        `/api/title/${selected.source}/${selected.kind}/${selected.id}?mode=live`,
      );
      if (!selected || selected.key !== t.key) return;
      selected = t;
      titleCache.set(t.key, t);
      if (library.entries[t.key]) persist(saveTitle(library, t));
      renderDetail();
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "detail" && title) {
    $("#person-dialog").close();
    return openDetail(title);
  }
  if (action === "spotlight") return spotlight();
  if (action === "favorite" && title) {
    if (
      persist(
        saveTitle(library, title, {
          favorite: !library.entries[key]?.favorite,
        }),
      )
    ) {
      softRefresh(button.closest(".title-card"));
    }
    return;
  }
  if (action === "watchlist") {
    try {
      const t = title || (await api("/api/title/tmdb/movie/335984?mode=demo"));
      const cur = library.entries[t.key];
      if (cur && !isBare(cur)) return openDetail(t);
      if (cur) {
        if (persist(removeTitle(library, t.key))) {
          renderMain();
        }
        return;
      }
      if (persist(saveTitle(library, t))) {
        renderMain();
      }
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "tonight-again") return drawTonight();
  if (action === "tonight-restart") return tonightDialog();
  if (action === "tonight-back") {
    tonight.step = Math.max(0, tonight.step - 1);
    return renderTonight();
  }
  if (action === "tonight-answer") {
    const { field, value } = button.dataset;
    tonight[field] = field === "minutes" ? Number(value) : value;
    tonight.step++;
    return renderTonight();
  }
  if (action === "rate") {
    const v = Number(button.dataset.value);
    return entryUpdate({ rating: v === (library.entries[selected?.key]?.rating || 0) ? 0 : v });
  }
  if (action === "test-token" || action === "save-token") {
    const field = $("#tmdb-token"),
      status = $("#token-status");
    if (!localApi || !field) return;
    const value = field.value.trim();
    if (action === "test-token") {
      status.textContent = "Checking with TMDB…";
      const result = await localApi.testToken(value);
      status.textContent = result.message;
      status.dataset.ok = String(result.ok);
      return;
    }
    try {
      localApi.setToken(value);
    } catch (e) {
      return void ((status.textContent = e.message), (status.dataset.ok = "false"));
    }
    config = { ...config, tmdbConfigured: Boolean(value) };
    status.textContent = value ? "Saved. Movies and series are now available in Live mode." : "Token removed.";
    status.dataset.ok = "true";
    forYouRaw = null;
    weekData = null;
    $("#utility-dialog").querySelector(".connection-pill")?.classList.toggle("connected", Boolean(value));
    const pill = $("#utility-dialog").querySelector(".connection-pill");
    if (pill) pill.textContent = value ? "Connected" : "Key needed";
    if (mode === "live") load();
    return;
  }
  if (action === "rate-skip") return closeRatePop();
  if (action === "rate-card") {
    const t = titleCache.get(button.dataset.key) || library.entries[button.dataset.key]?.title,
      v = Number(button.dataset.value);
    if (!t || !persist(saveTitle(library, t, { rating: v }))) return;
    const pop = button.closest(".rate-pop");
    const rated = button.closest(".title-card");
    if (rated) patchCard(rated, t.key);
    pop.innerHTML = `<b>Rated ${v}/10</b>`;
    pop.classList.add("done");
    clearTimeout(ratePop?.timer);
    if (ratePop) ratePop.timer = setTimeout(() => closeRatePop(), 750);
    return;
  }
  if (action === "people") return openPeople(button.dataset.group);
  if (action === "person")
    return openPerson(Number(button.dataset.id), Boolean(button.dataset.list));
  if (action === "people-back") return peopleList && renderPeopleList();
  if (action === "close-person") return $("#person-dialog").close();
  if (action === "person-tab") {
    const pane = button.closest(".person-pane"),
      data = personCache.get(Number(pane.dataset.person));
    return renderProfile(data, button.dataset.tab, pane.dataset.back === "1");
  }
  if (action === "episode-toggle" || action === "season-watched") {
    event.preventDefault();
    return toggleEpisodes(action, button.dataset);
  }
  if (action === "interest" && title) {
    try {
      if (!persist(toggleInterested(library, title))) return;
    } catch (e) {
      return toast(e.message);
    }
    if (route === "interested") return renderMain();
    const on = Boolean(library.interested[key]);
    document.querySelectorAll(`.quick-interest[data-key="${key}"]`).forEach((b) => {
      b.classList.toggle("is-saved", on);
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", `${on ? "Stop following" : "Follow"} ${title.title}`);
    });
    return;
  }
  if (action === "trailer") {
    const id = button.dataset.id;
    if (!/^[\w-]{11}$/.test(id)) return;
    const d = $("#trailer-dialog");
    d.innerHTML = `<div class="trailer-bar"><span>Trailer</span><button data-action="close-trailer" aria-label="Close trailer">Close ${icon("close")}</button></div><div class="trailer-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="trailer-note">Trailer not loading? <a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer">Open it on YouTube ${icon("arrow")}</a></p>`;
    // Ask the player to report state changes so the dialog can close when the video ends.
    const frame = d.querySelector("iframe");
    frame.addEventListener("load", () => {
      const say = (m) => frame.contentWindow.postMessage(JSON.stringify(m), "https://www.youtube-nocookie.com");
      say({ event: "listening", id: 1, channel: "widget" });
      say({ event: "command", func: "addEventListener", args: ["onStateChange"] });
    });
    if (!d.open) d.showModal();
    return;
  }
  if (action === "close-trailer") return $("#trailer-dialog").close();
  if (action === "nav-more") {
    navMore = !moreOpen();
    try {
      localStorage.setItem("movie-world.nav-more", navMore ? "1" : "0");
    } catch {}
    button.setAttribute("aria-expanded", String(navMore));
    button.nextElementSibling.classList.toggle("open", navMore);
    return;
  }
  if (action === "detail-save") {
    const cur = library.entries[selected.key];
    if (!cur) entryUpdate({}, "Added to your library");
    else if (isBare(cur)) {
      if (persist(removeTitle(library, selected.key))) {
        renderDetail();
        renderMain();
      }
    } else
      utility(
        `<h2>Remove this title?</h2><p>This removes its rating, notes, progress and collection memberships from your library.</p><button class="button danger" data-action="confirm-remove">Remove title</button>`,
        "Remove title",
      );
    return;
  }
  if (action === "detail-favorite")
    return entryUpdate(
      { favorite: !library.entries[selected.key]?.favorite },
      "Favourites updated",
    );
  if (action === "confirm-remove") {
    if (persist(removeTitle(library, key || selected.key))) {
      $("#utility-dialog").close();
      renderDetail();
      renderMain();
    }
    return;
  }
  if (action === "close-detail") {
    $("#detail-dialog").close();
    detailController?.abort();
    selected = null;
    return;
  }
  if (action === "close-utility") return $("#utility-dialog").close();
  if (action === "settings") return settings();
  if (action === "new-folder") return folderDialog();
  if (action === "rename-folder") return folderDialog(true);
  if (action === "delete-folder") {
    const f = library.folders.find((f) => f.id === folderId);
    return utility(
      `<h2>Delete “${esc(f?.name)}”?</h2><p>The titles stay in your library. Only this collection will be removed.</p><button class="button danger" data-action="confirm-delete-folder">Delete collection</button>`,
      "Delete collection",
    );
  }
  if (action === "confirm-delete-folder") {
    if (persist(deleteFolder(library, folderId))) {
      $("#utility-dialog").close();
      location.hash = "library";
    }
    return;
  }
  if (action === "export") {
    download(
      JSON.stringify(library, null, 2),
      `movie-world-${new Date().toISOString().slice(0, 10)}.json`,
    );
    return;
  }
  if (action === "toggle-mode") {
    setMode(mode === "demo" ? "live" : "demo");
    return;
  }
  if (action === "retry") return load();
  if (action === "retry-more") return loadMore();
  if (action === "menu") {
    $("#sidebar").classList.toggle("open");
    syncNavigation();
    return;
  }
  if (action === "close-menu") {
    $("#sidebar").classList.remove("open");
    syncNavigation();
    $(".mobile-menu")?.focus();
    return;
  }
  if (action === "recover-storage") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) download(raw, "movie-world-unreadable-backup.json");
      localStorage.removeItem(STORAGE_KEY);
      storageProblem = "";
      library = emptyLibrary();
      renderSidebar();
      renderMain();
      settings();
    } catch {
      toast("Browser storage is unavailable. Enable storage and reload.");
    }
    return;
  }
  if (action === "confirm-import") {
    try {
      const next = parseLibrary($("#utility-dialog").dataset.importData);
      if (persist(next)) {
        $("#utility-dialog").close();
        renderMain();
        if (selected) renderDetail();
      }
    } catch (e) {
      toast(e.message);
    }
    return;
  }
});
function setMode(next) {
  mode = next;
  try {
    localStorage.setItem("movie-world.mode", mode);
  } catch {}
  page = 1;
  renderMode();
  $("#utility-dialog").close();
  if (mode === "live" && !config.tmdbConfigured && !isPersonal())
    location.hash = "anime";
  else load();
}
document.addEventListener("input", (event) => {
  if (event.target.id === "global-search") {
    query = event.target.value;
    page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 350);
  }
});
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id !== "filter-score") return;
  const v = Number(el.value);
  el.style.setProperty("--p", `${(v / 9) * 100}%`);
  $("#filter-score-out").textContent = v ? `${v.toFixed(1)}+` : "Any";
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (el.id === "hide-watched") {
    hideWatched = el.checked;
    try {
      localStorage.setItem("movie-world.hide-watched", String(hideWatched));
    } catch {}
    return softRefresh();
  }
  if (el.id === "filter-year-from" || el.id === "filter-year-to") {
    const next = {
      ...discoveryFilters,
      yearFrom: $("#filter-year-from")?.value || "",
      yearTo: $("#filter-year-to")?.value || "",
    };
    const max = new Date().getFullYear() + 5,
      bad = (y) => y && (!/^\d{4}$/.test(y) || Number(y) < 1900 || Number(y) > max);
    if (bad(next.yearFrom) || bad(next.yearTo)) {
      toast("Choose years between 1900 and five years from now.");
      el.value = discoveryFilters[el.id === "filter-year-from" ? "yearFrom" : "yearTo"];
      return;
    }
    if (next.yearFrom && next.yearTo && Number(next.yearFrom) > Number(next.yearTo))
      [next.yearFrom, next.yearTo] = [next.yearTo, next.yearFrom];
    return applyFilters(next);
  }
  if (el.id === "person-sort") {
    personSort = el.value;
    const pane = el.closest(".person-pane");
    return renderProfile(personCache.get(Number(pane.dataset.person)), pane.dataset.tab, pane.dataset.back === "1");
  }
  if (el.id === "filter-score") return applyFilters({ ...discoveryFilters, minScore: Number(el.value) });
  if (el.dataset.selection) {
    el.checked
      ? selection.add(el.dataset.selection)
      : selection.delete(el.dataset.selection);
    return renderMain();
  }
  if (el.id === "watch-region") {
    watchRegion = el.value;
    try {
      localStorage.setItem("movie-world.region", watchRegion);
    } catch {}
    return hydrateExtras();
  }
  if (el.id === "season-select") {
    seasonNumber = Number(el.value);
    return loadSeason(seasonNumber);
  }
  if (el.id === "sort-select") {
    sort = el.value;
    page = 1;
    load();
  }
  if (el.id === "kind-filter") {
    libraryKind = el.value;
    renderMain();
  }
  if (el.id === "status-filter") {
    libraryStatus = el.value;
    renderMain();
  }
  if (el.id === "mode-select") setMode(el.value);
  if (el.id === "import-file" && el.files[0]) {
    try {
      if (el.files[0].size > 15000000)
        throw new Error("Backup must be smaller than 15 MB.");
      const raw = await el.files[0].text(),
        next = parseLibrary(raw);
      utility(
        `<h2>Restore this library?</h2><p>This backup contains <strong>${Object.keys(next.entries).length} titles</strong> and <strong>${next.folders.length} collections</strong>. It will replace your current library. Export your current library first if you want to keep it.</p><div class="settings-actions"><button class="button secondary" data-action="export">Export current library</button><button class="button primary" data-action="confirm-import">Replace & restore</button></div>`,
        "Restore library",
      );
      $("#utility-dialog").dataset.importData = raw;
    } catch (e) {
      toast(e.message);
      el.value = "";
    }
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "goal-form") {
    event.preventDefault();
    const goal = Number(new FormData(event.target).get("goal"));
    if (
      Number.isInteger(goal) &&
      goal >= 1 &&
      goal <= 1000 &&
      persist({ ...library, goal })
    ) {
      $("#utility-dialog").close();
      renderMain();
    }
    return;
  }
  if (event.target.id === "bulk-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    let next = library;
    for (const key of selection) {
      const e = next.entries[key];
      if (!e) continue;
      const patch = {};
      if (data.get("status")) patch.status = data.get("status");
      if (data.get("folder"))
        patch.folders = [...new Set([...e.folders, data.get("folder")])];
      if (data.has("favorite")) patch.favorite = true;
      next = saveTitle(next, e.title, patch);
    }
    if (persist(next)) {
      $("#utility-dialog").close();
      selectionMode = false;
      selection.clear();
      renderMain();
    }
    return;
  }
  if (event.target.id !== "folder-form") return;
  event.preventDefault();
  try {
    const rename = event.target.dataset.rename === "true",
      name = $("#folder-name").value;
    const next = rename
      ? renameFolder(library, folderId, name, $("#folder-notes").value)
      : addFolder(library, name, undefined, $("#folder-notes").value);
    if (persist(next)) {
      $("#utility-dialog").close();
      if (selected && $("#detail-dialog").open) renderDetail();
      renderMain();
      if (rename) $("#breadcrumb").textContent = name.trim();
    }
  } catch (e) {
    $("#folder-error").textContent = e.message;
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement?.tagName,
    ) &&
    !$("#detail-dialog").open &&
    !$("#utility-dialog").open
  ) {
    event.preventDefault();
    $("#global-search").focus();
  }
  if (event.key === "Escape") {
    $("#sidebar")?.classList.remove("open");
    syncNavigation();
  }
});
$("#detail-dialog").addEventListener("close", () => {
  detailController?.abort();
  selected = null;
});
for (const d of [$("#detail-dialog"), $("#utility-dialog")])
  d.addEventListener("click", (event) => {
    if (event.target === d) {
      const r = d.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        d.close();
    }
  });
window.addEventListener("hashchange", readRoute);
matchMedia("(max-width: 620px)").addEventListener("change", syncNavigation);
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  $("#toast").classList.remove("visible");
  try {
    library = event.newValue ? parseLibrary(event.newValue) : emptyLibrary();
    renderSidebar();
    renderMain();
    if (selected) renderDetail();
  } catch {
    toast("A library update from another tab could not be loaded.");
  }
});
// Work out how the app gets its data: a Node server if one answers, otherwise the in-app adapter.
async function detectBackend() {
  try {
    const response = await fetch("/api/config"),
      data = await response.json();
    if (response.ok && typeof data.tmdbConfigured === "boolean" && !data.offline) return data;
  } catch {}
  const { createLocalApi } = await import("./local-api.js");
  localApi = createLocalApi(localStorage);
  return localApi.request("/api/config");
}
// Pages that need to know whether TMDB is connected wait on this before fetching.
const configReady = (backendReady = detectBackend())
  .then((data) => {
    config = data;
  })
  .catch(() =>
    toast(
      "Could not check catalogue connection. Demo titles are still available.",
    ),
  );
initSelectMenus();
// Android's back button (and a browser's) should close the top dialog before leaving the page: each open dialog
// pushes one history entry, and closing it by any other route (X, Esc, backdrop) removes that entry again.
if (typeof HTMLDialogElement !== "undefined" && typeof history !== "undefined") {
  const openDialogs = [];
  let skipPops = 0;
  const nativeShow = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    const wasOpen = this.open;
    nativeShow.call(this);
    if (!wasOpen) {
      openDialogs.push(this);
      history.pushState({ dialog: true }, "");
    }
  };
  document.addEventListener(
    "close",
    (e) => {
      const i = openDialogs.indexOf(e.target);
      if (i < 0) return;
      openDialogs.splice(i, 1);
      skipPops++;
      history.back();
    },
    true,
  );
  window.addEventListener("popstate", () => {
    if (skipPops) return void skipPops--;
    // Back pressed: close the newest dialog without also removing a history entry a second time.
    const top = openDialogs.pop();
    if (top) top.close();
  });
  // The Android WebView does not hand the back button to history, so the app handles it: close a dialog, step
  // back through pages, and only then leave the app.
  if (nativeApp)
    window.Capacitor.Plugins.App.addListener("backButton", () => {
      if (openDialogs.length) return openDialogs.at(-1).close();
      if (location.hash && location.hash !== "#discover") return history.back();
      window.Capacitor.Plugins.App.exitApp();
    });
}
// Escape and the back button close the title view without going through its X button.
$("#detail-dialog")?.addEventListener("close", () => {
  detailController?.abort();
  selected = null;
});
$("#trailer-dialog")?.addEventListener("close", (e) => (e.target.innerHTML = ""));
$("#person-dialog")?.addEventListener("click", (e) => e.target === e.currentTarget && e.currentTarget.close());
// Click on the backdrop closes the trailer; so does the video ending.
$("#trailer-dialog")?.addEventListener("click", (e) => e.target === e.currentTarget && e.currentTarget.close());
window.addEventListener("message", (e) => {
  if (e.origin !== "https://www.youtube-nocookie.com") return;
  let m;
  try {
    m = JSON.parse(e.data);
  } catch {
    return;
  }
  if ((m.event === "onStateChange" ? m.info : m.info?.playerState) === 0) {
    // Fade out instead of cutting away the moment the trailer finishes.
    const d = $("#trailer-dialog");
    if (!d.open || d.classList.contains("fading")) return;
    d.classList.add("fading");
    setTimeout(() => {
      d.close();
      d.classList.remove("fading");
    }, 1000);
  }
});
shell();
readRoute();
if ("serviceWorker" in navigator && !nativeApp)
  navigator.serviceWorker
    .register("/sw.js", { type: "module" })
    .catch(() => {});
window.addEventListener("offline", () =>
  toast(
    "You are offline. Your saved library and installed demo remain available.",
  ),
);
window.addEventListener("online", () =>
  toast("Back online. Live discovery is available again."),
);

