import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCatalog,
  normalizeTmdb,
  normalizeJikan,
  normalizeAnilist,
} from "../public/js/catalog.js";

test("demo search covers movie, TV and anime without making network calls", async () => {
  const cat = createCatalog({
    fetcher: () => {
      throw Error("Unexpected network request");
    },
  });
  const all = await cat.catalog();
  assert.equal(all.total, 24);
  for (const kind of ["movie", "tv", "anime"])
    assert.ok(
      (await cat.catalog({ kind })).results.every((t) => t.kind === kind),
    );
  assert.equal(
    (await cat.catalog({ query: "blade" })).results[0].title,
    "Blade Runner 2049",
  );
  const sorted = await cat.catalog({ sort: "rating" });
  assert.ok(sorted.results[0].score >= sorted.results[1].score);
  assert.equal((await cat.catalog({ query: "no-match-at-all" })).total, 0);
});
test("missing TMDB token produces actionable error; anime remains accessible", async () => {
  const cat = createCatalog({
    fetcher: async () =>
      Response.json({ data: [], pagination: { last_visible_page: 1 } }),
  });
  await assert.rejects(
    cat.catalog({ mode: "live", kind: "movie" }),
    /TMDB Read Access Token/,
  );
  assert.equal(
    (await cat.catalog({ mode: "live", kind: "anime" })).results.length,
    0,
  );
});
test("TMDB token stays in the Authorization header and responses are cached", async () => {
  let calls = 0;
  const cat = createCatalog({
    token: "server-secret",
    fetcher: async (url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, "Bearer server-secret");
      assert.ok(!url.includes("server-secret"));
      return Response.json({
        results: [
          {
            id: 1,
            title: "A Movie",
            release_date: "2024-01-01",
            vote_average: 8,
          },
        ],
        total_pages: 1,
        total_results: 1,
      });
    },
  });
  const first = await cat.catalog({ mode: "live", kind: "movie" });
  await cat.catalog({ mode: "live", kind: "movie" });
  assert.equal(calls, 1);
  assert.equal(first.results[0].year, 2024);
  assert.ok(!JSON.stringify(first).includes("server-secret"));
});
test("combined search retains available provider results on partial outage", async () => {
  const cat = createCatalog({
    token: "token",
    fetcher: async (url) =>
      url.includes("jikan")
        ? new Response("", { status: 503 })
        : Response.json({
            results: [
              { id: 1, media_type: "movie", title: "Surviving result" },
            ],
            total_results: 1,
            total_pages: 1,
          }),
  });
  const result = await cat.catalog({ mode: "live", query: "test" });
  assert.equal(result.results.length, 1);
  assert.ok(result.warning);
});
test("upstream rate limits and invalid credentials have safe, actionable errors", async () => {
  for (const status of [401, 429]) {
    const cat = createCatalog({
      token: "sensitive",
      fetcher: async () => new Response("", { status }),
    });
    await assert.rejects(
      cat.catalog({ mode: "live", kind: "movie" }),
      status === 429 ? /rate limit/ : /rejected the token/,
    );
  }
});
test("provider normalization handles incomplete metadata", () => {
  const t = normalizeTmdb({ id: 3, name: "Series" }, "tv");
  assert.equal(t.kind, "tv");
  assert.equal(t.year, null);
  assert.equal(t.poster, "");
  const a = normalizeJikan({ mal_id: 1, title: "Anime" });
  assert.equal(a.key, "jikan:anime:1");
  assert.equal(a.episodes, null);
});
test("demo title details are addressable with the same stable ID as live data", async () => {
  const t = await createCatalog().detail("tmdb", "movie", 335984, "demo");
  assert.equal(t.key, "tmdb:movie:335984");
  await assert.rejects(
    createCatalog().detail("tmdb", "movie", 999999, "demo"),
    /not found/,
  );
});
test("AniList provides keyless anime search with stable MyAnimeList identities", async () => {
  let seen = 0;
  const cat = createCatalog({
    fetcher: async (url, options) => {
      seen++;
      assert.equal(url, "https://graphql.anilist.co");
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(JSON.parse(options.body).variables.search, "Cowboy");
      return Response.json({
        data: {
          Page: {
            pageInfo: { total: 1, lastPage: 1 },
            media: [
              {
                idMal: 1,
                title: { english: "Cowboy Bebop" },
                averageScore: 86,
                startDate: { year: 1998 },
              },
            ],
          },
        },
      });
    },
  });
  const result = await cat.catalog({
    mode: "live",
    kind: "anime",
    query: "Cowboy",
  });
  assert.equal(result.results[0].key, "jikan:anime:1");
  assert.equal(result.results[0].provider, "anilist");
  assert.equal(result.results[0].score, 8.6);
  assert.equal(seen, 1);
});
test("AniList descriptions are normalized as plain text", () => {
  const t = normalizeAnilist({
    idMal: 1,
    title: { romaji: "Test" },
    description: "<b>A story</b><br>of hope &amp; courage.",
  });
  assert.equal(t.overview, "A story\nof hope & courage.");
});

test("for-you candidates are found per provider by keyword/tag and by similar titles", async () => {
  const calls = [];
  const cat = createCatalog({
    token: "secret",
    fetcher: async (url, init) => {
      const u = new URL(url);
      calls.push(init?.body ? "anilist" : u.pathname);
      if (init?.body)
        return Response.json({
          data: {
            a0: { media: [{ idMal: 7, title: { romaji: "Loop" }, genres: [], tags: [{ name: "Time Loop", rank: 90 }] }] },
          },
        });
      if (u.pathname.endsWith("/discover/tv"))
        return Response.json({ results: [{ id: 1, name: "A", poster_path: "/a.jpg", genre_ids: [] }] });
      if (u.pathname.endsWith("/recommendations"))
        return Response.json({ results: [{ id: 1, name: "A", poster_path: "/a.jpg", genre_ids: [] }, { id: 2, name: "B", poster_path: "/b.jpg", genre_ids: [] }, { id: 3, name: "NoPoster", genre_ids: [] }] });
      throw Error("unexpected " + url);
    },
  });
  const tv = await cat.foryou("tv", { keywords: [{ id: 99, name: "heist" }], seeds: [{ id: 5, title: "Seed Show" }] });
  const a = tv.results.find((t) => t.id === 1);
  assert.deepEqual(a.matched, ["heist"]);
  assert.equal(a.seed, "Seed Show");
  assert.equal(tv.results.find((t) => t.id === 2).seed, "Seed Show");
  assert.ok(!tv.results.some((t) => t.id === 3), "titles without artwork are skipped");
  const anime = await cat.foryou("anime", { keywords: [{ name: "Time Loop" }] });
  assert.deepEqual(anime.results[0].matched, ["Time Loop"]);
  assert.deepEqual(anime.results[0].keywords, [{ name: "Time Loop" }]);
  await assert.rejects(() => cat.foryou("person", {}), /Invalid type/);
});

test("person profiles merge duplicate credits and keep roles, newest data first by popularity", async () => {
  const cat = createCatalog({
    token: "secret",
    fetcher: async () =>
      Response.json({
        id: 9, name: "Pat", known_for_department: "Acting", biography: " Bio ", birthday: "1990-01-02", profile_path: "/p.jpg",
        combined_credits: {
          cast: [
            { id: 1, media_type: "tv", name: "Show", poster_path: "/s.jpg", character: "Ann", popularity: 5 },
            { id: 2, media_type: "movie", title: "Film", poster_path: "/f.jpg", character: "Bo", popularity: 9 },
            { id: 3, media_type: "tv", name: "NoArt", character: "X", popularity: 99 },
          ],
          crew: [
            { id: 2, media_type: "movie", title: "Film", poster_path: "/f.jpg", job: "Director", popularity: 9 },
            { id: 2, media_type: "movie", title: "Film", poster_path: "/f.jpg", job: "Writer", popularity: 9 },
            { id: 4, media_type: "movie", title: "Gaffer", poster_path: "/g.jpg", job: "Gaffer", popularity: 9 },
          ],
        },
      }),
  });
  const p = await cat.person(9);
  assert.equal(p.biography, "Bio");
  assert.deepEqual(p.acting.map((t) => t.title), ["Film", "Show"]);
  assert.equal(p.crew.length, 1);
  assert.equal(p.crew[0].role, "Director, Writer");
  assert.match(p.photo, /w500\/p\.jpg$/);
});
