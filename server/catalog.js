import { demoTitles } from "./demo.js";

const genres = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10765: "Sci-Fi",
  10759: "Action",
  53: "Thriller",
  10752: "War",
  37: "Western",
};
export class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
export function normalizeTmdb(item, kind) {
  const type = item.media_type || kind;
  return {
    key: `tmdb:${type}:${item.id}`,
    source: "tmdb",
    id: item.id,
    kind: type,
    title: item.title || item.name || "Untitled",
    year:
      Number((item.release_date || item.first_air_date || "").slice(0, 4)) ||
      null,
    score: item.vote_average || 0,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "",
    backdrop: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : "",
    overview: item.overview || "No synopsis available yet.",
    genres:
      item.genres?.map((g) => g.name) ||
      (item.genre_ids || []).map((id) => genres[id]).filter(Boolean),
    runtime: item.runtime || item.episode_run_time?.[0] || null,
    seasons: item.number_of_seasons || null,
    episodes: item.number_of_episodes || null,
    cast: item.credits?.cast?.slice(0, 8).map((p) => p.name) || [],
    creator:
      item.credits?.crew?.find((p) => p.job === "Director")?.name ||
      item.created_by?.map((p) => p.name).join(", ") ||
      "",
    trailer:
      item.videos?.results?.find(
        (v) => v.site === "YouTube" && v.type === "Trailer",
      )?.key || null,
    demo: false,
  };
}
export function normalizeJikan(item) {
  return {
    key: `jikan:anime:${item.mal_id}`,
    source: "jikan",
    id: item.mal_id,
    kind: "anime",
    title: item.title_english || item.title,
    year: item.year || Number(item.aired?.from?.slice(0, 4)) || null,
    score: item.score || 0,
    poster: item.images?.jpg?.large_image_url || "",
    backdrop: "",
    overview: item.synopsis || "No synopsis available yet.",
    genres: (item.genres || []).map((g) => g.name),
    runtime: null,
    seasons: null,
    episodes: item.episodes || null,
    cast: [],
    creator: (item.studios || []).map((s) => s.name).join(", "),
    trailer: item.trailer?.youtube_id || null,
    demo: false,
  };
}
export function normalizeAnilist(item) {
  const text = String(item.description || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
  return {
    key: `jikan:anime:${item.idMal}`,
    source: "jikan",
    provider: "anilist",
    id: item.idMal,
    kind: "anime",
    title: item.title?.english || item.title?.romaji || "Untitled",
    year: item.startDate?.year || null,
    score: (item.averageScore || 0) / 10,
    poster: item.coverImage?.large || "",
    backdrop: item.bannerImage || "",
    overview: text || "No synopsis available yet.",
    genres: item.genres || [],
    runtime: item.duration || null,
    seasons: null,
    episodes: item.episodes || null,
    cast: [],
    creator: item.studios?.nodes?.map((s) => s.name).join(", ") || "",
    trailer: item.trailer?.site === "youtube" ? item.trailer.id : null,
    demo: false,
  };
}

export function createCatalog({
  token = "",
  fetcher = fetch,
  clock = Date.now,
} = {}) {
  const cache = new Map();
  let jikanQueue = Promise.resolve();
  let lastJikan = 0;
  let animeQueue = Promise.resolve();
  let lastAnime = 0;
  async function request(url, jikan = false) {
    const cached = cache.get(url);
    if (cached && cached.expires > clock()) return cached.value;
    const run = async () => {
      // Serialise Jikan requests across clients; stay below its 3 requests/second limit.
      if (jikan) {
        const delay = Math.max(0, 400 - (Date.now() - lastJikan));
        if (delay) await new Promise((r) => setTimeout(r, delay));
        lastJikan = Date.now();
      }
      let response;
      try {
        response = await fetcher(url, {
          headers: jikan
            ? { accept: "application/json" }
            : { accept: "application/json", Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(12000),
        });
      } catch {
        throw new ApiError(
          "The catalogue is unreachable. Please try again or switch to demo mode.",
        );
      }
      if (!response.ok)
        throw new ApiError(
          response.status === 429
            ? "Catalogue rate limit reached. Please wait a moment."
            : response.status === 401
              ? "TMDB rejected the token. Check TMDB_READ_TOKEN in .env and restart the server."
              : "The catalogue could not complete this request.",
          response.status === 429 ? 429 : 502,
        );
      const value = await response.json();
      if (cache.size >= 300) cache.delete(cache.keys().next().value);
      cache.set(url, { value, expires: clock() + 300000 });
      return value;
    };
    if (!jikan) return run();
    const job = jikanQueue.then(() => {
      const hit = cache.get(url);
      return hit && hit.expires > clock() ? hit.value : run();
    });
    jikanQueue = job.catch(() => {});
    return job;
  }
  const tmdb = (path, params = {}) =>
    request(
      `https://api.themoviedb.org/3/${path}?${new URLSearchParams({ language: "en-US", include_adult: "false", ...params })}`,
    );
  const jikan = (path, params = {}) =>
    request(
      `https://api.jikan.moe/v4/${path}?${new URLSearchParams({ sfw: "true", ...params })}`,
      true,
    );
  const animeFields =
    "idMal title { english romaji } startDate { year } averageScore coverImage { large } bannerImage description(asHtml: false) genres duration episodes studios(isMain: true) { nodes { name } } trailer { id site }";
  async function anilist(query, variables) {
    const key = JSON.stringify({ query, variables });
    const cached = cache.get(key);
    if (cached && cached.expires > clock()) return cached.value;
    const run = async () => {
      const hit = cache.get(key);
      if (hit && hit.expires > clock()) return hit.value;
      const delay = Math.max(0, 2100 - (Date.now() - lastAnime));
      if (delay) await new Promise((r) => setTimeout(r, delay));
      lastAnime = Date.now();
      let response;
      try {
        response = await fetcher("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        throw new ApiError(
          "The anime catalogue is unreachable. Please try again.",
        );
      }
      if (!response.ok)
        throw new ApiError(
          "The anime catalogue is temporarily unavailable.",
          response.status === 429 ? 429 : 502,
        );
      const value = await response.json();
      if (value.errors || !value.data)
        throw new ApiError(
          "The anime catalogue could not complete this request.",
        );
      if (cache.size >= 300) cache.delete(cache.keys().next().value);
      cache.set(key, { value: value.data, expires: clock() + 300000 });
      return value.data;
    };
    const job = animeQueue.then(run);
    animeQueue = job.catch(() => {});
    return job;
  }
  async function animeList({ page, query, sort, limit = 24 }) {
    try {
      const data = await anilist(
        `query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort]) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage lastPage total hasNextPage } media(type: ANIME, isAdult: false, search: $search, sort: $sort) { ${animeFields} } } }`,
        {
          page,
          perPage: limit,
          search: query || null,
          sort: query
            ? ["SEARCH_MATCH"]
            : sort === "rating"
              ? ["SCORE_DESC"]
              : sort === "newest"
                ? ["START_DATE_DESC"]
                : ["POPULARITY_DESC"],
        },
      );
      if (!data.Page) throw new ApiError("Missing anime results.");
      const info = data.Page.pageInfo;
      return {
        results: (data.Page.media || [])
          .filter((t) => t.idMal)
          .map(normalizeAnilist),
        page,
        totalPages: Math.min(
          info.lastPage || (info.hasNextPage ? page + 1 : page),
          500,
        ),
        total: info.total || 0,
        mode: "live",
      };
    } catch {
      const data = await jikan("anime", {
        page: String(page),
        limit: String(limit),
        ...(query ? { q: query } : {}),
        order_by:
          sort === "newest"
            ? "start_date"
            : sort === "rating"
              ? "score"
              : "members",
        sort: "desc",
      });
      return {
        results: (data.data || []).map(normalizeJikan),
        page,
        totalPages: Math.min(data.pagination?.last_visible_page || 1, 500),
        total: data.pagination?.items?.total || 0,
        mode: "live",
        warning:
          "AniList is unavailable. Showing MyAnimeList results via Jikan.",
      };
    }
  }
  async function catalog({
    kind = "all",
    query = "",
    page = 1,
    sort = "popular",
    mode = "demo",
  } = {}) {
    if (mode === "demo") {
      let results = demoTitles.filter(
        (t) =>
          (kind === "all" || t.kind === kind) &&
          `${t.title} ${t.genres.join(" ")} ${t.creator}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      );
      if (sort === "rating")
        results = results.toSorted((a, b) => b.score - a.score);
      if (sort === "newest")
        results = results.toSorted((a, b) => b.year - a.year);
      return {
        results: results.slice((page - 1) * 24, page * 24),
        page,
        totalPages: Math.ceil(results.length / 24),
        total: results.length,
        mode: "demo",
      };
    }
    if (kind !== "anime" && !token)
      throw new ApiError(
        "Connect a TMDB Read Access Token to search the live movie and TV catalogue. Anime works without a key.",
        503,
      );
    if (kind === "anime") {
      return animeList({ page, query, sort });
    }
    if (kind === "all") {
      // Provider pages advance independently; the UI labels this as a combined page, not a global ranking.
      const [movies, anime] = await Promise.allSettled([
        tmdb(query ? "search/multi" : "trending/all/week", {
          page: String(page),
          ...(query ? { query } : {}),
        }),
        animeList({ page, query, sort, limit: 12 }),
      ]);
      if (movies.status === "rejected" && anime.status === "rejected")
        throw movies.reason;
      const a = movies.status === "fulfilled" ? movies.value : null,
        b = anime.status === "fulfilled" ? anime.value : null;
      const results = [
        ...(a?.results || [])
          .filter((t) => ["movie", "tv"].includes(t.media_type))
          .map((t) => normalizeTmdb(t)),
        ...(b?.results || []),
      ];
      return {
        results,
        page,
        totalPages: Math.max(
          Math.min(a?.total_pages || 0, 500),
          b?.totalPages || 0,
        ),
        total: (a?.total_results || 0) + (b?.total || 0),
        mode: "live",
        warning:
          !a || !b
            ? "One provider is unavailable. Showing results from the other provider."
            : b?.warning || null,
      };
    }
    const data = await tmdb(query ? `search/${kind}` : `discover/${kind}`, {
      page: String(page),
      ...(query
        ? { query }
        : {
            sort_by:
              sort === "rating"
                ? "vote_average.desc"
                : sort === "newest"
                  ? kind === "movie"
                    ? "primary_release_date.desc"
                    : "first_air_date.desc"
                  : "popularity.desc",
            "vote_count.gte": sort === "rating" ? "200" : "20",
          }),
    });
    return {
      results: (data.results || []).map((t) => normalizeTmdb(t, kind)),
      page,
      totalPages: Math.min(data.total_pages || 1, 500),
      total: data.total_results || 0,
      mode: "live",
    };
  }
  async function detail(source, kind, id, mode = "live") {
    if (mode === "demo") {
      const found = demoTitles.find((t) => t.key === `${source}:${kind}:${id}`);
      if (!found) throw new ApiError("Title not found.", 404);
      return found;
    }
    if (source === "jikan" && kind === "anime") {
      try {
        const data = await anilist(
          `query ($id: Int) { Media(idMal: $id, type: ANIME, isAdult: false) { ${animeFields} } }`,
          { id },
        );
        if (!data.Media) throw new ApiError("Title not found.", 404);
        return normalizeAnilist(data.Media);
      } catch {
        return normalizeJikan((await jikan(`anime/${id}/full`)).data);
      }
    }
    if (source !== "tmdb" || !["movie", "tv"].includes(kind))
      throw new ApiError("Invalid title.", 400);
    if (!token)
      throw new ApiError(
        "Connect TMDB in .env to load live title details.",
        503,
      );
    return normalizeTmdb(
      await tmdb(`${kind}/${id}`, { append_to_response: "credits,videos" }),
      kind,
    );
  }
  return { catalog, detail, configured: Boolean(token) };
}
