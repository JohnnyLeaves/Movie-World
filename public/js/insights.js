// Pure personal-library features. No network calls or browser storage in this module.
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function normalizeLog(log) {
  if (
    !log ||
    typeof log.id !== "string" ||
    !/^[\w-]{1,100}$/.test(log.id) ||
    !validDate(log.date) ||
    !["finish", "episode"].includes(log.type) ||
    typeof log.key !== "string" ||
    !/^(tmdb:(movie|tv)|jikan:anime):\d+$/.test(log.key) ||
    typeof log.title !== "string"
  )
    throw new Error("Invalid watch diary in backup.");
  const rating = Number(log.rating || 0),
    minutes = Number(log.minutes || 0);
  if (
    !Number.isFinite(rating) ||
    rating < 0 ||
    rating > 10 ||
    !Number.isInteger(rating * 2) ||
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 1000000
  )
    throw new Error("Invalid watch diary values.");
  return {
    id: log.id,
    key: log.key,
    title: log.title.slice(0, 500),
    kind: ["movie", "tv", "anime"].includes(log.kind) ? log.kind : "movie",
    date: log.date,
    type: log.type,
    rating,
    minutes: Math.round(minutes),
    rewatch: Boolean(log.rewatch),
    completed: Boolean(log.completed),
    notes: String(log.notes || "").slice(0, 2000),
  };
}
export function logWatch(
  library,
  title,
  {
    date = today(),
    type = "finish",
    rating = 0,
    notes = "",
    rewatch = false,
    id = crypto.randomUUID(),
  } = {},
) {
  if ((library.diary || []).length >= 100000)
    throw new Error(
      "Your diary has reached its 100,000-entry limit. Export a backup before starting a new diary.",
    );
  if (!validDate(date) || date > today())
    throw new Error("Choose a valid watch date that is not in the future.");
  const entry = library.entries[title.key];
  if (!entry) throw new Error("Save this title to your library first.");
  if (type === "episode" && title.kind === "movie")
    throw new Error("Movies do not have episode progress.");
  const total = Number(title.episodes) || null,
    progress = entry.progress || 0;
  if (type === "episode" && total && progress >= total)
    throw new Error(
      "All known episodes are already watched. Reset progress for a rewatch.",
    );
  const completed =
    type === "finish" || Boolean(total && progress + 1 >= total);
  const nextProgress = type === "episode" ? progress + 1 : total || progress;
  const units =
    type === "episode"
      ? 1
      : title.kind === "movie"
        ? 1
        : rewatch
          ? total || 1
          : Math.max(0, (total || 1) - progress);
  const log = normalizeLog({
    id,
    key: title.key,
    title: title.title,
    kind: title.kind,
    date,
    type,
    rating,
    notes,
    rewatch,
    completed,
    minutes: (title.runtime || 0) * units,
  });
  return {
    ...library,
    diary: [...(library.diary || []), log],
    entries: {
      ...library.entries,
      [title.key]: {
        ...entry,
        status: completed ? "completed" : "watching",
        watched: completed || entry.watched || entry.status === "completed",
        rewatchQueued: completed ? false : entry.rewatchQueued,
        progress: nextProgress,
        rating: rating || entry.rating,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
export function getStats(library, year = new Date().getFullYear()) {
  const entries = Object.values(library.entries),
    rated = entries.filter((e) => e.rating > 0),
    logs = library.diary || [];
  const genres = new Map(),
    kinds = { movie: 0, tv: 0, anime: 0 },
    statuses = {};
  for (const e of entries) {
    kinds[e.title.kind]++;
    statuses[e.status] = (statuses[e.status] || 0) + 1;
    for (const g of e.title.genres) genres.set(g, (genres.get(g) || 0) + 1);
  }
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    count: 0,
  }));
  for (const log of logs) {
    const row = months.find((m) => log.date.startsWith(m.month));
    if (row) row.count++;
  }
  const yearly = logs.filter(
    (l) =>
      l.date.startsWith(`${year}-`) && (l.type === "finish" || l.completed),
  ).length;
  return {
    total: entries.length,
    completed: entries.filter((e) => e.status === "completed").length,
    watching: entries.filter((e) => e.status === "watching").length,
    planned: entries.filter((e) => e.status === "planned").length,
    favorites: entries.filter((e) => e.favorite).length,
    average: rated.length
      ? rated.reduce((sum, e) => sum + e.rating, 0) / rated.length
      : 0,
    rated: rated.length,
    hours: Math.round(logs.reduce((sum, l) => sum + l.minutes, 0) / 60),
    yearly,
    goal: library.goal || 52,
    months,
    kinds,
    statuses,
    genres: [...genres].sort((a, b) => b[1] - a[1]).slice(0, 8),
    recent: [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
  };
}
export function hasWatched(library, key) {
  const entry = library.entries[key];
  return Boolean(
    entry?.watched ||
      entry?.status === "completed" ||
      (library.diary || []).some(
        (log) => log.key === key && (log.type === "finish" || log.completed),
      ),
  );
}
export function recommendTitles(library, candidates, limit = 12) {
  const weights = new Map();
  let watchedSeed = false,
    enjoyedSeed = false;
  for (const entry of Object.values(library.entries)) {
    if (library.dismissed?.[entry.title.key]) continue;
    const watched = hasWatched(library, entry.title.key);
    if (!watched && !entry.favorite && !entry.rating) continue;
    const finishes = (library.diary || []).filter(
      (log) =>
        log.key === entry.title.key && (log.type === "finish" || log.completed),
    ).length;
    let weight =
      (watched ? 0.6 : 0) +
      (entry.favorite ? 3 : 0) +
      (entry.rating ? (entry.rating - 5) / 2 : 0);
    if (weight > 0 && entry.rating >= 5)
      weight += Math.min(1.5, Math.max(0, finishes - 1) * 0.5);
    watchedSeed ||= watched;
    enjoyedSeed ||= watched && (entry.favorite || entry.rating >= 7.5);
    for (const genre of entry.title.genres)
      weights.set(genre, (weights.get(genre) || 0) + weight);
  }
  return candidates
    .filter(
      (t) =>
        !library.dismissed?.[t.key] &&
        !library.entries[t.key] &&
        !hasWatched(library, t.key),
    )
    .map((t) => {
      const matched = t.genres
        .filter((g) => (weights.get(g) || 0) > 0)
        .sort((a, b) => weights.get(b) - weights.get(a));
      return {
        title: t,
        affinity:
          t.genres.reduce((sum, g) => sum + (weights.get(g) || 0), 0) +
          (t.score || 0) / 3,
        reason: matched.length
          ? `${watchedSeed ? (enjoyedSeed ? "Based on watched titles you enjoyed" : "Similar to genres you have watched") : "Because you enjoy"}: ${matched.slice(0, 2).join(" and ")}`
          : "A highly rated discovery to start your profile",
      };
    })
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, limit);
}
// --- "For you": taste profile and ranking -------------------------------------------
// TMDB (movies + series) and AniList (anime) are separate models: their keyword/tag vocabularies differ,
// so a profile is built per provider and never merged.
const META_KEYWORD = /stinger|^based on|sequel|remake|woman director|independent film|^anime$|^live action$/i;
const norm = (v) => String(v || "").trim().toLowerCase();

// How much one library entry says about taste. Negative means "steer away from this".
export function entryWeight(library, entry) {
  const key = entry.title.key,
    watched = hasWatched(library, key),
    r = Number(entry.rating) || 0;
  let w = 0;
  if (r > 0 && r < 5) w = -(5 - r) * 0.6; // disliked
  else if (r >= 5 && r < 7.5) w = 0.4 + (r - 5) * 0.32; // a 5 counts a little
  else if (r >= 7.5) w = 1.2 + (r - 7.5) * 0.6; // 7.5 counts more, 10 the most
  else if (watched) w = 0.4; // watched, never rated
  else if (entry.status === "watching" && (entry.progress || 0) >= 3) w = 0.3;
  if (entry.favorite) w += 3.5; // favourites count on their own, whatever the rating
  if (entry.rewatchQueued) w += 1.5;
  const finishes = (library.diary || []).filter(
    (l) => l.key === key && (l.type === "finish" || l.completed),
  ).length;
  if (r >= 5 || entry.favorite) w += Math.min(2, Math.max(0, finishes - 1));
  if (entry.status === "dropped") w -= 1.5;
  return w;
}

// Per-provider genre and keyword weights, plus the liked titles worth asking TMDB for similar ones.
export function tasteProfiles(library) {
  const blank = () => ({ keywords: new Map(), genres: new Map(), seeds: [] });
  const profiles = { tmdb: blank(), anime: blank() };
  for (const entry of Object.values(library.entries || {})) {
    if (library.dismissed?.[entry.title.key]) continue;
    const w = entryWeight(library, entry);
    if (!w) continue;
    const t = entry.title,
      p = t.source === "jikan" ? profiles.anime : profiles.tmdb,
      names = (t.keywords || []).filter((k) => !META_KEYWORD.test(k.name)),
      per = w / Math.sqrt(Math.max(3, names.length));
    for (const k of names) {
      const id = norm(k.name),
        cur = p.keywords.get(id) || { w: 0, name: k.name, id: k.id };
      cur.w += per;
      p.keywords.set(id, cur);
    }
    for (const g of t.genres || []) p.genres.set(g, (p.genres.get(g) || 0) + w / 3);
    if (w >= 1.2 && t.source === "tmdb")
      p.seeds.push({ kind: t.kind, id: t.id, title: t.title, w });
  }
  for (const p of Object.values(profiles)) p.seeds.sort((a, b) => b.w - a.w);
  return profiles;
}

// Strongest positive keywords/tags first; used for both discovery queries and the taste chips.
export function topKeywords(profile, limit = 6) {
  return [...profile.keywords.values()]
    .filter((k) => k.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, limit);
}

// Scores candidates against one provider's profile and returns the best, with a reason each.
export function rankForYou(profile, candidates, library, limit = 24) {
  const seedWeight = new Map(profile.seeds.map((s) => [s.title, s.w]));
  const scored = candidates
    .filter(
      (t) =>
        !library.dismissed?.[t.key] &&
        !library.entries?.[t.key] &&
        !library.interested?.[t.key] &&
        !hasWatched(library, t.key),
    )
    .map((t) => {
      const names = new Set(
        [...(t.keywords || []).map((k) => k.name), ...(t.matched || [])]
          .filter((n) => !META_KEYWORD.test(n))
          .map(norm),
      );
      const hits = [...names]
        .map((n) => [profile.keywords.get(n), n])
        .filter(([k]) => k && k.w !== 0)
        .map(([k]) => k)
        .sort((a, b) => b.w - a.w);
      const keywordScore = hits.reduce((n, k) => n + k.w, 0),
        genreScore = (t.genres || []).reduce((n, g) => n + (profile.genres.get(g) || 0) * 0.35, 0),
        quality = Math.max(-0.5, Math.min(1, ((t.score || 0) - 6) / 3)),
        seedScore = t.seed ? 1.2 + Math.min(2, (seedWeight.get(t.seed) || 0) / 3) : 0;
      const positive = hits.filter((k) => k.w > 0).slice(0, 2);
      return {
        title: t,
        total: keywordScore + genreScore + quality + seedScore,
        lead: positive.map((k) => norm(k.name)),
        reason: t.seed
          ? `Because you liked ${t.seed}`
          : positive.length
            ? `Matches your taste for ${positive.map((k) => k.name).join(" and ")}`
            : "A well-rated pick to start your profile",
      };
    })
    .sort((a, b) => b.total - a.total);
  // Variety: each pick makes later picks sharing its lead keywords slightly less attractive.
  const used = new Map(),
    out = [];
  while (scored.length && out.length < limit) {
    let best = 0,
      bestScore = -Infinity;
    scored.forEach((c, i) => {
      const adj = c.total - 0.45 * c.lead.reduce((n, k) => n + (used.get(k) || 0), 0);
      if (adj > bestScore) ((bestScore = adj), (best = i));
    });
    const [pick] = scored.splice(best, 1);
    pick.lead.forEach((k) => used.set(k, (used.get(k) || 0) + 1));
    out.push(pick);
  }
  return out;
}
// "Tonight, decided": one title drawn from the watchlist AND the personalised suggestions.
// Watchlist titles weigh more (high priority most); suggestions are weighted by their rank.
export function tonightPick(
  library,
  { kind = "all", genre = "", minutes = 0, suggestions = [], exclude = [], random = Math.random } = {},
) {
  const fits = (t) =>
    (kind === "all" || t.kind === kind) &&
    (!genre || t.genres.includes(genre) || (genre === "Sci-Fi" && t.genres.includes("Science Fiction"))) &&
    (!minutes || !t.runtime || t.runtime <= minutes) &&
    !library.dismissed?.[t.key];
  const build = (skip) => {
    const pool = [];
    for (const e of Object.values(library.entries || {}))
      if (["planned", "on-hold"].includes(e.status) && !hasWatched(library, e.title.key) && fits(e.title) && !skip.includes(e.title.key))
        pool.push({ title: e.title, from: "watchlist", reason: "From your watchlist", w: e.priority === "high" ? 4 : e.priority === "low" ? 1 : 2.5 });
    suggestions.forEach((s, i) => {
      const t = s.title;
      if (!library.entries?.[t.key] && !hasWatched(library, t.key) && fits(t) && !skip.includes(t.key) && !pool.some((p) => p.title.key === t.key))
        pool.push({ title: t, from: "suggestion", reason: s.reason, w: i < 8 ? 1.6 : 1 });
    });
    return pool;
  };
  let pool = build(exclude),
    cycled = false;
  if (!pool.length && exclude.length) ((pool = build([])), (cycled = true));
  if (!pool.length) return null;
  let r = random() * pool.reduce((n, p) => n + p.w, 0);
  const pick = pool.find((p) => (r -= p.w) <= 0) || pool[pool.length - 1];
  return { ...pick, cycled, poolSize: pool.length };
}
export function scheduledTitles(library, month) {
  return Object.values(library.entries)
    .flatMap((e) => {
      const date = e.title.nextAirDate || e.title.releaseDate;
      return validDate(date) && (!month || date.startsWith(month))
        ? [
            {
              title: e.title,
              date,
              label: e.title.nextAirDate ? "Next episode" : "Release",
            },
          ]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
