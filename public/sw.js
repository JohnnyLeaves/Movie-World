import { matchesFilters } from "./js/catalog-filters.js";
const CACHE = "movie-world-v7";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/experience.css",
  "/watch.css",
  "/theme.css",
  "/mobile.css",
  "/manifest.webmanifest",
  "/assets/icon.svg",
  "/assets/tmdb.svg",
  "/assets/spotlight.jpg",
  "/js/app.js",
  "/js/library.js",
  "/js/insights.js",
  "/js/experience.js",
  "/js/catalog-filters.js",
  "/js/select-menu.js",
];
const DEMO = "/api/catalog?mode=demo";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...SHELL, DEMO]);
      const catalogue = await (await cache.match(DEMO)).json();
      await cache.addAll(
        catalogue.results
          .map((t) => t.poster)
          .filter((path) => path.startsWith("/assets/")),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("movie-world-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
async function offlineApi(url, cache) {
  if (url.pathname === "/api/config")
    return Response.json({
      tmdbConfigured: false,
      animeAvailable: false,
      offline: true,
    });
  const demo = await cache.match(DEMO);
  if (!demo)
    return Response.json(
      {
        error:
          "Offline preview has not been cached yet. Reconnect and load the app once.",
      },
      { status: 503 },
    );
  const all = (await demo.json()).results;
  if (
    url.pathname === "/api/catalog" &&
    (url.searchParams.get("mode") || "demo") === "demo"
  ) {
    const kind = url.searchParams.get("kind") || "all",
      query = (url.searchParams.get("query") || "").toLowerCase(),
      sort = url.searchParams.get("sort"),
      page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    let results = all.filter(
      (t) =>
        (kind === "all" || t.kind === kind) &&
        `${t.title} ${t.genres.join(" ")} ${t.creator}`
          .toLowerCase()
          .includes(query) &&
        matchesFilters(t, Object.fromEntries(url.searchParams)),
    );
    if (sort === "rating") results.sort((a, b) => b.score - a.score);
    if (sort === "newest") results.sort((a, b) => b.year - a.year);
    return Response.json({
      results: results.slice((page - 1) * 24, page * 24),
      page,
      total: results.length,
      totalPages: Math.ceil(results.length / 24),
      mode: "demo",
      warning: "Offline preview. Your saved library remains available.",
    });
  }
  const match = url.pathname.match(
    /^\/api\/title\/(tmdb|jikan)\/(movie|tv|anime)\/(\d+)$/,
  );
  if (match && url.searchParams.get("mode") === "demo") {
    const title = all.find(
      (t) => t.key === `${match[1]}:${match[2]}:${match[3]}`,
    );
    if (title)
      return Response.json({
        ...title,
        recommendations: all
          .filter(
            (t) =>
              t.key !== title.key &&
              t.genres.some((g) => title.genres.includes(g)),
          )
          .slice(0, 6),
      });
  }
  return Response.json(
    {
      error:
        "You are offline. Your library and the demo catalogue work offline; live providers need a connection.",
    },
    { status: 503 },
  );
}
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Credentials, live catalogue results and personal library data are never cached here.
      try {
        const response = await fetch(event.request);
        if (
          response.ok &&
          !url.pathname.startsWith("/api/") &&
          SHELL.includes(url.pathname)
        )
          await cache.put(event.request, response.clone());
        return response;
      } catch {
        if (url.pathname.startsWith("/api/")) return offlineApi(url, cache);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return cache.match("/");
        return new Response("This resource is unavailable offline.", {
          status: 503,
        });
      }
    })(),
  );
});
