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
        watched:completed || entry.watched || entry.status==='completed',
        rewatchQueued:completed?false:entry.rewatchQueued,
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
export function hasWatched(library,key) {
  const entry=library.entries[key];
  return Boolean(entry?.watched||entry?.status==='completed'||(library.diary || []).some(log=>log.key===key&&(log.type==='finish'||log.completed)));
}
export function recommendTitles(library, candidates, limit = 12) {
  const weights = new Map();
  let watchedSeed=false,enjoyedSeed=false;
  for (const entry of Object.values(library.entries)) {
    const watched=hasWatched(library,entry.title.key);
    if(!watched&&!entry.favorite&&!entry.rating)continue;
    const finishes=(library.diary || []).filter(log=>log.key===entry.title.key&&(log.type==='finish'||log.completed)).length;
    let weight=(watched?0.6:0)+(entry.favorite?3:0)+(entry.rating?(entry.rating-5)/2:0);
    if(weight>0&&entry.rating>=5)weight+=Math.min(1.5,Math.max(0,finishes-1)*0.5);
    watchedSeed ||= watched;
    enjoyedSeed ||= watched&&(entry.favorite||entry.rating>=7.5);
    for(const genre of entry.title.genres)weights.set(genre,(weights.get(genre)||0)+weight);
  }
  return candidates
    .filter((t) => !library.entries[t.key]&&!hasWatched(library,t.key))
    .map((t) => {
      const matched = t.genres
        .filter((g) => (weights.get(g)||0)>0)
        .sort((a, b) => weights.get(b) - weights.get(a));
      return {
        title: t,
        affinity:
          t.genres.reduce((sum, g) => sum + (weights.get(g)||0), 0) +
          (t.score || 0) / 3,
        reason: matched.length
          ? `${watchedSeed?(enjoyedSeed?'Based on watched titles you enjoyed':'Similar to genres you have watched'):'Because you enjoy'}: ${matched.slice(0, 2).join(" and ")}`
          : "A highly rated discovery to start your profile",
      };
    })
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, limit);
}
export function pickTonight(
  library,
  { kind = "all", genre = "", minutes = 0, random = Math.random } = {},
) {
  const choices = Object.values(library.entries).filter(
    (e) =>
      ["planned", "on-hold"].includes(e.status) &&
      (kind === "all" || e.title.kind === kind) &&
      (!genre || e.title.genres.includes(genre)) &&
      (!minutes || (e.title.runtime && e.title.runtime <= minutes)),
  );
  if (!choices.length) return null;
  const priority = choices.filter((e) => e.priority === "high");
  const pool = priority.length ? priority : choices;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
    .title;
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
