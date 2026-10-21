import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog, normalizeTmdb } from "../public/js/catalog.js";
import { createApp } from "../server/index.js";

test("demo genre, release year and score filters work together before pagination", async () => {
  const data = await createCatalog().catalog({
    kind: "movie",
    genre: "Sci-Fi",
    year: "2017",
    minScore: 8,
  });
  assert.equal(data.total, 1);
  assert.equal(data.results[0].title, "Blade Runner 2049");
});
test("TMDB discovery forwards catalogue-wide filtering to the provider", async () => {
  const cat = createCatalog({
    token: "secret",
    fetcher: async (url) => {
      const u = new URL(url);
      assert.equal(u.searchParams.get("with_genres"), "878");
      assert.equal(u.searchParams.get("primary_release_date.gte"), "2017-01-01");
      assert.equal(u.searchParams.get("primary_release_date.lte"), "2017-12-31");
      assert.equal(u.searchParams.get("vote_average.gte"), "8");
      return Response.json({ results: [], total_pages: 1, total_results: 0 });
    },
  });
  await cat.catalog({
    kind: "movie",
    mode: "live",
    genre: "Sci-Fi",
    year: "2017",
    minScore: 8,
  });
});
test("availability groups subscription/rental offers and rejects untrusted outbound links", async () => {
  const cat = createCatalog({
    token: "secret",
    fetcher: async (url) => {
      assert.match(url, /movie\/335984\/watch\/providers/);
      return Response.json({
        results: {
          PT: {
            link: "https://evil.example/",
            flatrate: [
              {
                provider_id: 1,
                provider_name: "Example service",
                logo_path: "/logo.jpg",
              },
            ],
            rent: [{ provider_id: 2, provider_name: "Rental" }],
          },
        },
      });
    },
  });
  const data = await cat.availability("movie", 335984, "PT");
  assert.equal(data.region, "PT");
  assert.equal(data.stream[0].name, "Example service");
  assert.equal(data.rent.length, 1);
  assert.equal(data.link, null);
});
test("season details expose real episode numbers, dates and summaries", async () => {
  const cat = createCatalog({
    token: "secret",
    fetcher: async () =>
      Response.json({
        name: "Season 1",
        episodes: [
          {
            id: 1,
            episode_number: 1,
            name: "Pilot",
            air_date: "2020-01-01",
            overview: "Episode summary",
            runtime: 45,
          },
        ],
      }),
  });
  const season = await cat.season(1, 1);
  assert.equal(season.episodes[0].number, 1);
  assert.equal(season.episodes[0].runtime, 45);
});
test("rich title normalization includes recommendations, seasons and next episode metadata", () => {
  const t = normalizeTmdb(
    {
      id: 1,
      name: "Series",
      seasons: [{ season_number: 1, name: "Season one", episode_count: 8 }],
      next_episode_to_air: { air_date: "2026-12-01", name: "Next" },
      recommendations: {
        results: [{ id: 2, name: "Related", media_type: "tv" }],
      },
    },
    "tv",
  );
  assert.equal(t.seasonList[0].episodes, 8);
  assert.equal(t.nextAirDate, "2026-12-01");
  assert.equal(t.recommendations[0].key, "tmdb:tv:2");
});
test("new API routes validate input and require configured TMDB for protected provider calls", async (t) => {
  const server = createApp();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const query of [
    "genre=Invalid",
    "year=1",
    "minScore=99",
    "minScore=nope",
  ])
    assert.equal((await fetch(`${base}/api/catalog?${query}`)).status, 400);
  assert.equal(
    (await fetch(`${base}/api/availability/movie/1?region=XX`)).status,
    400,
  );
  assert.equal((await fetch(`${base}/api/season/1/999`)).status, 400);
  assert.equal((await fetch(`${base}/api/season/1/1`)).status, 503);
});
test("airing filter maps to TMDB status/air-date and AniList status variables", async () => {
  const seen = [];
  const cat = createCatalog({
    token: "secret",
    clock: () => Date.parse("2026-06-15T00:00:00Z"),
    fetcher: async (url, init) => {
      seen.push(init?.body ? JSON.parse(init.body).variables : new URL(url).searchParams);
      return Response.json({ results: [], total_pages: 1, total_results: 0, data: { Page: { pageInfo: {}, media: [] } } });
    },
  });
  await cat.catalog({ kind: "tv", mode: "live", airing: "airing" });
  assert.equal(seen[0].get("with_status"), "0");
  assert.equal(seen[0].get("air_date.gte"), "2026-06-01");
  await cat.catalog({ kind: "tv", mode: "live", airing: "ended" });
  assert.equal(seen[1].get("with_status"), "3|4");
  await cat.catalog({ kind: "anime", mode: "live", airing: "new" });
  assert.deepEqual(seen[2].status, ["RELEASING", "FINISHED"]);
  assert.equal(seen[2].startAfter, 20250615);
});

test("several genres, a year range and a decimal score reach TMDB and AniList as provider filters", async () => {
  const seen = [];
  const cat = createCatalog({
    token: "secret",
    clock: () => Date.parse("2026-06-15T00:00:00Z"),
    fetcher: async (url, init) => {
      seen.push(init?.body ? JSON.parse(init.body).variables : new URL(url).searchParams);
      return Response.json({ results: [], total_pages: 1, total_results: 0, data: { Page: { pageInfo: {}, media: [] } } });
    },
  });
  await cat.catalog({ kind: "tv", mode: "live", genre: "Drama,Crime", yearFrom: "2010", yearTo: "2019", minScore: 7.5 });
  assert.equal(seen[0].get("with_genres"), "18,80");
  assert.equal(seen[0].get("first_air_date.gte"), "2010-01-01");
  assert.equal(seen[0].get("first_air_date.lte"), "2019-12-31");
  assert.equal(seen[0].get("vote_average.gte"), "7.5");
  await cat.catalog({ kind: "anime", mode: "live", genre: "Action,Comedy", yearFrom: "2000", yearTo: "2009" });
  assert.deepEqual(seen[1].genre, ["Action", "Comedy"]);
  assert.equal(seen[1].startAfter, 19991231);
  assert.equal(seen[1].startBefore, 20100101);
});
test("matchesFilters needs every genre and honours the year range", async () => {
  const { matchesFilters } = await import("../public/js/catalog-filters.js");
  const t = { genres: ["Drama", "Crime"], year: 2015, score: 8 };
  assert.ok(matchesFilters(t, { genres: ["Drama", "Crime"], yearFrom: 2010, yearTo: 2019, minScore: 7.5 }));
  assert.ok(!matchesFilters(t, { genres: ["Drama", "Comedy"] }));
  assert.ok(!matchesFilters(t, { yearFrom: 2016 }));
  assert.ok(!matchesFilters(t, { yearTo: 2014 }));
  assert.ok(matchesFilters(t, { genre: "Drama,Crime", year: 2015 }));
});

test("AniList is always asked for an explicit sort order", async () => {
  const sent = [];
  const cat = createCatalog({
    fetcher: async (url, init) => {
      sent.push(JSON.parse(init.body).variables.sort);
      return Response.json({ data: { Page: { pageInfo: {}, media: [] } } });
    },
  });
  for (const args of [{}, { sort: "rating" }, { sort: "newest" }, { sort: "newest", airing: "upcoming" }, { query: "naruto" }])
    await cat.catalog({ kind: "anime", mode: "live", page: 1 + sent.length, ...args });
  assert.deepEqual(sent, [["POPULARITY_DESC"], ["SCORE_DESC"], ["START_DATE_DESC"], ["START_DATE"], ["SEARCH_MATCH"]]);
});
