import { test } from "node:test";
import assert from "node:assert/strict";
import { demoTitles } from "../server/demo.js";

test("offline worker serves filtered demo data and never caches live API responses", async (t) => {
  const original = {
    self: globalThis.self,
    caches: globalThis.caches,
    fetch: globalThis.fetch,
  };
  const handlers = {},
    store = new Map();
  const key = (request) =>
    new URL(
      typeof request === "string" ? request : request.url,
      "http://localhost",
    ).href;
  const cache = {
    async addAll(urls) {
      for (const url of urls)
        store.set(
          key(url),
          url === "/api/catalog?mode=demo"
            ? Response.json({ results: demoTitles })
            : new Response("cached shell asset"),
        );
    },
    async match(request) {
      return store.get(key(request))?.clone();
    },
    async put(request, response) {
      store.set(key(request), response.clone());
    },
  };
  globalThis.self = {
    location: { origin: "http://localhost" },
    addEventListener: (name, fn) => (handlers[name] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  globalThis.caches = {
    open: async () => cache,
    keys: async () => ["movie-world-v2"],
    delete: async () => true,
  };
  globalThis.fetch = async () => {
    throw new TypeError("Simulated offline connection");
  };
  t.after(() => {
    for (const [name, value] of Object.entries(original))
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
  });
  await import("../public/sw.js");
  let installed;
  handlers.install({ waitUntil: (promise) => (installed = promise) });
  await installed;
  const request = async (path) => {
    let result;
    handlers.fetch({
      request: new Request(`http://localhost${path}`),
      respondWith: (promise) => (result = promise),
    });
    return result;
  };
  const response = await request(
    "/api/catalog?mode=demo&kind=movie&genre=Sci-Fi&year=2017&minScore=8",
  );
  const data = await response.json();
  assert.equal(data.total, 1);
  assert.equal(data.results[0].title, "Blade Runner 2049");
  const title = await (
    await request("/api/title/tmdb/movie/335984?mode=demo")
  ).json();
  assert.ok(title.recommendations.length);
  assert.equal((await request("/api/catalog?mode=live")).status, 503);
  assert.equal((await (await request("/api/config")).json()).offline, true);
  globalThis.fetch = async () =>
    Response.json({ results: [{ title: "Live response" }] });
  const live = await request("/api/catalog?mode=live");
  assert.equal(live.status, 200);
  assert.equal(store.has(key("/api/catalog?mode=live")), false);
});
