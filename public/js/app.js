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
} from "./library.js";
import {
  filterBar,
  renderExperience,
  detailExtras,
  GENRES,
} from "./experience.js";
import {
  logWatch,
  pickTonight,
  today,
  validDate,
  hasWatched,
} from "./insights.js";
import { matchesFilters } from "./catalog-filters.js";

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
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
let discoveryFilters = { genre: "", year: "", minScore: 0 },
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
let hideWatched = false;
try {
  hideWatched = localStorage.getItem("movie-world.hide-watched") === "true";
} catch {}
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
  ["dashboard", "diary", "collections", "calendar", "recommendations"].includes(
    route,
  );
const kind = () => (["movie", "tv", "anime"].includes(route) ? route : "all");
let undoState = null;
function toast(text) {
  $("#toast").innerHTML =
    `<span>${esc(text)}</span>${undoState ? '<button data-action="undo">Undo</button>' : ""}`;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    undoState ? 10000 : 3500,
  );
}
function persist(next, remember = true) {
  if (storageProblem) {
    toast(
      "Resolve the saved-library issue in Settings before changing your library.",
    );
    return false;
  }
  try {
    const before = JSON.stringify(library),
      after = JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY, after);
    if (remember && before !== after) undoState = { before, after };
    library = next;
    renderSidebar();
    renderStats();
    if (remember && undoState) toast("Library updated");
    return true;
  } catch {
    toast(
      "Unable to save: browser storage is full or disabled. Export a backup in Settings.",
    );
    return false;
  }
}
function undoLastAction() {
  if (!undoState) return toast("No library action to undo.");
  if (localStorage.getItem(STORAGE_KEY) !== undoState.after) {
    undoState = null;
    return toast(
      "Your library changed in another tab. Reload before making changes.",
    );
  }
  const previous = parseLibrary(undoState.before);
  if (!persist(previous, false)) return;
  undoState = null;
  selection.clear();
  renderSidebar();
  renderMain();
  if (selected) renderDetail();
  $("#utility-dialog").close();
  toast("Last library action undone");
}
function shell() {
  $("#app").innerHTML =
    `<aside class="sidebar" id="sidebar"><a href="#discover" class="brand"><img src="/assets/icon.svg" alt=""/><span>MOVIE<span class="brand-light">WORLD</span><small>YOUR CINEMATIC UNIVERSE</small></span></a><div id="sidebar-nav"></div><div class="sidebar-bottom"><div class="signal"><span></span> PERSONAL SPACE <span class="signal-id">01</span></div><button class="profile" data-action="settings"><span class="avatar">MW</span><span>Your universe<small>Local library · Private by default</small></span>${icon("settings")}</button></div></aside><button class="nav-scrim" data-action="close-menu" aria-label="Close navigation"></button>
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
  $("#sidebar-nav").innerHTML =
    `<div class="nav-label">EXPLORE</div><nav aria-label="Explore">${nav("discover", "Discover", "compass")}${nav("movie", "Movies", "film")}${nav("tv", "TV series", "tv")}${nav("anime", "Anime", "anime")}</nav><div class="nav-label">YOUR LIBRARY</div><nav aria-label="Your library">${nav("dashboard", "Overview", "grid")}${nav("library", "All titles", "library", entries.length)}${nav("watched", "Watched", "check", entries.filter((e) => hasWatched(library, e.title.key)).length)}${nav("rewatch", "Rewatch list", "clock", entries.filter((e) => e.rewatchQueued).length)}${nav("diary", "Watch diary", "clock")}${nav("collections", "Collections", "folder")}${nav("calendar", "Calendar", "tv")}${nav("recommendations", "For you", "star")}${nav("favorites", "Favourites", "heart", favorites)}${nav("dismissed", "Not interested", "close", Object.keys(library.dismissed || {}).length)}</nav><button class="create-collection" data-action="undo" ${undoState ? "" : "disabled"}>Undo last action</button><div class="nav-label collection-label">COLLECTIONS<button data-action="new-folder" class="icon-button" aria-label="Create collection">${icon("plus")}</button></div><nav aria-label="Collections">${library.folders.map((f, i) => `<a href="#folder/${esc(f.id)}" class="nav-link folder-link ${route === "folder" && folderId === f.id ? "active" : ""}" ${route === "folder" && folderId === f.id ? 'aria-current="page"' : ""}><span class="folder-color color-${i % 4}">${icon("folder")}</span><span>${esc(f.name)}</span><span class="nav-count">${entries.filter((e) => e.folders.includes(f.id)).length}</span></a>`).join("")}</nav><button class="create-collection" data-action="new-folder">${icon("plus")} New collection</button><div class="sidebar-note"><span class="tiny-orbit">✦</span><p>Good stories deserve<br/>a place of their own.</p></div>`;
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
  el.innerHTML = `<span>${icon("library")} <b>${entries.length}</b> in your library</span><span>${icon("heart")} <b>${entries.filter((e) => e.favorite).length}</b> favourites</span><span>${icon("folder")} <b>${library.folders.length}</b> collections</span>`;
}
async function api(path, signal) {
  const response = await fetch(path, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function readRoute() {
  const [next, id] = location.hash.slice(1).split("/");
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
    "recommendations",
  ].includes(next)
    ? next
    : "discover";
  folderId = id || "";
  query = "";
  $("#global-search").value = "";
  page = 1;
  sort = isPersonal() ? "recent" : "popular";
  libraryStatus = "all";
  libraryKind = "all";
  discoveryFilters = { genre: "", year: "", minScore: 0 };
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
          library: "Your library",
          favorites: "Favourites",
          dashboard: "Overview",
          diary: "Watch diary",
          collections: "Collections",
          calendar: "Calendar",
          recommendations: "For you",
          watched: "Watched",
          rewatch: "Rewatch list",
          dismissed: "Not interested",
        }[route];
  load();
}
async function load() {
  controller?.abort();
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
  renderMain();
  try {
    const data = await api(
      `/api/catalog?${new URLSearchParams({ kind: route === "recommendations" && mode === "live" && !config.tmdbConfigured ? "anime" : kind(), query: route === "recommendations" ? "" : query, sort, page: String(page), mode, ...discoveryFilters })}`,
      own.signal,
    );
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
function card(t) {
  titleCache.set(t.key, t);
  const entry = library.entries[t.key];
  return `<article class="title-card"><div class="poster-wrap"><button class="poster-button" data-action="detail" data-key="${esc(t.key)}" aria-label="View ${esc(t.title)}"><div class="poster-fallback"><span>${icon(t.kind === "anime" ? "anime" : "film")}</span><strong>${esc(t.title)}</strong></div>${t.poster ? `<img class="poster" src="${esc(t.poster)}" alt="" loading="lazy"/>` : ""}<span class="poster-shade"></span><span class="score">${icon("star")} ${t.score ? Number(t.score).toFixed(1) : "—"}</span><span class="poster-open">Explore title ${icon("arrow")}</span></button><button class="quick-favorite ${entry?.favorite ? "is-favorite" : ""}" data-action="favorite" data-key="${esc(t.key)}" aria-label="${entry?.favorite ? "Remove" : "Add"} ${esc(t.title)} ${entry?.favorite ? "from" : "to"} favourites" aria-pressed="${Boolean(entry?.favorite)}">${icon("heart")}</button>${entry ? `<span class="saved-status ${entry.status === "completed" ? "completed" : ""}">${icon(entry.status === "completed" ? "check" : "plus")}${esc(statusLabels[entry.status])}</span>` : ""}</div><div class="card-heading"><button data-action="detail" data-key="${esc(t.key)}">${esc(t.title)}</button>${entry?.rating ? `<span class="personal-score" title="Your rating">${icon("star")}${entry.rating}</span>` : ""}</div><div class="card-meta"><span>${t.year || "TBA"}</span><span class="meta-dot">·</span><span>${labels[t.kind]}</span><span class="card-genre">${esc(t.genres[0] || "")}</span></div></article>`;
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
    hideWatched && !["watched", "rewatch", "dismissed"].includes(route)
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
      : route === "movie"
        ? "Cinema without limits."
        : route === "tv"
          ? "One more episode."
          : route === "anime"
            ? "Beyond imagination."
            : "Find your next obsession.";
  $("#main").innerHTML =
    `${discover ? (library.dismissed?.["tmdb:movie:335984"] ? "" : renderHero()) + `<nav class="universe-launcher" aria-label="Your universe shortcuts"><a href="#dashboard">${icon("grid")}<span>Your observatory<small>Stats, goals and current watches</small></span>${icon("arrow")}</a><a href="#recommendations">${icon("star")}<span>Made for your taste<small>Find a story that feels like you</small></span>${icon("arrow")}</a><button data-action="tonight">${icon("play")}<span>Tonight, decided<small>One pick from your watchlist</small></span>${icon("arrow")}</button></nav>` : ""}<section class="catalog-section"><div class="section-heading"><div><div class="eyebrow section-eyebrow">${personal ? "PERSONAL COLLECTION" : "THE DISCOVERY FEED"}</div><h2>${esc(heading)}</h2><p>${personal ? (route === "folder" && folder?.notes ? esc(folder.notes) : route === "dismissed" ? "Hidden from discovery and recommendations. Restore a title whenever you change your mind." : "Every world you've entered. Every story still waiting.") : mode === "demo" ? "A curated preview of movies, series and anime. Your universe starts here." : route === "discover" ? "Movies, series and anime from TMDB and AniList." : "Explore the live catalogue. Find something worth your time."}</p></div>${personal ? `<div class="heading-actions">${route === "folder" && folder ? `<button class="icon-button bordered" data-action="rename-folder" aria-label="Edit collection">${icon("edit")}</button><button class="icon-button bordered" data-action="delete-folder" aria-label="Delete collection">${icon("trash")}</button>` : ""}<button class="button secondary" data-action="export">${icon("download")} Export library</button></div>` : `<button class="button secondary" data-action="tonight">${icon("play")} Pick tonight</button>`}</div>
  ${storageProblem ? `<div class="notice warning">${esc(storageProblem)}</div>` : ""}
  ${!personal ? `<div class="mode-banner"><span>${icon(mode === "demo" ? "compass" : "globe")} ${mode === "demo" ? "You’re exploring the demo. Connect TMDB for the full movie & TV catalogue. Anime needs no key." : "Live catalogue enabled. Your personal library stays on this browser."}</span><button data-action="${mode === "demo" ? "settings" : "toggle-mode"}">${mode === "demo" ? "Connect catalogue" : "Use demo"} ${icon("arrow")}</button></div>` : ""}
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
      : `<nav class="type-tabs" aria-label="Content type">${[
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
        ["newest", "Newest first"],
      ]
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${sort === v ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></div></div>
  ${filterBar({ filters: discoveryFilters, esc, query, route, mode: personal ? "demo" : mode })}
  ${!["watched", "rewatch"].includes(route) ? `<label class="hide-watched-control"><input type="checkbox" id="hide-watched" ${hideWatched ? "checked" : ""}/> Hide watched titles <small>Filters this results page using your viewing history</small></label>` : ""}<div class="view-toolbar"><span>${personal ? "YOUR PERSONAL ARCHIVE" : "EXPLORE THE CATALOGUE"}</span><div>${personal ? `<button class="button secondary" data-action="toggle-selection">${icon("check")} ${selectionMode ? "Done selecting" : "Select titles"}</button>` : ""}<button class="icon-button ${viewMode === "grid" ? "selected-view" : ""}" data-action="grid-view" aria-label="Grid view" aria-pressed="${viewMode === "grid"}">${icon("grid")}</button><button class="icon-button ${viewMode === "list" ? "selected-view" : ""}" data-action="list-view" aria-label="List view" aria-pressed="${viewMode === "list"}">${icon("menu")}</button></div></div>
  ${selectionMode ? `<div class="bulk-toolbar"><span>${selection.size} selected</span><button data-action="select-visible">Select visible</button><button class="button primary" data-action="bulk-edit" ${selection.size ? "" : "disabled"}>Organise selected ${icon("folder")}</button></div>` : ""}
  ${catalogData?.warning ? `<div class="notice warning">${esc(catalogData.warning)}</div>` : ""}
  ${error ? `<div class="empty-state error-state">${icon("globe")}<h3>Connection interrupted</h3><p>${esc(error)}</p><div><button class="button primary" data-action="retry">Try again</button><button class="button secondary" data-action="toggle-mode">${mode === "live" ? "Explore demo" : "Use live catalogue"}</button></div></div>` : loading ? `<div class="title-grid skeleton-grid" aria-label="Loading titles" aria-busy="true">${Array.from({ length: 6 }, () => '<div class="skeleton-card"><div></div><span></span><small></small></div>').join("")}</div>` : titles.length ? `<div class="title-grid">${titles.map(card).join("")}</div>` : `<div class="empty-state">${icon(personal ? "library" : "search")}<span class="eyebrow">THE NEXT CHAPTER IS YOURS</span><h3>${personal ? "Make this space your own." : "No titles found."}</h3><p>${personal ? (query || libraryStatus !== "all" || libraryKind !== "all" ? "Try changing your filters or search." : "Save a title, tap a heart, or add something to a collection. Your story starts with a discovery.") : "Try a different title or switch content type."}</p><a href="#discover" class="button primary">Explore titles ${icon("arrow")}</a></div>`}
  ${!personal && catalogData && catalogData.totalPages > 1 ? `<div class="pagination"><button class="button secondary" data-action="previous" ${page === 1 ? "disabled" : ""}>Previous</button><span>Page ${page} of ${catalogData.totalPages}${route === "discover" && mode === "live" ? " · Combined provider pages" : ""}</span><button class="button secondary" data-action="next" ${page >= catalogData.totalPages ? "disabled" : ""}>Next page ${icon("arrow")}</button></div>` : ""}
  <div class="library-stats" id="library-stats"></div></section>`;
  renderStats();
  if (viewMode === "list")
    document
      .querySelector(".title-grid:not(.skeleton-grid)")
      ?.classList.add("list-view");
  bindImages();
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
      const wrap = article.querySelector(".poster-wrap");
      wrap.insertAdjacentHTML(
        "beforeend",
        `<button class="quick-save ${e ? "is-saved" : ""}" data-action="card-save" data-key="${esc(key)}" aria-label="${e ? "Open saved" : "Save"} ${esc(t.title)}">${icon(e ? "check" : "plus")}</button>`,
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
        `<div class="watch-card-actions"><button data-action="dismiss-title" data-key="${esc(key)}">Not interested</button><button class="${hasWatched(library, key) ? "has-watched" : ""}" data-action="mark-watched" data-key="${esc(key)}" ${hasWatched(library, key) ? "disabled" : ""}>${icon("check")} ${hasWatched(library, key) ? "Watched" : "Mark watched"}</button>${hasWatched(library, key) ? `<button class="${e?.rewatchQueued ? "queued" : ""}" data-action="queue-rewatch" data-key="${esc(key)}" aria-pressed="${Boolean(e?.rewatchQueued)}">${icon("clock")} ${e?.rewatchQueued ? "In rewatch list" : "Rewatch"}</button>` : ""}</div>` +
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
function flushNotes() {
  if (!selected) return;
  const field = $("#detail-notes"),
    entry = library.entries[selected.key];
  if (field && entry && field.value !== entry.notes)
    persist(saveTitle(library, selected, { notes: field.value }));
}
function logDialog(title = selected) {
  if (!title) return;
  if (!library.entries[title.key] && !persist(saveTitle(library, title)))
    return;
  utility(
    `<div class="eyebrow">ANOTHER STORY, LIVED</div><h2>Log your watch.</h2><p>${esc(title.title)}</p><form id="watch-log-form" data-key="${esc(title.key)}"><div class="personal-fields"><label>Watch date<input name="date" type="date" value="${today()}" max="${today()}" required/></label><label>Rating / 10<select name="rating"><option value="0">Keep current rating</option>${Array.from(
      { length: 20 },
      (_, i) => (i + 1) / 2,
    )
      .map((n) => `<option value="${n}">${n.toFixed(1)}</option>`)
      .join(
        "",
      )}</select></label></div><label class="log-rewatch"><input name="rewatch" type="checkbox" ${hasWatched(library, title.key) ? "checked" : ""}/> This was a rewatch</label><label>What stayed with you?<textarea name="notes" rows="3" maxlength="2000" placeholder="A private thought for your diary..."></textarea></label><p class="small-print">Logging a finished title marks it completed. For individual episodes, use Log next episode.</p><p id="watch-log-error" class="form-error" role="alert"></p><button class="button primary" type="submit">${icon("check")} Save to watch diary</button></form>`,
    "Log a watch",
  );
}
function tonightDialog() {
  utility(
    `<div class="eyebrow">THE END OF ENDLESS SCROLLING</div><h2>Tonight, decided.</h2><p>One choice from your unwatched library. High-priority titles get first consideration.</p><form id="tonight-form"><div class="personal-fields"><label>What are you in the mood for?<select name="kind"><option value="all">Any world</option><option value="movie">A movie</option><option value="tv">A series</option><option value="anime">Anime</option></select></label><label>Time available<select name="minutes"><option value="0">No limit</option><option value="30">Up to 30 minutes</option><option value="90">Up to 90 minutes</option><option value="120">Up to 2 hours</option><option value="180">Up to 3 hours</option></select></label></div><label class="picker-genre">Genre<select name="genre"><option value="">Surprise me</option>${GENRES.map((g) => `<option>${esc(g)}</option>`).join("")}</select></label><p class="small-print">Time filters use known runtimes (per episode for series/anime). Unknown runtimes are excluded when a time limit is set.</p><button class="button primary" type="submit">${icon("play")} Find tonight's story</button></form><div id="tonight-result"></div>`,
    "Pick something to watch",
  );
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
      const groups = [
        ["Subscription", "stream"],
        ["Free", "free"],
        ["With ads", "ads"],
        ["Rent", "rent"],
        ["Buy", "buy"],
      ].filter(([, g]) => data[g]?.length);
      $("#watch-availability").innerHTML = groups.length
        ? groups
            .map(
              ([label, g]) =>
                `<div class="provider-group"><h4>${label}</h4><div>${data[g].map((p) => `<span>${p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy"/>` : ""}${esc(p.name)}</span>`).join("")}</div></div>`,
            )
            .join("") +
          (data.link
            ? `<a class="text-link" href="${esc(data.link)}" target="_blank" rel="noopener noreferrer">Check offers on TMDB ${icon("arrow")}</a>`
            : "")
        : '<p class="panel-empty">No provider availability is listed for this region. This does not prove the title is unavailable.</p>';
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
    $("#season-episodes").innerHTML =
      data.episodes
        .map(
          (e) =>
            `<details class="episode-row"><summary><span class="episode-number">${String(e.number).padStart(2, "0")}</span><strong>${esc(e.name)}</strong><span>${esc(e.airDate || "TBA")}${e.runtime ? ` &middot; ${e.runtime}m` : ""}</span></summary><p>${esc(e.overview || "No episode summary available.")}</p><small>Open summaries only when you are ready for spoilers.</small></details>`,
        )
        .join("") ||
      '<p class="panel-empty">No episodes listed for this season.</p>';
  } catch (e) {
    if (selected?.key === title.key && $("#season-episodes"))
      $("#season-episodes").innerHTML =
        `<p class="panel-empty">${esc(e.message)}</p>`;
  }
}
function entryUpdate(patch, message) {
  if (!selected) return;
  const notes =
    $("#detail-notes")?.value ?? library.entries[selected.key]?.notes ?? "";
  if (persist(saveTitle(library, selected, { notes, ...patch }))) {
    renderDetail();
    renderMain();
    if (message) toast(message);
  }
}
async function openDetail(title) {
  if (selected) flushNotes();
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
    flushNotes();
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
function renderDetail() {
  if (!selected) return;
  const oldScroll = $("#detail-dialog").scrollTop,
    focusId = document.activeElement?.id;
  const t = selected,
    e = library.entries[t.key];
  $("#detail-dialog").innerHTML =
    `<div class="detail-art">${t.backdrop ? `<img class="detail-backdrop" src="${esc(t.backdrop)}" alt=""/>` : ""}<div></div><button class="icon-button close-button" data-action="close-detail" aria-label="Close title details">${icon("close")}</button><span class="detail-source">${t.demo ? "DEMO PREVIEW" : t.source === "jikan" ? (t.provider === "anilist" ? "ANILIST" : "MYANIMELIST · JIKAN") : "TMDB"} / ${labels[t.kind].toUpperCase()}</span></div><div class="detail-body"><div class="detail-header"><div class="detail-poster">${t.poster ? `<img src="${esc(t.poster)}" alt="${esc(t.title)} poster" class="poster"/>` : icon("film")}</div><div><div class="eyebrow">${esc(t.genres.join(" / "))}</div><h2>${esc(t.title)}</h2><div class="detail-meta"><span class="hero-score">${icon("star")} ${t.score ? Number(t.score).toFixed(1) : "Unrated"}</span><span>${t.year || "Release TBA"}</span>${t.runtime ? `<span>${t.runtime} min</span>` : ""}${t.seasons ? `<span>${t.seasons} seasons</span>` : ""}${t.episodes ? `<span>${t.episodes} episodes</span>` : ""}</div><div class="detail-actions"><button class="button primary" data-action="detail-save">${icon(e ? "check" : "plus")}${e ? "Saved to library" : "Add to library"}</button><button class="button ${e?.favorite ? "favorite-button" : "secondary"}" data-action="detail-favorite" aria-pressed="${Boolean(e?.favorite)}">${icon("heart")} ${e?.favorite ? "Favourited" : "Favourite"}</button>${t.demo ? `<button class="button secondary" data-action="live-title">${icon("globe")} Open live details</button>` : ""}${t.trailer ? `<a class="button secondary" href="https://www.youtube.com/watch?v=${esc(t.trailer)}" target="_blank" rel="noopener noreferrer">${icon("play")} Trailer</a>` : ""}</div></div></div>
  ${detailLoading ? '<p class="inline-loading" role="status">Loading title details…</p>' : ""}${detailError ? `<div class="notice warning">${esc(detailError)} Your saved information is still available.</div>` : ""}
  <section class="synopsis"><h3>The story</h3><p>${esc(t.overview)}</p>${t.creator ? `<p class="credits"><span>${t.kind === "movie" ? "Directed by" : "Created by / studio"}</span>${esc(t.creator)}</p>` : ""}${t.cast?.length ? `<p class="credits"><span>Starring</span>${esc(t.cast.join(" · "))}</p>` : ""}</section>
  <section class="personal-panel"><div class="panel-title"><h3>Your corner of the universe</h3><span>PRIVATE · SAVED ON THIS DEVICE</span></div><div class="personal-fields"><label>Watch status<select id="detail-status">${STATUSES.map((s) => `<option value="${s}" ${(e?.status || "planned") === s ? "selected" : ""}>${statusLabels[s]}</option>`).join("")}</select></label><label>Your rating <span class="rating-hint">/ 10</span><select id="detail-rating"><option value="0">Not rated yet</option>${Array.from(
    { length: 20 },
    (_, i) => (i + 1) / 2,
  )
    .map(
      (r) =>
        `<option value="${r}" ${e?.rating === r ? "selected" : ""}>${r.toFixed(1)} ${r >= 8 ? "★" : ""}</option>`,
    )
    .join(
      "",
    )}</select></label>${t.kind !== "movie" ? `<label>Episodes watched<input type="number" id="detail-progress" min="0" ${t.episodes ? `max="${t.episodes}"` : ""} step="1" value="${e?.progress || 0}"/></label>` : ""}</div><div class="folder-picker"><span class="field-label">Add to collections</span><div>${library.folders.map((f) => `<label class="folder-check"><input type="checkbox" data-folder="${esc(f.id)}" ${e?.folders.includes(f.id) ? "checked" : ""}/>${icon("folder")}${esc(f.name)}</label>`).join("")}<button class="folder-new" data-action="new-folder">${icon("plus")} New</button></div></div><label class="notes-label" for="detail-notes">Personal notes</label><textarea id="detail-notes" rows="3" maxlength="5000" placeholder="A scene that stayed with you. A theory. A reason to rewatch…">${esc(e?.notes || "")}</textarea><div class="notes-footer"><span>Ratings and notes are yours alone.</span><button class="button secondary" data-action="save-notes">Save notes ${icon("check")}</button></div></section><div class="detail-footer"><a href="${t.source === "jikan" ? `https://myanimelist.net/anime/${t.id}` : `https://www.themoviedb.org/${t.kind}/${t.id}`}" target="_blank" rel="noopener noreferrer">View on ${t.source === "jikan" ? "MyAnimeList" : "TMDB"} ${icon("arrow")}</a>${e ? `<button class="danger-text" data-action="remove-title">Remove from library</button>` : ""}</div></div>`;
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
  body?.insertAdjacentHTML(
    "beforeend",
    `<div class="watch-detail-actions"><button class="button secondary" data-action="${library.dismissed?.[t.key] ? "restore-title" : "dismiss-title"}" data-key="${esc(t.key)}">${library.dismissed?.[t.key] ? "Restore title" : "Not interested"}</button>${undoState ? '<button class="button secondary" data-action="undo">Undo last action</button>' : ""}</div>`,
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
  d.innerHTML = `<button class="icon-button utility-close" data-action="close-utility" aria-label="Close dialog">${icon("close")}</button>${html}${undoState ? '<button class="button secondary dialog-undo" data-action="undo">Undo last action</button>' : ""}`;
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
    `<div class="eyebrow">MISSION CONTROL</div><h2>Your universe. Your rules.</h2><p>Connect your catalogue and take care of your library.</p><section class="settings-section"><h3>Catalogue connection</h3><div class="connection-row"><span>${icon("globe")} TMDB <small>Movies & TV series</small></span><span class="connection-pill ${config.tmdbConfigured ? "connected" : ""}">${config.tmdbConfigured ? "Connected" : "Key needed"}</span></div><p>Add your <strong>TMDB API Read Access Token</strong> to <code>TMDB_READ_TOKEN</code> in the project’s <code>.env</code> file, then restart the server. The token stays on the server.</p><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" class="text-link">Get a TMDB token ${icon("arrow")}</a><div class="connection-row"><span>${icon("anime")} AniList + Jikan <small>Anime</small></span><span class="connection-pill connected">No key needed</span></div><label class="mode-choice">Catalogue mode<select id="mode-select"><option value="demo" ${mode === "demo" ? "selected" : ""}>Demo — curated preview</option><option value="live" ${mode === "live" ? "selected" : ""}>Live — connected providers</option></select></label><p class="small-print">Without a TMDB token, choose Anime in live mode. Live search uses provider relevance; combined pages may include the same anime from two sources.</p></section><section class="settings-section"><h3>Your library, backed up</h3><p>Favourites, ratings, collections, watch progress and notes are stored in this browser. Export a backup to keep them safe or transfer them to another device.</p><div class="settings-actions"><button class="button secondary" data-action="export">${icon("download")} Export JSON</button><label class="button secondary import-button">${icon("upload")} Import backup<input type="file" id="import-file" accept=".json,application/json"/></label></div>${storageProblem ? `<div class="notice warning">${esc(storageProblem)}</div><button class="danger-text" data-action="recover-storage">Download unreadable data & start a new library</button>` : ""}</section><section class="settings-section credits-section"><h3>Catalogue credits</h3><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"><img class="tmdb-logo" src="/assets/tmdb.svg" alt="The Movie Database"/></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><p>Anime metadata supplied by <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a> with <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer">Jikan</a>, an unofficial MyAnimeList API, as a fallback. Demo scores and episode counts are preview snapshots. Movie World is a discovery and tracking app; it does not stream films or episodes.</p></section>`,
    "Settings and catalogue credits",
  );
}
function download(content, filename) {
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
  if (!button) return;
  const action = button.dataset.action,
    key = button.dataset.key,
    title = titleCache.get(key) || library.entries[key]?.title;
  if (action === "undo") return undoLastAction();
  if (action === "dismiss-title" || action === "restore-title") {
    const t = title || library.dismissed?.[key] || selected;
    if (!t) return;
    flushNotes();
    const dismissed = { ...(library.dismissed || {}) };
    if (action === "dismiss-title") {
      if (!dismissed[t.key] && Object.keys(dismissed).length >= 20000)
        return toast("Your not-interested list is full.");
      dismissed[t.key] = validateTitle(t);
    } else delete dismissed[t.key];
    if (persist({ ...library, dismissed })) {
      renderMain();
      if (selected) renderDetail();
      toast(
        action === "dismiss-title"
          ? "Hidden from discovery and recommendations"
          : "Title restored to discovery",
      );
    }
    return;
  }
  if (action === "tonight") return tonightDialog();
  if (action === "mark-watched") {
    const t = title || selected;
    if (!t || hasWatched(library, t.key)) return;
    if (
      persist(
        saveTitle(library, t, {
          status: "completed",
          watched: true,
          ...(t.episodes ? { progress: t.episodes } : {}),
        }),
      )
    ) {
      renderMain();
      if (selected) renderDetail();
      toast("Marked as watched. Use Log a watch to record a date or rewatch.");
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
      toast(
        queued
          ? "Added to your rewatch list"
          : "Removed from your rewatch list",
      );
    }
    return;
  }
  if (action === "log-watch") return logDialog();
  if (action === "card-save" && title) {
    if (library.entries[key]) return openDetail(title);
    if (persist(saveTitle(library, title))) {
      renderMain();
      if (selected) renderDetail();
      toast("Added to your watchlist");
    }
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
  if (action === "clear-filters") {
    discoveryFilters = { genre: "", year: "", minScore: 0 };
    page = 1;
    return load();
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
  if (action === "next-episode" || action === "quick-episode") {
    const t = action === "next-episode" ? selected : title;
    if (!t) return;
    try {
      let next = library;
      if (!next.entries[t.key]) next = saveTitle(next, t);
      if (persist(logWatch(next, t, { type: "episode" }))) {
        renderMain();
        if (selected) renderDetail();
        toast("Episode logged in your watch diary");
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
      toast("Diary entry removed");
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
    page = page >= 3 ? 1 : page + 1;
    return load();
  }
  if (action === "live-title" && selected) {
    flushNotes();
    try {
      const t = await api(
        `/api/title/${selected.source}/${selected.kind}/${selected.id}?mode=live`,
      );
      if (!selected || selected.key !== t.key) return;
      selected = t;
      titleCache.set(t.key, t);
      if (library.entries[t.key]) persist(saveTitle(library, t));
      renderDetail();
      toast("Live title information refreshed");
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "detail" && title) return openDetail(title);
  if (action === "spotlight") return spotlight();
  if (action === "favorite" && title) {
    if (
      persist(
        saveTitle(library, title, {
          favorite: !library.entries[key]?.favorite,
        }),
      )
    ) {
      renderMain();
      toast(
        library.entries[key].favorite
          ? "Added to favourites"
          : "Removed from favourites",
      );
    }
    return;
  }
  if (action === "watchlist") {
    try {
      const t = title || (await api("/api/title/tmdb/movie/335984?mode=demo"));
      if (library.entries[t.key]) return openDetail(t);
      if (persist(saveTitle(library, t))) {
        renderMain();
        toast("Added to your watchlist");
      }
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "detail-save") {
    if (!library.entries[selected.key])
      entryUpdate({}, "Added to your library");
    else
      toast(
        "Already in your library. Use watch status to track your progress.",
      );
    return;
  }
  if (action === "detail-favorite")
    return entryUpdate(
      { favorite: !library.entries[selected.key]?.favorite },
      "Favourites updated",
    );
  if (action === "save-notes")
    return entryUpdate({ notes: $("#detail-notes").value }, "Notes saved");
  if (action === "remove-title") {
    utility(
      `<h2>Remove this title?</h2><p>This removes its rating, notes, progress and collection memberships from your library.</p><button class="button danger" data-action="confirm-remove">Remove title</button>`,
      "Remove title",
    );
    return;
  }
  if (action === "confirm-remove") {
    if (persist(removeTitle(library, selected.key))) {
      $("#utility-dialog").close();
      renderDetail();
      renderMain();
      toast("Title removed from library");
    }
    return;
  }
  if (action === "close-detail") {
    flushNotes();
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
      toast("Collection deleted");
    }
    return;
  }
  if (action === "export") {
    download(
      JSON.stringify(library, null, 2),
      `movie-world-${new Date().toISOString().slice(0, 10)}.json`,
    );
    toast("Library backup exported");
    return;
  }
  if (action === "toggle-mode") {
    setMode(mode === "demo" ? "live" : "demo");
    return;
  }
  if (action === "retry") return load();
  if (action === "next") {
    page++;
    load();
    $("#main").scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (action === "previous") {
    page = Math.max(1, page - 1);
    load();
    return;
  }
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
        toast("Library restored from backup");
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
  toast(mode === "live" ? "Live catalogue enabled" : "Demo catalogue enabled");
}
document.addEventListener("input", (event) => {
  if (event.target.id === "global-search") {
    query = event.target.value;
    page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 350);
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (el.id === "hide-watched") {
    hideWatched = el.checked;
    try {
      localStorage.setItem("movie-world.hide-watched", String(hideWatched));
    } catch {}
    return renderMain();
  }
  if (
    el.id === "discovery-genre" ||
    el.id === "discovery-year" ||
    el.id === "discovery-score"
  ) {
    const next = {
      genre: $("#discovery-genre")?.value || "",
      year: $("#discovery-year")?.value || "",
      minScore: Number($("#discovery-score")?.value || 0),
    };
    if (
      next.year &&
      (!/^\d{4}$/.test(next.year) ||
        Number(next.year) < 1900 ||
        Number(next.year) > new Date().getFullYear() + 5)
    ) {
      toast("Choose a release year between 1900 and five years from now.");
      el.value = discoveryFilters.year;
      return;
    }
    discoveryFilters = next;
    page = 1;
    return load();
  }
  if (el.dataset.selection) {
    el.checked
      ? selection.add(el.dataset.selection)
      : selection.delete(el.dataset.selection);
    return renderMain();
  }
  if (el.id === "detail-priority")
    return entryUpdate({ priority: el.value }, "Watchlist priority saved");
  if (el.id === "detail-tags")
    return entryUpdate(
      {
        tags: [
          ...new Set(
            el.value
              .split(",")
              .map((s) => s.trim().slice(0, 30))
              .filter(Boolean),
          ),
        ].slice(0, 12),
      },
      "Tags saved",
    );
  if (el.id === "detail-notes") {
    flushNotes();
    return;
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
  if (el.id === "detail-status") entryUpdate({ status: el.value });
  if (el.id === "detail-rating")
    entryUpdate({ rating: Number(el.value) }, "Your rating is saved");
  if (el.id === "detail-progress") {
    const n = Number(el.value);
    if (
      !Number.isInteger(n) ||
      n < 0 ||
      (selected.episodes && n > selected.episodes)
    ) {
      toast("Enter a valid episode count.");
      el.value = library.entries[selected.key]?.progress || 0;
    } else entryUpdate({ progress: n });
  }
  if (el.dataset.folder) {
    const folders = new Set(library.entries[selected.key]?.folders || []);
    el.checked
      ? folders.add(el.dataset.folder)
      : folders.delete(el.dataset.folder);
    entryUpdate({ folders: [...folders] }, "Collection updated");
  }
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
  if (event.target.id === "watch-log-form") {
    event.preventDefault();
    const data = new FormData(event.target),
      title =
        titleCache.get(event.target.dataset.key) ||
        library.entries[event.target.dataset.key]?.title;
    try {
      flushNotes();
      if (
        persist(
          logWatch(library, title, {
            date: data.get("date"),
            rating: Number(data.get("rating")),
            notes: data.get("notes"),
            rewatch: data.has("rewatch"),
          }),
        )
      ) {
        $("#utility-dialog").close();
        if (selected) renderDetail();
        renderMain();
        toast("Watch added to your diary");
      }
    } catch (e) {
      $("#watch-log-error").textContent = e.message;
    }
    return;
  }
  if (event.target.id === "tonight-form") {
    event.preventDefault();
    const data = new FormData(event.target),
      t = pickTonight(library, {
        kind: data.get("kind"),
        genre: data.get("genre"),
        minutes: Number(data.get("minutes")),
      });
    $("#tonight-result").innerHTML = t
      ? `<div class="tonight-pick">${card(t)}<p>Your next story is waiting.</p><button class="button primary" data-action="detail" data-key="${esc(t.key)}">Explore this pick ${icon("arrow")}</button></div>`
      : '<p class="notice warning">No unwatched library titles fit those choices. Save a few titles or relax your filters.</p>';
    bindImages();
    return;
  }
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
      toast("Annual goal updated");
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
      toast("Selected titles updated");
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
      toast(rename ? "Collection updated" : "Collection created");
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
  flushNotes();
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
  undoState = null;
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
shell();
readRoute();
if ("serviceWorker" in navigator)
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
api("/api/config")
  .then((data) => {
    config = data;
  })
  .catch(() =>
    toast(
      "Could not check catalogue connection. Demo titles are still available.",
    ),
  );
