import { test } from "node:test";
import assert from "node:assert/strict";
import { handleApi } from "../public/js/api-core.js";
import { createLocalApi, TOKEN_KEY } from "../public/js/local-api.js";
import { createCatalog } from "../public/js/catalog.js";
import { createApp } from "../server/index.js";

const call = (cat, path) => handleApi(new URL(path, "http://x"), cat);
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
};

test("the shared API routes and validates the same way for the server and the phone app", async () => {
  const cat = createCatalog();
  assert.deepEqual(await call(cat, "/api/config"), { tmdbConfigured: false, animeAvailable: true });
  assert.equal((await call(cat, "/api/catalog?kind=movie&mode=demo")).mode, "demo");
  assert.equal((await call(cat, "/api/title/tmdb/movie/335984?mode=demo")).title, "Blade Runner 2049");
  const fails = async (path, status) =>
    assert.rejects(() => call(cat, path), (e) => e.status === status, path);
  await fails("/api/catalog?page=0", 400);
  await fails("/api/catalog?genre=Drama,Nope", 400);
  await fails("/api/catalog?yearFrom=2020&yearTo=2010", 400);
  await fails("/api/title/tmdb/movie/x", 400);
  await fails("/api/availability/movie/1?region=XX", 400);
  await fails("/api/foryou?kind=movie&profile=%7Bbad", 400);
  await fails("/api/person/abc", 400);
  await fails("/api/season/1/999", 400);
  await fails("/api/nothing", 404);
});

test("the server returns exactly what the shared API returns", async (t) => {
  const server = createApp();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`,
    cat = createCatalog();
  for (const path of ["/api/config", "/api/catalog?kind=tv&mode=demo&sort=rating", "/api/title/tmdb/movie/335984?mode=demo"])
    assert.deepEqual(await (await fetch(base + path)).json(), await call(cat, path), path);
  const bad = await fetch(base + "/api/catalog?page=0");
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, "Invalid search parameters.");
});

test("the in-app adapter works without a server and uses the pasted token", async () => {
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization });
    if (String(url).includes("/authentication"))
      return init.headers.Authorization === "Bearer good"
        ? Response.json({ success: true })
        : Response.json({}, { status: 401 });
    return Response.json({ results: [], total_pages: 1, total_results: 0 });
  };
  const storage = memory(),
    api = createLocalApi(storage, fetcher);
  assert.deepEqual(await api.request("/api/config"), { tmdbConfigured: false, animeAvailable: true });
  await assert.rejects(() => api.request("/api/catalog?mode=live&kind=movie"), (e) => e.status === 503);
  assert.equal((await api.request("/api/catalog?mode=demo")).total, 24, "demo works with no token");

  api.setToken("  good  ");
  assert.equal(storage.data.get(TOKEN_KEY), "good", "the token is trimmed and stored on the device");
  assert.equal((await api.request("/api/config")).tmdbConfigured, true);
  await api.request("/api/catalog?mode=live&kind=movie");
  assert.equal(seen.at(-1).auth, "Bearer good");
  assert.match(seen.at(-1).url, /^https:\/\/api\.themoviedb\.org\/3\/discover\/movie/);

  // A fresh start reads the stored token; removing it takes TMDB features away again.
  assert.equal(createLocalApi(storage, fetcher).getToken(), "good");
  api.setToken("");
  assert.equal(storage.data.has(TOKEN_KEY), false);
  await assert.rejects(() => api.request("/api/catalog?mode=live&kind=tv"), (e) => e.status === 503);

  assert.equal((await api.testToken("good")).ok, true);
  const rejected = await api.testToken("short-api-key");
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /rejected/);
  assert.equal((await api.testToken("  ")).ok, false);
  const offline = await createLocalApi(storage, async () => Promise.reject(new Error("net"))).testToken("x");
  assert.match(offline.message, /Could not reach TMDB/);
});
