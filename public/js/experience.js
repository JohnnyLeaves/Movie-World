import {
  getStats,
  recommendTitles,
  scheduledTitles,
  today,
} from "./insights.js";
import { GENRES } from "./catalog-filters.js";
export { GENRES };
const monthName = (date) =>
  new Date(`${date}-01T12:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
// "This week" is the rolling window from today through the next six days.
export function weekRange() {
  const start = new Date(`${today()}T12:00:00`),
    end = new Date(start);
  end.setDate(start.getDate() + 6);
  const f = (d) => d.toISOString().slice(0, 10);
  return [f(start), f(end)];
}
const DECADES = [
  ["2020s", 2020, 2029],
  ["2010s", 2010, 2019],
  ["2000s", 2000, 2009],
  ["1990s", 1990, 1999],
  ["Classics", 1900, 1989],
];
const AIRING = [
  ["", "Any"],
  ["new", "New"],
  ["airing", "On TV now"],
  ["ended", "Ended"],
];
// Collapsible filter bar: a toggle with a count, removable chips for what is active, and a panel
// with genre chips, a year range with decade shortcuts, a score slider and (series/anime) airing status.
export function filterBar({ filters, esc, icon, query, route, mode, open, hideWatched = false, explore = false }) {
  const score = Number(filters.minScore) || 0,
    showAiring = mode === "live" && (route === "tv" || route === "anime"),
    years =
      filters.yearFrom || filters.yearTo
        ? filters.yearFrom && filters.yearTo
          ? filters.yearFrom === filters.yearTo
            ? filters.yearFrom
            : `${filters.yearFrom}\u2013${filters.yearTo}`
          : filters.yearFrom
            ? `From ${filters.yearFrom}`
            : `Until ${filters.yearTo}`
        : "",
    active = [
      ...filters.genres.map((g) => ["genre", g, g]),
      ...(years ? [["year", "", years]] : []),
      ...(score ? [["score", "", `${score.toFixed(1)}+ score`]] : []),
      ...(showAiring && filters.airing ? [["airing", "", AIRING.find(([v]) => v === filters.airing)?.[1] || ""]] : []),
    ];
  const isDecade = (from, to) => Number(filters.yearFrom) === from && Number(filters.yearTo) === to;
  const note =
    query && mode === "live"
      ? "Filters refine this search page. Browse without search for catalogue-wide filters."
      : route === "discover" && mode === "live"
        ? "Choose a title type for catalogue-wide filters. All worlds filters refine this feed page."
        : "";
  return `<div class="filters-bar"><div class="filters-top"><button class="filters-toggle ${open ? "open" : ""}" data-action="filters-toggle" aria-expanded="${open}" aria-controls="filters-panel">${icon("sliders")}<span>Filters</span>${active.length ? `<b>${active.length}</b>` : ""}${icon("chevron")}</button>${active.map(([kind, value, label]) => `<button class="fchip" data-action="filter-remove" data-kind="${kind}" data-value="${esc(value)}" aria-label="Remove filter ${esc(label)}">${esc(label)}${icon("close")}</button>`).join("")}${active.length ? '<button class="filters-reset" data-action="clear-filters">Reset all</button>' : ""}</div>${explore ? `<label class="hide-watched"><input type="checkbox" id="hide-watched" ${hideWatched ? "checked" : ""}/><i class="tick" aria-hidden="true"></i><span>Hide titles I have watched</span></label>` : ""}<div id="filters-panel" class="filters-panel ${open ? "open" : ""}"><div class="filters-inner"><div class="filters-grid"><section class="fsec wide"><span class="flabel">Genres <small>pick up to four</small></span><div class="chip-row">${GENRES.map((g) => `<button class="gchip ${filters.genres.includes(g) ? "on" : ""}" data-action="filter-genre" data-genre="${esc(g)}" aria-pressed="${filters.genres.includes(g)}">${esc(g)}</button>`).join("")}</div></section><section class="fsec"><span class="flabel">Release year</span><div class="year-row"><input id="filter-year-from" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear() + 5}" value="${esc(filters.yearFrom)}" placeholder="From" aria-label="From year"/><i>\u2013</i><input id="filter-year-to" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear() + 5}" value="${esc(filters.yearTo)}" placeholder="To" aria-label="To year"/></div><div class="chip-row">${DECADES.map(([l, from, to]) => `<button class="gchip small ${isDecade(from, to) ? "on" : ""}" data-action="filter-decade" data-from="${from}" data-to="${to}" aria-pressed="${isDecade(from, to)}">${l}</button>`).join("")}</div></section><section class="fsec"><span class="flabel">Minimum score <output id="filter-score-out">${score ? `${score.toFixed(1)}+` : "Any"}</output></span><input id="filter-score" class="score-range" type="range" min="0" max="9" step="0.5" value="${score}" style="--p:${(score / 9) * 100}%" aria-label="Minimum score"/><div class="range-ticks"><span>Any</span><span>5</span><span>7</span><span>9+</span></div></section>${showAiring ? `<section class="fsec"><span class="flabel">Airing</span><div class="chip-row">${AIRING.map(([v, l]) => `<button class="gchip small ${filters.airing === v ? "on" : ""}" data-action="filter-airing" data-value="${v}" aria-pressed="${filters.airing === v}">${l}</button>`).join("")}</div></section>` : ""}</div>${note ? `<p class="filter-note">${note}</p>` : ""}</div></div></div>`;
}
export function renderExperience({
  route,
  library,
  esc,
  icon,
  card,
  candidates = [],
  forYou = null,
  tab = "all",
  month = today().slice(0, 7),
  query = "",
  offset = 0,
}) {
  const stats = getStats(library),
    entries = Object.values(library.entries);
  const head = (kicker, title, description, action = "") =>
    `<div class="section-heading"><div><div class="eyebrow section-eyebrow">${kicker}</div><h1 class="page-title">${title}</h1><p>${description}</p></div>${action}</div>`;
  const empty = (title, desc) =>
    `<div class="empty-state">${icon("compass")}<h3>${title}</h3><p>${desc}</p><a href="#discover" class="button primary">Discover your next story ${icon("arrow")}</a></div>`;
  const diaryRows = (logs) =>
    logs
      .map(
        (log) =>
          `<article class="diary-row"><div class="diary-date"><b>${log.date.slice(8)}</b><span>${new Date(log.date + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}</span></div><div><button class="diary-title" data-action="diary-title" data-key="${esc(log.key)}">${esc(log.title)}</button><div class="diary-meta">${log.type === "episode" ? "Episode watched" : log.rewatch ? "Rewatched" : "Finished"} <span>&middot;</span> ${log.kind === "tv" ? "Series" : log.kind === "anime" ? "Anime" : "Movie"}${log.minutes ? ` <span>&middot;</span> ${log.minutes} min` : ""}${log.rating ? ` <span class="diary-rating">${icon("star")} ${log.rating}/10</span>` : ""}</div>${log.notes ? `<p class="diary-note">${esc(log.notes)}</p>` : ""}</div><button class="icon-button" data-action="delete-log" data-id="${esc(log.id)}" aria-label="Delete diary entry for ${esc(log.title)}">${icon("trash")}</button></article>`,
      )
      .join("");
  let content = "";
  if (route === "dashboard") {
    const watching = entries.filter((e) => e.status === "watching").slice(0, 4),
      pct = Math.min(100, Math.round((stats.yearly / stats.goal) * 100));
    content =
      head(
        "YOUR PERSONAL OBSERVATORY",
        "Your screen life, in focus.",
        "Every discovery, late-night episode and unforgettable ending. This is your universe.",
        `<button class="button primary" data-action="tonight">${icon("play")} What should I watch?</button>`,
      ) +
      `<div class="dashboard-metrics">${[
        [stats.total, "Titles saved", "library"],
        [stats.completed, "Completed", "check"],
        [
          stats.average ? stats.average.toFixed(1) : "--",
          `Average rating / ${stats.rated} rated`,
          "star",
        ],
        [stats.hours, "Estimated hours logged", "clock"],
      ]
        .map(
          ([n, l, i]) =>
            `<div class="metric-card"><span>${icon(i)} ${l}</span><strong>${n}</strong></div>`,
        )
        .join("")}</div>
    <div class="dashboard-split"><section class="feature-panel yearly-panel"><div><div class="eyebrow">THE ${new Date().getFullYear()} CHALLENGE</div><h2>Make time for great stories.</h2><p>${stats.yearly} finished-title diary entries toward your goal of ${stats.goal}.</p><button class="text-link" data-action="edit-goal">Edit your annual goal ${icon("edit")}</button></div><div class="goal-ring" style="--progress:${pct}%"><strong>${pct}%</strong><small>${stats.yearly} / ${stats.goal}</small></div></section><section class="feature-panel"><div class="panel-heading"><h3>Your viewing rhythm</h3><span>${new Date().getFullYear()} &middot; diary entries</span></div><div class="activity-chart" role="img" aria-label="Monthly watch diary activity">${stats.months.map((m, i) => `<div title="${m.month}: ${m.count} watch entries"><span class="activity-value">${m.count || ""}</span><i style="height:${Math.max(3, (m.count / Math.max(1, ...stats.months.map((r) => r.count))) * 90)}px"></i><small>${"JFMAMJJASOND"[i]}</small></div>`).join("")}</div></section></div>
    <div class="dashboard-split"><section class="feature-panel"><div class="panel-heading"><h3>Continue your journey</h3><a href="#library">Your library ${icon("arrow")}</a></div>${watching.length ? watching.map((e) => `<div class="continue-row"><img src="${esc(e.title.poster)}" alt="" loading="lazy"/><div><button data-action="detail" data-key="${esc(e.title.key)}">${esc(e.title.title)}</button><span>${e.progress || 0}${e.title.episodes ? ` / ${e.title.episodes}` : ""} episodes watched</span><div class="progress-track"><i style="width:${e.title.episodes ? Math.min(100, ((e.progress || 0) / e.title.episodes) * 100) : 0}%"></i></div></div><button class="icon-button bordered" data-action="quick-episode" data-key="${esc(e.title.key)}" aria-label="Log next episode of ${esc(e.title.title)}">${icon("plus")}</button></div>`).join("") : '<p class="panel-empty">Mark a series or anime as Watching to continue it here.</p>'}</section><section class="feature-panel"><div class="panel-heading"><h3>Your taste, mapped</h3><span>Genres in your library</span></div><div class="genre-bars">${stats.genres.length ? stats.genres.map(([g, n]) => `<div><span>${esc(g)}</span><div><i style="width:${(n / stats.total) * 100}%"></i></div><b>${n}</b></div>`).join("") : '<p class="panel-empty">Save a few titles and your genre profile will appear here.</p>'}</div></section></div>
    <section class="feature-panel"><div class="panel-heading"><h3>Recently watched</h3><a href="#diary">Open diary ${icon("arrow")}</a></div>${stats.recent.length ? diaryRows(stats.recent) : '<p class="panel-empty">Use Log a watch on a title page to start your private film diary.</p>'}</section>`;
  } else if (route === "diary") {
    const logs = [...(library.diary || [])]
      .filter((l) => l.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
    content =
      head(
        "THE STORIES YOU LIVED",
        "Your watch diary.",
        "A private record of first watches, rewatches and one-more-episode nights.",
        `<span class="diary-total">${logs.length} logged sessions</span>`,
      ) +
      (logs.length
        ? `<section class="feature-panel">${diaryRows(logs)}</section>`
        : empty(
            "Your next watch is the first entry.",
            "Open any saved title and log a watch. Add a date, rating and the thought you want to keep.",
          ));
  } else if (route === "collections") {
    content =
      head(
        "ORDER YOUR MULTIVERSE",
        "Collections with character.",
        "Build a shelf for every mood, obsession and carefully planned movie night.",
        `<button class="button primary" data-action="new-folder">${icon("plus")} Create collection</button>`,
      ) +
      `<div class="collection-gallery">${library.folders
        .filter((f) =>
          `${f.name} ${f.notes || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((folder, i) => {
          const items = entries.filter((e) => e.folders.includes(folder.id));
          return `<a class="collection-tile collection-tint-${i % 4}" href="#folder/${esc(folder.id)}"><div class="collection-art">${
            items
              .slice(0, 4)
              .map(
                (e) =>
                  `<img src="${esc(e.title.poster)}" alt="" loading="lazy"/>`,
              )
              .join("") || `<span>${icon("folder")}</span>`
          }</div><div><h2>${esc(folder.name)}</h2>${folder.notes ? `<p class="collection-notes">${esc(folder.notes)}</p>` : ""}<span>${items.length} titles &middot; ${items.filter((e) => e.status === "completed").length} completed</span>${icon("arrow")}</div></a>`;
        })
        .join(
          "",
        )}<button class="collection-tile collection-add" data-action="new-folder">${icon("plus")}<strong>Start a new world</strong><span>A collection is a little universe of its own.</span></button></div>`;
  } else if (route === "calendar") {
    const date = new Date(month + "-01T12:00:00"),
      offset = (date.getDay() + 6) % 7,
      days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      events = scheduledTitles(library, month),
      logs = (library.diary || []).filter((l) => l.date.startsWith(month));
    content =
      head(
        "YOUR SCREEN CALENDAR",
        "Stories on the horizon.",
        "New episodes, upcoming releases and what you have watched, all in one place.",
      ) +
      `<section class="feature-panel"><div class="calendar-heading"><button class="icon-button" data-action="calendar-prev" aria-label="Previous month">${icon("chevron", "reverse")}</button><h2>${monthName(month)}</h2><button class="icon-button" data-action="calendar-next" aria-label="Next month">${icon("chevron")}</button></div><div class="calendar-legend"><span>Coming up</span><span>Watched</span></div><div class="calendar-grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<b>${d}</b>`).join("")}${Array.from({ length: offset }, () => '<div class="calendar-blank"></div>').join("")}${Array.from(
        { length: days },
        (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`,
            ev = events.filter((e) => e.date === day),
            watched = logs.filter((e) => e.date === day);
          return `<div class="calendar-day ${day === today() ? "is-today" : ""} ${ev.length > 1 ? "multi" : ""}"><strong>${i + 1}</strong>${ev
            .slice(0, 2)
            .map(
              (e) =>
                `<button title="${esc(e.title.title)}" data-action="detail" data-key="${esc(e.title.key)}"${e.title.poster ? ` style="--poster:url('${esc(e.title.poster)}')"` : ""}><span>${esc(e.title.title)}</span></button>`,
            )
            .join(
              "",
            )}${ev.length > 2 ? `<em title="${ev.slice(2).map((e) => esc(e.title.title)).join(", ")}">+${ev.length - 2} more</em>` : ""}${watched.length ? `<span title="${watched.map((l) => esc(l.title)).join(", ")}">${watched.length > 1 ? `${watched.length} watched` : "Watched"}</span>` : ""}</div>`;
        },
      ).join(
        "",
      )}</div><p class="small-print">Release and next-episode dates come from saved live title metadata. Open a live title to refresh it. No release dates are invented for demo titles.</p></section>`;
  } else if (route === "interested") {
    const [from, to] = weekRange(),
      list = Object.values(library.interested || {}),
      dated = (t) => /^\d{4}-\d{2}-\d{2}$/.test(t.releaseDate || ""),
      byDate = (a, b) => a.releaseDate.localeCompare(b.releaseDate),
      groups = [
        ["Releasing this week", list.filter((t) => dated(t) && t.releaseDate >= from && t.releaseDate <= to).sort(byDate)],
        ["Coming later", list.filter((t) => dated(t) && t.releaseDate > to).sort(byDate)],
        ["Date to be announced", list.filter((t) => !dated(t))],
        ["Already out", list.filter((t) => dated(t) && t.releaseDate < from).sort((a, b) => byDate(b, a))],
      ].filter(([, items]) => items.length);
    content =
      head(
        "YOUR RELEASE RADAR",
        "Never miss a premiere.",
        "Upcoming titles you follow, with this week's releases first. Tap the bell on any title in Upcoming to add it here.",
        '<a class="button secondary" href="#upcoming">' + icon("spark") + " Browse upcoming</a>",
      ) +
      (groups.length
        ? groups
            .map(
              ([label, items]) =>
                `<section class="radar-group"><h3 class="radar-label">${label}<span>${items.length}</span></h3><div class="title-grid">${items.map((t) => card(t, true)).join("")}</div></section>`,
            )
            .join("")
        : `<div class="empty-state">${icon("bell")}<h3>Nothing on your radar yet.</h3><p>Open Upcoming and tap the bell on the movies, series and anime you are waiting for.</p><a href="#upcoming" class="button primary">Browse upcoming ${icon("arrow")}</a></div>`);
  } else if (route === "recommendations") {
    if (forYou) {
      const sections = [
        ["Movies", "movie"],
        ["Series", "tv"],
        ["Anime", "anime"],
      ].filter(([, k]) => forYou[k]?.length && (tab === "all" || tab === k));
      const tabs = `<nav class="type-tabs segmented" aria-label="Suggestion type">${[
        ["all", "All", "recommendations"],
        ["movie", "Movies", "recommendations/movie"],
        ["tv", "TV series", "recommendations/tv"],
        ["anime", "Anime", "recommendations/anime"],
      ]
        .map(([k, l, h]) => `<a class="${tab === k ? "selected" : ""}" href="#${h}">${l}${k === "anime" ? "<span>\u30a2\u30cb\u30e1</span>" : ""}</a>`)
        .join("")}</nav>`;
      const chips = (label, names) =>
        names.length
          ? `<div class="taste-chips"><b>${label}</b>${names.map((n) => `<span>${esc(n)}</span>`).join("")}</div>`
          : "";
      content =
        head(
          "CURATED BY YOUR TASTE",
          "A little more you.",
          "Built from what you watched, rated and favourited. Movies and series are matched on TMDB keywords, anime on AniList tags.",
          `<button class="button secondary" data-action="refresh-recommendations">${icon("compass")} Show different picks</button>`,
        ) +
        tabs +
        (forYou.taste.tmdb.length || forYou.taste.anime.length
          ? (tab === "anime" ? "" : chips("Movies & series", forYou.taste.tmdb)) + (tab === "movie" || tab === "tv" ? "" : chips("Anime", forYou.taste.anime))
          : '<div class="taste-chips"><span>Rate or favourite a few titles to tune these picks</span></div>') +
        (sections.length
          ? sections
              .map(
                ([label, k]) => {
                  const list = forYou[k],
                    count = tab === "all" ? 4 : 12,
                    from = offset % Math.max(count, list.length),
                    shown = list.slice(from, from + count).concat(from + count > list.length ? list.slice(0, from + count - list.length) : []).slice(0, count);
                  return `<section class="radar-group"><h3 class="radar-label">${label}<span>${shown.length}</span></h3><div class="title-grid recommendation-grid">${shown.map((p) => `<div>${card(p.title)}<p class="recommendation-reason">${icon("star")} ${esc(p.reason)}</p></div>`).join("")}</div></section>`;
                },
              )
              .join("")
          : empty("Nothing to suggest yet.", "Rate or favourite a few titles you love and check back."));
    } else {
    const picks = recommendTitles(library, candidates, 24).slice(
        offset,
        offset + 12,
      );
      content =
        head(
          "CURATED BY YOUR TASTE",
          "A little more you.",
          "Your watched history, ratings, favourites and rewatches shape these picks. Low ratings reduce similar suggestions.",
          `<button class="button secondary" data-action="refresh-recommendations">${icon("compass")} Refresh discovery</button>`,
        ) +
        `<div class="taste-chips">${
          stats.genres
            .slice(0, 5)
            .map(([g]) => `<span>${esc(g)}</span>`)
            .join("") ||
          "<span>Rate or favourite a few titles to personalise these picks</span>"
        }</div>` +
        (picks.length
          ? `<div class="title-grid recommendation-grid">${picks.map((p) => `<div>${card(p.title)}<p class="recommendation-reason">${icon("star")} ${esc(p.reason)}</p></div>`).join("")}</div>`
          : empty(
              "More discoveries are on their way.",
              "Try refreshing the catalogue, or switch to live mode for a larger pool of suggestions.",
            ));
    }
  }
  return `<section class="catalog-section experience-page">${content}</section>`;
}
export function detailExtras({
  title,
  entry,
  esc,
  icon,
  card,
  region = "PT",
  watched = false,
}) {
  return `${
    title.kind === "tv"
      ? `<section class="feature-panel seasons-section"><div class="panel-heading"><h3>Seasons & episodes</h3>${
          title.seasonList?.length
            ? `<label class="sr-only" for="season-select">Season</label><select id="season-select">${title.seasonList
                .filter((s) => s.number > 0)
                .map(
                  (s) =>
                    `<option value="${s.number}">${esc(s.name)} (${s.episodes})</option>`,
                )
                .join("")}</select>`
            : ""
        }</div><div id="season-episodes"><p class="panel-empty">${title.demo ? "Season-level episode information is available with a live TMDB connection." : "Choose a season to explore episode names, air dates and spoiler-protected summaries."}</p></div></section>`
      : ""
  }
  ${title.recommendations?.length ? `<section class="related-section"><div class="panel-heading"><h3>More from this universe</h3><span>${title.demo ? "Genre matches in the demo catalogue" : "Provider recommendations"}</span></div><div class="related-grid">${title.recommendations.slice(0, 6).map(card).join("")}</div></section>` : ""}`;
}
