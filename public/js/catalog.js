import { demoTitles } from "./demo.js";
import { matchesFilters } from "./catalog-filters.js";

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
    // TMDB keywords (ids let us discover similar titles); only present on detail responses.
    keywords: (item.keywords?.keywords || item.keywords?.results || [])
      .slice(0, 20)
      .map((k) => ({ id: k.id, name: k.name })),
    cast: item.credits?.cast?.slice(0, 8).map((p) => p.name) || [],
    // People with ids so the UI can open a profile; only present on full detail responses.
    castList: (item.credits?.cast || []).slice(0, 14).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.character || "",
      photo: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : "",
    })),
    creatorList: (type === "movie"
      ? (item.credits?.crew || []).filter((p) => p.job === "Director")
      : item.created_by || []
    ).map((p) => ({
      id: p.id,
      name: p.name,
      role: type === "movie" ? "Director" : "Creator",
      photo: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : "",
    })),
    creator:
      item.credits?.crew?.find((p) => p.job === "Director")?.name ||
      item.created_by?.map((p) => p.name).join(", ") ||
      "",
    trailer:
      item.videos?.results?.find(
        (v) => v.site === "YouTube" && v.type === "Trailer",
      )?.key || null,
    demo: false,
    releaseDate: item.release_date || item.first_air_date || "",
    status: item.status || "",
    tagline: item.tagline || "",
    originalTitle: item.original_title || item.original_name || "",
    nextAirDate: item.next_episode_to_air?.air_date || "",
    nextEpisode: item.next_episode_to_air?.name || "",
    seasonList: (item.seasons || []).map((s) => ({
      number: s.season_number,
      name: s.name,
      episodes: s.episode_count,
      airDate: s.air_date,
    })),
    recommendations: (item.recommendations?.results || [])
      .filter((t) => !t.media_type || ["movie", "tv"].includes(t.media_type))
      .slice(0, 12)
      .map((t) => normalizeTmdb(t, type)),
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
    releaseDate: item.aired?.from?.slice(0, 10) || "",
    status: item.status || "",
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
    // AniList community tags, strongest first; spoiler tags are skipped.
    keywords: (item.tags || [])
      .filter((t) => !t.isMediaSpoiler && t.rank >= 50)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 15)
      .map((t) => ({ name: t.name })),
    runtime: item.duration || null,
    seasons: null,
    episodes: item.episodes || null,
    cast: [],
    creator: item.studios?.nodes?.map((s) => s.name).join(", ") || "",
    trailer: item.trailer?.site === "youtube" ? item.trailer.id : null,
    demo: false,
    releaseDate:
      item.startDate?.year && item.startDate?.month && item.startDate?.day
        ? `${item.startDate.year}-${String(item.startDate.month).padStart(2, "0")}-${String(item.startDate.day).padStart(2, "0")}`
        : "",
    nextAirDate: item.nextAiringEpisode?.airingAt
      ? new Date(item.nextAiringEpisode.airingAt * 1000)
          .toISOString()
          .slice(0, 10)
      : "",
    nextEpisode: item.nextAiringEpisode?.episode
      ? `Episode ${item.nextAiringEpisode.episode}`
      : "",
    status: item.status || "",
    recommendations: (item.recommendations?.nodes || [])
      .map((n) => n.mediaRecommendation)
      .filter((t) => t?.idMal)
      .slice(0, 12)
      .map(normalizeAnilist),
  };
}

const daysAgo = (n, clock = Date.now) =>
  new Date(clock() - n * 864e5).toISOString().slice(0, 10);

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
    "idMal title { english romaji } startDate { year month day } status nextAiringEpisode { airingAt episode } averageScore coverImage { large } bannerImage description(asHtml: false) genres tags { name rank isMediaSpoiler } duration episodes studios(isMain: true) { nodes { name } } trailer { id site }";
  async function anilist(query, variables) {
    // AniList rejects explicit nulls on filter args ("Illegal operator and value combination").
    variables = Object.fromEntries(
      Object.entries(variables).filter(([, v]) => v != null),
    );
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
  async function animeList({
    page,
    query,
    sort,
    limit = 24,
    genre = [],
    yearFrom = "",
    yearTo = "",
    minScore = 0,
    airing = "",
  }) {
    // Date window from the airing filter, narrowed by the year range (FuzzyDateInt = YYYYMMDD).
    const ymd = (d) => Number(d.replaceAll("-", ""));
    const afters = [
      airing === "new" ? ymd(daysAgo(365, clock)) : 0,
      airing === "week" ? ymd(daysAgo(1, clock)) : 0,
      airing === "upcoming" && sort === "newest" ? ymd(daysAgo(0, clock)) : 0,
      yearFrom ? (Number(yearFrom) - 1) * 10000 + 1231 : 0,
    ];
    const befores = [
      airing === "week" ? ymd(daysAgo(-8, clock)) : 0,
      yearTo ? (Number(yearTo) + 1) * 10000 + 101 : 0,
    ].filter(Boolean);
    const after = Math.max(...afters) || null,
      before = befores.length ? Math.min(...befores) : null;
    try {
      const data = await anilist(
        `query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $genre: [String], $score: Int, $status: [MediaStatus], $startAfter: FuzzyDateInt, $startBefore: FuzzyDateInt) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage lastPage total hasNextPage } media(type: ANIME, isAdult: false, search: $search, sort: $sort, genre_in: $genre, averageScore_greater: $score, status_in: $status, startDate_greater: $startAfter, startDate_lesser: $startBefore) { ${animeFields} } } }`,
        {
          page,
          perPage: limit,
          search: query || null,
          genre: genre.length ? genre : null,
          score: Number(minScore) ? Number(minScore) * 10 - 1 : null,
          status: airing
            ? { new: ["RELEASING", "FINISHED"], airing: ["RELEASING"], ended: ["FINISHED", "CANCELLED"], upcoming: ["NOT_YET_RELEASED"], week: ["NOT_YET_RELEASED", "RELEASING"] }[airing]
            : null,
          startAfter: after,
          startBefore: before,
          sort: query
            ? ["SEARCH_MATCH"]
            : sort === "rating"
              ? ["SCORE_DESC"]
              : sort === "newest"
                ? [airing === "upcoming" ? "START_DATE" : "START_DATE_DESC"]
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
        ...(airing === "airing" ? { status: "airing" } : {}),
        ...(airing === "ended" ? { status: "complete" } : {}),
        ...(airing === "new" ? { start_date: daysAgo(365, clock) } : {}),
        ...(airing === "upcoming" ? { status: "upcoming" } : {}),
        order_by:
          sort === "newest"
            ? "start_date"
            : sort === "rating"
              ? "score"
              : "members",
        sort: "desc",
      });
      return {
        results: (data.data || [])
          .map(normalizeJikan)
          .filter((t) => matchesFilters(t, { genre: genre.join(","), yearFrom, yearTo, minScore })),
        page,
        totalPages: Math.min(data.pagination?.last_visible_page || 1, 500),
        total: data.pagination?.items?.total || 0,
        mode: "live",
        warning:
          "AniList is unavailable. Showing MyAnimeList results via Jikan; active filters refine this fallback page.",
      };
    }
  }
  async function catalog({
    kind = "all",
    query = "",
    page = 1,
    sort = "popular",
    mode = "demo",
    genre = "",
    year = "",
    yearFrom = "",
    yearTo = "",
    minScore = 0,
    airing = "",
  } = {}) {
    // `genre` may be a comma list; `year` is shorthand for a single-year range.
    const genreList = genre ? String(genre).split(",").filter(Boolean) : [],
      from = yearFrom || year,
      to = yearTo || year,
      filters = { genre: genreList.join(","), yearFrom: from, yearTo: to, minScore };
    if (mode === "demo" && (airing === "upcoming" || airing === "week"))
      return { results: [], page, totalPages: 1, total: 0, mode: "demo" };
    if (mode === "demo") {
      let results = demoTitles.filter(
        (t) =>
          (kind === "all" || t.kind === kind) &&
          `${t.title} ${t.genres.join(" ")} ${t.creator}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          matchesFilters(t, filters),
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
      return animeList({ page, query, sort, genre: genreList, yearFrom: from, yearTo: to, minScore, airing });
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
        results: results.filter((t) =>
          matchesFilters(t, filters),
        ),
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
    const upcoming = (airing === "upcoming" || airing === "week") && !query;
    const dateKey = kind === "movie" ? "primary_release_date" : "first_air_date";
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
            "vote_count.gte": upcoming ? "0" : sort === "rating" ? "200" : "20",
            // Upcoming: unreleased titles within the next year; "newest" means soonest first.
            ...(upcoming
              ? {
                  [`${dateKey}.gte`]: daysAgo(0, clock),
                  [`${dateKey}.lte`]: daysAgo(airing === "week" ? -7 : -365, clock),
                  ...(sort === "newest" ? { sort_by: `${dateKey}.asc` } : {}),
                }
              : {}),
            ...(genreList.length
              ? {
                  with_genres: genreList
                    .map((name) =>
                      Object.keys(genres).find(
                        (id) =>
                          genres[id] === name &&
                          (kind === "tv"
                            ? !["28", "878"].includes(id)
                            : !["10759", "10765"].includes(id)),
                      ),
                    )
                    .filter(Boolean)
                    .join(","),
                }
              : {}),
            ...(from ? { [`${dateKey}.gte`]: `${from}-01-01` } : {}),
            ...(to ? { [`${dateKey}.lte`]: `${to}-12-31` } : {}),
            ...(Number(minScore)
              ? { "vote_average.gte": String(minScore) }
              : {}),
            // TV only: new = premiered in the last year, airing = returning series with a recent episode, ended = ended or cancelled.
            ...(kind === "tv" && airing === "new"
              ? { "first_air_date.gte": daysAgo(365, clock) }
              : {}),
            ...(kind === "tv" && airing === "airing"
              ? { with_status: "0", "air_date.gte": daysAgo(14, clock) }
              : {}),
            ...(kind === "tv" && airing === "ended"
              ? { with_status: "3|4" }
              : {}),
          }),
    });
    return {
      results: (data.results || [])
        .map((t) => normalizeTmdb(t, kind))
        .filter((t) => !query || matchesFilters(t, filters)),
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
      const related = demoTitles
        .filter(
          (t) =>
            t.key !== found.key &&
            t.genres.some((g) => found.genres.includes(g)),
        )
        .sort(
          (a, b) =>
            b.genres.filter((g) => found.genres.includes(g)).length -
            a.genres.filter((g) => found.genres.includes(g)).length,
        )
        .slice(0, 6);
      return { ...found, recommendations: related };
    }
    if (source === "jikan" && kind === "anime") {
      try {
        const data = await anilist(
          `query ($id: Int) { Media(idMal: $id, type: ANIME, isAdult: false) { ${animeFields} recommendations(sort: RATING_DESC, perPage: 8) { nodes { mediaRecommendation { ${animeFields} } } } } }`,
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
      await tmdb(`${kind}/${id}`, {
        append_to_response: "credits,videos,recommendations,keywords",
      }),
      kind,
    );
  }
  async function availability(kind, id, region = "PT") {
    if (!token)
      throw new ApiError("Connect TMDB to see regional availability.", 503);
    const data = await tmdb(`${kind}/${id}/watch/providers`),
      item = data.results?.[region] || {};
    const group = (key) =>
      (item[key] || []).map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : "",
      }));
    return {
      region,
      link:
        typeof item.link === "string" &&
        item.link.startsWith("https://www.themoviedb.org/")
          ? item.link
          : null,
      stream: group("flatrate"),
      rent: group("rent"),
      buy: group("buy"),
      free: group("free"),
      ads: group("ads"),
    };
  }
  async function season(id, number) {
    if (!token) throw new ApiError("Connect TMDB to explore seasons.", 503);
    const data = await tmdb(`tv/${id}/season/${number}`);
    return {
      number,
      name: data.name,
      episodes: (data.episodes || []).map((e) => ({
        id: e.id,
        number: e.episode_number,
        name: e.name,
        airDate: e.air_date,
        overview: e.overview || "",
        runtime: e.runtime || null,
        score: e.vote_average || 0,
      })),
    };
  }
  async function person(id) {
    if (!token) throw new ApiError("Connect TMDB to explore people.", 503);
    const data = await tmdb(`person/${id}`, { append_to_response: "combined_credits" });
    const pick = (list, label) => {
      const seen = new Map();
      for (const c of list || []) {
        if (!["movie", "tv"].includes(c.media_type) || !c.poster_path) continue;
        const key = `${c.media_type}:${c.id}`,
          role = label(c);
        if (seen.has(key)) seen.get(key).roles.add(role);
        else seen.set(key, { c, roles: new Set(role ? [role] : []) });
      }
      return [...seen.values()]
        .sort((a, b) => (b.c.popularity || 0) - (a.c.popularity || 0))
        .slice(0, 30)
        .map(({ c, roles }) => ({ ...normalizeTmdb(c, c.media_type), role: [...roles].join(", ") }));
    };
    const crewJobs = ["Director", "Creator", "Writer", "Screenplay", "Executive Producer"];
    return {
      id: data.id,
      name: data.name,
      department: data.known_for_department || "",
      biography: (data.biography || "").trim(),
      birthday: data.birthday || "",
      deathday: data.deathday || "",
      placeOfBirth: data.place_of_birth || "",
      photo: data.profile_path ? `https://image.tmdb.org/t/p/w500${data.profile_path}` : "",
      acting: pick(data.combined_credits?.cast, (c) => c.character || ""),
      crew: pick(
        (data.combined_credits?.crew || []).filter((c) => crewJobs.includes(c.job)),
        (c) => c.job,
      ),
    };
  }
  // Candidates for "For you". TMDB (movies/series) and AniList (anime) are separate pools:
  // TMDB is searched by keyword id and by TMDB's own recommendations for titles you liked,
  // AniList by tag name. Each candidate carries the keywords/tags it was found through.
  async function foryou(kind, profile = {}) {
    const keywords = (profile.keywords || []).slice(0, 6);
    if (kind === "anime") {
      const tags = keywords.map((k) => k.name).filter(Boolean);
      const ids = tags.map((_, i) => i);
      const vars = Object.fromEntries(tags.map((t, i) => [`t${i}`, t]));
      const query = tags.length
        ? `query (${ids.map((i) => `$t${i}: String`).join(", ")}) { ${ids
            .map(
              (i) =>
                `a${i}: Page(page: 1, perPage: 16) { media(type: ANIME, isAdult: false, tag: $t${i}, sort: POPULARITY_DESC, averageScore_greater: 62) { ${animeFields} } }`,
            )
            .join(" ")} }`
        : `query { a0: Page(page: 1, perPage: 24) { media(type: ANIME, isAdult: false, sort: SCORE_DESC, popularity_greater: 40000) { ${animeFields} } } }`;
      const data = await anilist(query, vars);
      const found = new Map();
      Object.entries(data).forEach(([alias, pageData], i) => {
        const tag = tags[Number(alias.slice(1))];
        for (const m of pageData?.media || []) {
          if (!m.idMal) continue;
          const hit = found.get(m.idMal) || { ...normalizeAnilist(m), matched: [] };
          if (tag && !hit.matched.includes(tag)) hit.matched.push(tag);
          found.set(m.idMal, hit);
        }
      });
      return { results: [...found.values()].slice(0, 80) };
    }
    if (!["movie", "tv"].includes(kind)) throw new ApiError("Invalid type.", 400);
    if (!token) throw new ApiError("Connect TMDB to get live suggestions.", 503);
    const found = new Map();
    const add = (item, extra) => {
      if (!item.poster_path) return;
      const hit = found.get(item.id) || { ...normalizeTmdb(item, kind), matched: [], seed: "" };
      if (extra.keyword && !hit.matched.includes(extra.keyword)) hit.matched.push(extra.keyword);
      if (extra.seed && !hit.seed) hit.seed = extra.seed;
      found.set(item.id, hit);
    };
    const jobs = [];
    for (const k of keywords.filter((k) => k.id))
      jobs.push(
        tmdb(`discover/${kind}`, {
          with_keywords: String(k.id),
          sort_by: "popularity.desc",
          "vote_count.gte": "150",
          "vote_average.gte": "6.2",
        }).then((d) => (d.results || []).forEach((r) => add(r, { keyword: k.name }))),
      );
    for (const seed of (profile.seeds || []).slice(0, 4))
      jobs.push(
        tmdb(`${kind}/${seed.id}/recommendations`).then((d) =>
          (d.results || []).slice(0, 12).forEach((r) => add(r, { seed: seed.title })),
        ),
      );
    if (!jobs.length)
      jobs.push(
        tmdb(`discover/${kind}`, {
          sort_by: "vote_average.desc",
          "vote_count.gte": "2000",
        }).then((d) => (d.results || []).forEach((r) => add(r, {}))),
      );
    await Promise.allSettled(jobs);
    return { results: [...found.values()].slice(0, 80) };
  }
  return { catalog, detail, availability, season, person, foryou, configured: Boolean(token) };
}
