// The app's API, independent of how it is reached: the Node server calls this for /api/* requests, and the
// standalone (phone) app calls it directly with no server. Input is validated here, once, for both.
import { ApiError } from "./catalog.js";
import { GENRES } from "./catalog-filters.js";

const REGIONS = ["PT", "US", "GB", "ES", "FR", "DE", "JP", "BR"];

export async function handleApi(url, catalog) {
  const p = url.searchParams;
  if (url.pathname === "/api/config")
    return { tmdbConfigured: catalog.configured, animeAvailable: true };

  if (url.pathname === "/api/catalog") {
    const kind = p.get("kind") || "all",
      mode = p.get("mode") || "demo",
      query = (p.get("query") || "").trim(),
      page = Number(p.get("page") || 1),
      sort = p.get("sort") || "popular",
      genre = p.get("genre") || "",
      yearFrom = p.get("yearFrom") || "",
      yearTo = p.get("yearTo") || "",
      airing = p.get("airing") || "",
      year = p.get("year") || "",
      minScore = Number(p.get("minScore") || 0);
    if (
      !["all", "movie", "tv", "anime"].includes(kind) ||
      !["live", "demo"].includes(mode) ||
      !["popular", "rating", "newest"].includes(sort) ||
      !["", "new", "airing", "ended", "upcoming", "week"].includes(airing) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 500 ||
      query.length > 150 ||
      (genre &&
        (genre.split(",").length > 5 ||
          !genre.split(",").every((g) => GENRES.includes(g)))) ||
      [year, yearFrom, yearTo].some(
        (y) =>
          y &&
          (!/^\d{4}$/.test(y) ||
            Number(y) < 1900 ||
            Number(y) > new Date().getFullYear() + 5),
      ) ||
      (yearFrom && yearTo && Number(yearFrom) > Number(yearTo)) ||
      !Number.isFinite(minScore) ||
      minScore < 0 ||
      minScore > 10
    )
      throw new ApiError("Invalid search parameters.", 400);
    return catalog.catalog({ kind, mode, query, page, sort, genre, year, yearFrom, yearTo, minScore, airing });
  }

  if (url.pathname.startsWith("/api/title/")) {
    const match = url.pathname.match(/^\/api\/title\/(tmdb|jikan)\/(movie|tv|anime)\/(\d+)$/);
    if (!match) throw new ApiError("Invalid title.", 400);
    const mode = p.get("mode") || "live";
    if (!["live", "demo"].includes(mode)) throw new ApiError("Invalid mode.", 400);
    return catalog.detail(match[1], match[2], Number(match[3]), mode);
  }

  if (url.pathname.startsWith("/api/availability/")) {
    const match = url.pathname.match(/^\/api\/availability\/(movie|tv)\/(\d+)$/),
      region = p.get("region") || "PT";
    if (!match || !REGIONS.includes(region))
      throw new ApiError("Invalid availability request.", 400);
    return catalog.availability(match[1], Number(match[2]), region);
  }

  if (url.pathname === "/api/foryou") {
    let profile;
    try {
      profile = JSON.parse(p.get("profile") || "{}");
    } catch {
      throw new ApiError("Invalid profile.", 400);
    }
    return catalog.foryou(p.get("kind"), {
      keywords: (Array.isArray(profile.keywords) ? profile.keywords : [])
        .slice(0, 8)
        .filter((k) => k && typeof k.name === "string" && k.name.length <= 60)
        .map((k) => ({ id: Number.isInteger(k.id) ? k.id : undefined, name: k.name })),
      seeds: (Array.isArray(profile.seeds) ? profile.seeds : [])
        .slice(0, 6)
        .filter((x) => x && Number.isInteger(x.id) && typeof x.title === "string")
        .map((x) => ({ id: x.id, title: x.title.slice(0, 120) })),
    });
  }

  if (url.pathname.startsWith("/api/person/")) {
    const match = url.pathname.match(/^\/api\/person\/(\d+)$/);
    if (!match) throw new ApiError("Invalid person.", 400);
    return catalog.person(Number(match[1]));
  }

  if (url.pathname.startsWith("/api/season/")) {
    const match = url.pathname.match(/^\/api\/season\/(\d+)\/(\d+)$/);
    if (!match || Number(match[2]) > 200) throw new ApiError("Invalid season.", 400);
    return catalog.season(Number(match[1]), Number(match[2]));
  }

  throw new ApiError("Endpoint not found.", 404);
}
