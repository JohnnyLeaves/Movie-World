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
} from "./library.js";

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
const titleCache = new Map();
const isPersonal = () => ["library", "favorites", "folder"].includes(route);
const kind = () => (["movie", "tv", "anime"].includes(route) ? route : "all");
function toast(text) {
  $("#toast").textContent = text;
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
    `<div class="nav-label">EXPLORE</div><nav aria-label="Explore">${nav("discover", "Discover", "compass")}${nav("movie", "Movies", "film")}${nav("tv", "TV series", "tv")}${nav("anime", "Anime", "anime")}</nav><div class="nav-label">YOUR LIBRARY</div><nav aria-label="Your library">${nav("library", "All titles", "library", entries.length)}${nav("favorites", "Favourites", "heart", favorites)}</nav><div class="nav-label collection-label">COLLECTIONS<button data-action="new-folder" class="icon-button" aria-label="Create collection">${icon("plus")}</button></div><nav aria-label="Collections">${library.folders.map((f, i) => `<a href="#folder/${esc(f.id)}" class="nav-link folder-link ${route === "folder" && folderId === f.id ? "active" : ""}" ${route === "folder" && folderId === f.id ? 'aria-current="page"' : ""}><span class="folder-color color-${i % 4}">${icon("folder")}</span><span>${esc(f.name)}</span><span class="nav-count">${entries.filter((e) => e.folders.includes(f.id)).length}</span></a>`).join("")}</nav><button class="create-collection" data-action="new-folder">${icon("plus")} New collection</button><div class="sidebar-note"><span class="tiny-orbit">✦</span><p>Good stories deserve<br/>a place of their own.</p></div>`;
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
        }[route];
  load();
}
async function load() {
  controller?.abort();
  if (isPersonal()) {
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
      `/api/catalog?${new URLSearchParams({ kind: kind(), query, sort, page: String(page), mode })}`,
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
  const personal = isPersonal(),
    folder = library.folders.find((f) => f.id === folderId);
  const titles = personal
    ? filterEntries(library, {
        view: route,
        folder: route === "folder" ? folderId : "",
        query,
        kind: libraryKind,
        status: libraryStatus,
        sort,
      }).map((e) => e.title)
    : catalogData?.results || [];
  const discover = route === "discover" && !query && page === 1;
  const heading = personal
    ? route === "folder"
      ? folder?.name || "Collection not found"
      : route === "favorites"
        ? "Your favourites."
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
    `${discover ? renderHero() : ""}<section class="catalog-section"><div class="section-heading"><div><div class="eyebrow section-eyebrow">${personal ? "PERSONAL COLLECTION" : "THE DISCOVERY FEED"}</div><h2>${esc(heading)}</h2><p>${personal ? "Every world you’ve entered. Every story still waiting." : mode === "demo" ? "A curated preview of movies, series and anime. Your universe starts here." : route === "discover" ? "Movies, series and anime from TMDB and AniList." : "Explore the live catalogue. Find something worth your time."}</p></div>${personal ? `<div class="heading-actions">${route === "folder" && folder ? `<button class="icon-button bordered" data-action="rename-folder" aria-label="Rename collection">${icon("edit")}</button><button class="icon-button bordered" data-action="delete-folder" aria-label="Delete collection">${icon("trash")}</button>` : ""}<button class="button secondary" data-action="export">${icon("download")} Export library</button></div>` : `<span class="feed-label">${icon("globe")} ${mode === "demo" ? "EDITOR’S SELECTION" : "LIVE DISCOVERY"}</span>`}</div>
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
  ${catalogData?.warning ? `<div class="notice warning">${esc(catalogData.warning)}</div>` : ""}
  ${error ? `<div class="empty-state error-state">${icon("globe")}<h3>Connection interrupted</h3><p>${esc(error)}</p><div><button class="button primary" data-action="retry">Try again</button><button class="button secondary" data-action="toggle-mode">${mode === "live" ? "Explore demo" : "Use live catalogue"}</button></div></div>` : loading ? `<div class="title-grid skeleton-grid" aria-label="Loading titles" aria-busy="true">${Array.from({ length: 6 }, () => '<div class="skeleton-card"><div></div><span></span><small></small></div>').join("")}</div>` : titles.length ? `<div class="title-grid">${titles.map(card).join("")}</div>` : `<div class="empty-state">${icon(personal ? "library" : "search")}<span class="eyebrow">THE NEXT CHAPTER IS YOURS</span><h3>${personal ? "Make this space your own." : "No titles found."}</h3><p>${personal ? (query || libraryStatus !== "all" || libraryKind !== "all" ? "Try changing your filters or search." : "Save a title, tap a heart, or add something to a collection. Your story starts with a discovery.") : "Try a different title or switch content type."}</p><a href="#discover" class="button primary">Explore titles ${icon("arrow")}</a></div>`}
  ${!personal && catalogData && catalogData.totalPages > 1 ? `<div class="pagination"><button class="button secondary" data-action="previous" ${page === 1 ? "disabled" : ""}>Previous</button><span>Page ${page} of ${catalogData.totalPages}${route === "discover" && mode === "live" ? " · Combined provider pages" : ""}</span><button class="button secondary" data-action="next" ${page >= catalogData.totalPages ? "disabled" : ""}>Next page ${icon("arrow")}</button></div>` : ""}
  <div class="library-stats" id="library-stats"></div></section>`;
  renderStats();
  bindImages();
}
function bindImages() {
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
  selected = title;
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
  const t = selected,
    e = library.entries[t.key];
  $("#detail-dialog").innerHTML =
    `<div class="detail-art">${t.backdrop ? `<img class="detail-backdrop" src="${esc(t.backdrop)}" alt=""/>` : ""}<div></div><button class="icon-button close-button" data-action="close-detail" aria-label="Close title details">${icon("close")}</button><span class="detail-source">${t.demo ? "DEMO PREVIEW" : t.source === "jikan" ? (t.provider === "anilist" ? "ANILIST" : "MYANIMELIST · JIKAN") : "TMDB"} / ${labels[t.kind].toUpperCase()}</span></div><div class="detail-body"><div class="detail-header"><div class="detail-poster">${t.poster ? `<img src="${esc(t.poster)}" alt="${esc(t.title)} poster" class="poster"/>` : icon("film")}</div><div><div class="eyebrow">${esc(t.genres.join(" / "))}</div><h2>${esc(t.title)}</h2><div class="detail-meta"><span class="hero-score">${icon("star")} ${t.score ? Number(t.score).toFixed(1) : "Unrated"}</span><span>${t.year || "Release TBA"}</span>${t.runtime ? `<span>${t.runtime} min</span>` : ""}${t.seasons ? `<span>${t.seasons} seasons</span>` : ""}${t.episodes ? `<span>${t.episodes} episodes</span>` : ""}</div><div class="detail-actions"><button class="button primary" data-action="detail-save">${icon(e ? "check" : "plus")}${e ? "Saved to library" : "Add to library"}</button><button class="button ${e?.favorite ? "favorite-button" : "secondary"}" data-action="detail-favorite" aria-pressed="${Boolean(e?.favorite)}">${icon("heart")} ${e?.favorite ? "Favourited" : "Favourite"}</button>${t.trailer ? `<a class="button secondary" href="https://www.youtube.com/watch?v=${esc(t.trailer)}" target="_blank" rel="noopener noreferrer">${icon("play")} Trailer</a>` : ""}</div></div></div>
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
    `<div class="eyebrow">A HOME FOR YOUR STORIES</div><h2>${rename ? "Rename collection" : "Create a collection"}</h2><p>Group your titles by mood, genre, or whatever makes sense to you.</p><form id="folder-form" data-rename="${rename ? "true" : "false"}"><label for="folder-name">Collection name</label><input id="folder-name" name="name" required maxlength="60" placeholder="e.g. Neon nights" value="${rename ? esc(folder?.name) : ""}"/><p id="folder-error" class="form-error" role="alert"></p><button class="button primary" type="submit">${icon("folder")} ${rename ? "Save name" : "Create collection"}</button></form>`,
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
  if (event.target.id !== "folder-form") return;
  event.preventDefault();
  try {
    const rename = event.target.dataset.rename === "true",
      name = $("#folder-name").value;
    const next = rename
      ? renameFolder(library, folderId, name)
      : addFolder(library, name);
    if (persist(next)) {
      $("#utility-dialog").close();
      if (selected && $("#detail-dialog").open) renderDetail();
      renderMain();
      if (rename) $("#breadcrumb").textContent = name.trim();
      toast(rename ? "Collection renamed" : "Collection created");
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
api("/api/config")
  .then((data) => {
    config = data;
  })
  .catch(() =>
    toast(
      "Could not check catalogue connection. Demo titles are still available.",
    ),
  );
