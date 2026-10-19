import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog, normalizeTmdb } from "../server/catalog.js";
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
      assert.equal(u.searchParams.get("primary_release_year"), "2017");
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
