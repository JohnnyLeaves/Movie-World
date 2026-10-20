import { normalizeLog,hasWatched } from "./insights.js";
export const STORAGE_KEY = "movie-world.library.v1";
export const STATUSES = [
  "planned",
  "watching",
  "completed",
  "on-hold",
  "dropped",
];
export const emptyLibrary = () => ({
  version: 1,
  entries: {},
  diary: [],
  goal: 52,
  folders: [
    { id: "next-up", name: "Next up" },
    { id: "mind-benders", name: "Mind-benders" },
  ],
});
const safeImage = (value) =>
  typeof value === "string" &&
  (/^https:\/\/(image\.tmdb\.org|cdn\.myanimelist\.net|s[1-4]\.anilist\.co)\//.test(
    value,
  ) ||
    /^\/assets\/(?:posters\/(?:movie|tv|anime)-\d+|spotlight)\.jpg$/.test(
      value,
    ))
    ? value
    : "";
export function validateTitle(t) {
  if (
    !t ||
    !["movie", "tv", "anime"].includes(t.kind) ||
    !["tmdb", "jikan"].includes(t.source) ||
    !Number.isInteger(t.id) ||
    t.id < 1 ||
    typeof t.title !== "string" ||
    !t.title.trim() ||
    t.title.length > 500
  )
    throw new Error("Invalid title in backup.");
  return {
    key: `${t.source}:${t.kind}:${t.id}`,
    source: t.source,
    ...(t.provider === "anilist" ? { provider: "anilist" } : {}),
    id: t.id,
    kind: t.kind,
    title: t.title.slice(0, 500),
    year: Number.isInteger(t.year) ? t.year : null,
    score: Math.min(10, Math.max(0, Number(t.score) || 0)),
    poster: safeImage(t.poster),
    backdrop: safeImage(t.backdrop),
    overview: String(t.overview || "").slice(0, 12000),
    genres: Array.isArray(t.genres)
      ? t.genres.filter((g) => typeof g === "string").slice(0, 20)
      : [],
    runtime: Number(t.runtime) || null,
    seasons: Number(t.seasons) || null,
    episodes: Number(t.episodes) || null,
    creator: String(t.creator || "").slice(0, 500),
    cast: Array.isArray(t.cast)
      ? t.cast.filter((c) => typeof c === "string").slice(0, 20)
      : [],
    trailer:
      typeof t.trailer === "string" && /^[\w-]{11}$/.test(t.trailer)
        ? t.trailer
        : null,
    demo: Boolean(t.demo),
    ...(typeof t.releaseDate === "string"
      ? { releaseDate: t.releaseDate.slice(0, 10) }
      : {}),
    ...(typeof t.nextAirDate === "string"
      ? { nextAirDate: t.nextAirDate.slice(0, 10) }
      : {}),
    ...(typeof t.status === "string" ? { status: t.status.slice(0, 80) } : {}),
  };
}
export function parseLibrary(text) {
  const data = JSON.parse(text);
  if (
    data?.version !== 1 ||
    !data.entries ||
    typeof data.entries !== "object" ||
    Array.isArray(data.entries) ||
    !Array.isArray(data.folders) ||
    data.folders.length > 200 ||
    Object.keys(data.entries).length > 20000
  )
    throw new Error("This is not a supported Movie World backup.");
  const ids = new Set();
  const folders = data.folders.map((f) => {
    if (
      !f ||
      typeof f.id !== "string" ||
      !/^[\w-]{1,100}$/.test(f.id) ||
      ids.has(f.id) ||
      typeof f.name !== "string" ||
      !f.name.trim() ||
      f.name.length > 60
    )
      throw new Error("Invalid collection in backup.");
    ids.add(f.id);
    return { id: f.id, name: f.name.trim() };
  });
  const entries = {};
  for (const raw of Object.values(data.entries)) {
    const title = validateTitle(raw.title),
      rating = Number(raw.rating);
    if (
      !STATUSES.includes(raw.status) ||
      !Number.isFinite(rating) ||
      rating < 0 ||
      rating > 10 ||
      !Number.isInteger(rating * 2)
    )
      throw new Error("Invalid rating or watch status in backup.");
    entries[title.key] = {
      title,
      favorite: Boolean(raw.favorite),
      watched:Boolean(raw.watched||raw.status==='completed'),
      rewatchQueued:Boolean(raw.rewatchQueued),
      status: raw.status,
      rating,
      notes: String(raw.notes || "").slice(0, 5000),
      folders: Array.isArray(raw.folders)
        ? [...new Set(raw.folders.filter((id) => ids.has(id)))]
        : [],
      progress: Math.max(0, Math.floor(Number(raw.progress) || 0)),
      priority: ["low", "normal", "high"].includes(raw.priority)
        ? raw.priority
        : "normal",
      tags: Array.isArray(raw.tags)
        ? [
            ...new Set(
              raw.tags
                .filter((t) => typeof t === "string")
                .map((t) => t.trim().slice(0, 30))
                .filter(Boolean),
            ),
          ].slice(0, 12)
        : [],
      updatedAt:
        typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : new Date().toISOString(),
    };
  }
  if (
    data.diary !== undefined &&
    (!Array.isArray(data.diary) || data.diary.length > 100000)
  )
    throw new Error("Invalid watch diary.");
  const diary = (data.diary || []).map(normalizeLog);
  if (new Set(diary.map((l) => l.id)).size !== diary.length)
    throw new Error("Duplicate diary identifiers.");
  return {
    version: 1,
    entries,
    folders,
    diary,
    goal:
      Number.isInteger(data.goal) && data.goal >= 1 && data.goal <= 1000
        ? data.goal
        : 52,
  };
}
export function saveTitle(library, title, patch = {}) {
  if (
    !library.entries[title.key] &&
    Object.keys(library.entries).length >= 20000
  )
    throw new Error(
      "Your library supports up to 20,000 titles. Export a backup before starting another library.",
    );
  const current = library.entries[title.key] || {
    title: validateTitle(title),
    favorite: false,
    watched:false,
    rewatchQueued:false,
    status: "planned",
    rating: 0,
    notes: "",
    folders: [],
    progress: 0,
    priority: "normal",
    tags: [],
  };
  return {
    ...library,
    entries: {
      ...library.entries,
      [title.key]: {
        ...current,
        ...patch,
        watched:patch.watched ?? (current.watched||current.status==='completed'||patch.status==='completed'),
        title: validateTitle(title),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
export function removeTitle(library, key) {
  const entries = { ...library.entries };
  delete entries[key];
  return { ...library, entries };
}
export function addFolder(library, name, id = crypto.randomUUID()) {
  const clean = name.trim();
  if (!clean || clean.length > 60)
    throw new Error("Use a collection name between 1 and 60 characters.");
  if (library.folders.some((f) => f.name.toLowerCase() === clean.toLowerCase()))
    throw new Error("A collection with that name already exists.");
  if (library.folders.length >= 200)
    throw new Error("You can create up to 200 collections.");
  return { ...library, folders: [...library.folders, { id, name: clean }] };
}
export function deleteFolder(library, id) {
  return {
    ...library,
    folders: library.folders.filter((f) => f.id !== id),
    entries: Object.fromEntries(
      Object.entries(library.entries).map(([key, entry]) => [
        key,
        { ...entry, folders: entry.folders.filter((f) => f !== id) },
      ]),
    ),
  };
}
export function renameFolder(library, id, name) {
  const without = {
    ...library,
    folders: library.folders.filter((f) => f.id !== id),
  };
  const checked = addFolder(without, name, id).folders.at(-1);
  return {
    ...library,
    folders: library.folders.map((f) => (f.id === id ? checked : f)),
  };
}
export function filterEntries(
  library,
  {
    view = "library",
    folder = "",
    query = "",
    kind = "all",
    status = "all",
    sort = "recent",
  } = {},
) {
  let entries = Object.values(library.entries).filter(
    (e) =>
      (view !== "favorites" || e.favorite) &&
      (view!=='watched'||hasWatched(library,e.title.key)) &&
      (view!=='rewatch'||e.rewatchQueued) &&
      (!folder || e.folders.includes(folder)) &&
      (kind === "all" || e.title.kind === kind) &&
      (status === "all" || e.status === status) &&
      `${e.title.title} ${e.notes} ${(e.tags || []).join(" ")} ${e.title.genres.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  entries.sort(
    sort === "rating"
      ? (a, b) => b.rating - a.rating
      : sort === "priority"
        ? (a, b) =>
            ({ high: 2, normal: 1, low: 0 })[b.priority || "normal"] -
            { high: 2, normal: 1, low: 0 }[a.priority || "normal"]
        : sort === "title"
          ? (a, b) => a.title.title.localeCompare(b.title.title)
          : (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
  return entries;
}
