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
export function filterBar({ filters, esc, query, route, mode }) {
  const active = filters.genre || filters.year || Number(filters.minScore);
  return `<div class="discovery-filters"><label>Genre<select id="discovery-genre"><option value="">Every genre</option>${GENRES.map((g) => `<option ${filters.genre === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></label><label>Release year<input id="discovery-year" type="number" min="1900" max="${new Date().getFullYear() + 5}" value="${esc(filters.year)}" placeholder="Any year"/></label><label>Minimum score<select id="discovery-score">${[
    [0, "Any score"],
    [6, "6+ / Good"],
    [7, "7+ / Great"],
    [8, "8+ / Exceptional"],
    [9, "9+ / Essential"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${Number(filters.minScore) === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><button class="button secondary" data-action="clear-filters" ${active ? "" : "disabled"}>Reset filters</button><span class="filter-note">${query && mode === "live" ? "Filters refine this search page. Browse without search for catalogue-wide filters." : route === "discover" && mode === "live" ? "Choose a title type for catalogue-wide filters. All worlds filters refine this feed page." : "A smaller universe. A better discovery."}</span></div>`;
}
export function renderExperience({
  route,
  library,
  esc,
  icon,
  card,
  candidates = [],
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
        .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
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
          }</div><div><h2>${esc(folder.name)}</h2><span>${items.length} titles &middot; ${items.filter((e) => e.status === "completed").length} completed</span>${icon("arrow")}</div></a>`;
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
        "Saved-title release dates, next episodes and your watch diary in one place.",
      ) +
      `<section class="feature-panel"><div class="calendar-heading"><button class="icon-button" data-action="calendar-prev" aria-label="Previous month">${icon("chevron", "reverse")}</button><h2>${monthName(month)}</h2><button class="icon-button" data-action="calendar-next" aria-label="Next month">${icon("chevron")}</button></div><div class="calendar-legend"><span>Upcoming release / episode</span><span>Logged watch</span></div><div class="calendar-grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<b>${d}</b>`).join("")}${Array.from({ length: offset }, () => '<div class="calendar-blank"></div>').join("")}${Array.from(
        { length: days },
        (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`,
            ev = events.filter((e) => e.date === day),
            watched = logs.filter((e) => e.date === day);
          return `<div class="calendar-day ${day === today() ? "is-today" : ""}"><strong>${i + 1}</strong>${ev
            .slice(0, 2)
            .map(
              (e) =>
                `<button title="${esc(e.title.title)}" data-action="detail" data-key="${esc(e.title.key)}">${esc(e.title.title)}</button>`,
            )
            .join(
              "",
            )}${watched.length ? `<span title="${watched.map((l) => esc(l.title)).join(", ")}">${watched.length} watch${watched.length > 1 ? "es" : ""}</span>` : ""}</div>`;
        },
      ).join(
        "",
      )}</div><p class="small-print">Release and next-episode dates come from saved live title metadata. Open a live title to refresh it. No release dates are invented for demo titles.</p></section>`;
  } else if (route === "recommendations") {
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
  return `<section class="catalog-section experience-page">${content}</section>`;
}
export function detailExtras({ title, entry, esc, icon, card, region = "PT",watched=false }) {
  return `<section class="detail-tools"><div class="watch-detail-actions"><button class="button ${watched?"secondary":"primary"}" data-action="mark-watched" ${watched?"disabled":""}>${icon("check")} ${watched?"Watched":"Mark as watched"}</button>${watched?`<button class="button secondary" data-action="queue-rewatch" aria-pressed="${Boolean(entry?.rewatchQueued)}">${icon("clock")} ${entry?.rewatchQueued?"Remove from rewatch list":"Want to rewatch"}</button>`:""}</div><div class="panel-heading"><h3>Make it yours</h3><button class="button primary" data-action="log-watch">${icon("check")} Log a watch</button></div><div class="personal-fields"><label>Watchlist priority<select id="detail-priority">${["low", "normal", "high"].map((v) => `<option value="${v}" ${(entry?.priority || "normal") === v ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select></label><label>Personal tags<input id="detail-tags" maxlength="250" value="${esc(entry?.tags?.join(", ") || "")}" placeholder="comfort watch, mind-bending"/></label></div>${title.kind !== "movie" ? `<div class="episode-controls"><span>${entry?.progress || 0}${title.episodes ? ` / ${title.episodes}` : ""} episodes watched</span><button class="button secondary" data-action="next-episode">${icon("plus")} Log next episode</button></div>` : ""}</section>
  ${
    title.source === "tmdb"
      ? `<section class="feature-panel availability-section"><div class="panel-heading"><h3>Where to watch</h3><label class="sr-only" for="watch-region">Streaming region</label><select id="watch-region">${[
          ["PT", "Portugal"],
          ["US", "United States"],
          ["GB", "United Kingdom"],
          ["ES", "Spain"],
          ["FR", "France"],
          ["DE", "Germany"],
          ["JP", "Japan"],
          ["BR", "Brazil"],
        ]
          .map(
            ([v, l]) =>
              `<option value="${v}" ${v === region ? "selected" : ""}>${l}</option>`,
          )
          .join(
            "",
          )}</select></div><div id="watch-availability"><p class="panel-empty">${title.demo ? "Connect TMDB and open this title in live mode for regional streaming, rental and purchase options." : "Loading regional availability..."}</p></div><p class="small-print">Availability data: <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a> via TMDB. Availability may change; confirm with the provider.</p></section>`
      : ""
  }
  ${
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
  ${title.nextAirDate ? `<div class="next-airing">${icon("clock")} Next episode: ${esc(title.nextAirDate)}${title.nextEpisode ? ` &middot; ${esc(title.nextEpisode)}` : ""}</div>` : ""}
  ${title.recommendations?.length ? `<section class="related-section"><div class="panel-heading"><h3>More from this universe</h3><span>${title.demo ? "Genre matches in the demo catalogue" : "Provider recommendations"}</span></div><div class="related-grid">${title.recommendations.slice(0, 6).map(card).join("")}</div></section>` : ""}`;
}
