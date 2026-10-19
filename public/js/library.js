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
      status: raw.status,
      rating,
      notes: String(raw.notes || "").slice(0, 5000),
      folders: Array.isArray(raw.folders)
        ? [...new Set(raw.folders.filter((id) => ids.has(id)))]
        : [],
      progress: Math.max(0, Math.floor(Number(raw.progress) || 0)),
      updatedAt:
        typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : new Date().toISOString(),
    };
  }
  return { version: 1, entries, folders };
}
export function saveTitle(library, title, patch = {}) {
  const current = library.entries[title.key] || {
    title: validateTitle(title),
    favorite: false,
    status: "planned",
    rating: 0,
    notes: "",
    folders: [],
    progress: 0,
  };
  return {
    ...library,
    entries: {
      ...library.entries,
      [title.key]: {
        ...current,
        ...patch,
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
      (!folder || e.folders.includes(folder)) &&
      (kind === "all" || e.title.kind === kind) &&
      (status === "all" || e.status === status) &&
      e.title.title.toLowerCase().includes(query.toLowerCase()),
  );
  entries.sort(
    sort === "rating"
      ? (a, b) => b.rating - a.rating
      : sort === "title"
        ? (a, b) => a.title.title.localeCompare(b.title.title)
        : (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
  return entries;
}
