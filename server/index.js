import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createCatalog, ApiError } from "./catalog.js";
import { GENRES } from "../public/js/catalog-filters.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
export function createApp({
  catalog = createCatalog({ token: process.env.TMDB_READ_TOKEN?.trim() }),
} = {}) {
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://image.tmdb.org https://cdn.myanimelist.net https://s1.anilist.co https://s2.anilist.co https://s3.anilist.co https://s4.anilist.co data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.setHeader("Allow", "GET, HEAD");
        return json(405, { error: "Method not allowed." });
      }
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/config")
        return json(200, {
          tmdbConfigured: catalog.configured,
          animeAvailable: true,
        });
      if (url.pathname === "/api/catalog") {
        const kind = url.searchParams.get("kind") || "all",
          mode = url.searchParams.get("mode") || "demo",
          query = (url.searchParams.get("query") || "").trim(),
          page = Number(url.searchParams.get("page") || 1),
          sort = url.searchParams.get("sort") || "popular",
          genre = url.searchParams.get("genre") || "",
          year = url.searchParams.get("year") || "",
          minScore = Number(url.searchParams.get("minScore") || 0);
        if (
          !["all", "movie", "tv", "anime"].includes(kind) ||
          !["live", "demo"].includes(mode) ||
          !["popular", "rating", "newest"].includes(sort) ||
          !Number.isInteger(page) ||
          page < 1 ||
          page > 500 ||
          query.length > 150 ||
          (genre && !GENRES.includes(genre)) ||
          (year &&
            (!/^\d{4}$/.test(year) ||
              Number(year) < 1900 ||
              Number(year) > new Date().getFullYear() + 5)) ||
          !Number.isFinite(minScore) ||
          minScore < 0 ||
          minScore > 10
        )
          throw new ApiError("Invalid search parameters.", 400);
        return json(
          200,
          await catalog.catalog({
            kind,
            mode,
            query,
            page,
            sort,
            genre,
            year,
            minScore,
          }),
        );
      }
      if (url.pathname.startsWith("/api/title/")) {
        const match = url.pathname.match(
          /^\/api\/title\/(tmdb|jikan)\/(movie|tv|anime)\/(\d+)$/,
        );
        if (!match) throw new ApiError("Invalid title.", 400);
        const mode = url.searchParams.get("mode") || "live";
        if (!["live", "demo"].includes(mode))
          throw new ApiError("Invalid mode.", 400);
        return json(
          200,
          await catalog.detail(match[1], match[2], Number(match[3]), mode),
        );
      }
      if (url.pathname.startsWith("/api/availability/")) {
        const match = url.pathname.match(
            /^\/api\/availability\/(movie|tv)\/(\d+)$/,
          ),
          region = url.searchParams.get("region") || "PT";
        if (
          !match ||
          !["PT", "US", "GB", "ES", "FR", "DE", "JP", "BR"].includes(region)
        )
          throw new ApiError("Invalid availability request.", 400);
        return json(
          200,
          await catalog.availability(match[1], Number(match[2]), region),
        );
      }
      if (url.pathname.startsWith("/api/season/")) {
        const match = url.pathname.match(/^\/api\/season\/(\d+)\/(\d+)$/);
        if (!match || Number(match[2]) > 200)
          throw new ApiError("Invalid season.", 400);
        return json(
          200,
          await catalog.season(Number(match[1]), Number(match[2])),
        );
      }
      if (url.pathname.startsWith("/api/"))
        return json(404, { error: "Endpoint not found." });
      const decoded = decodeURIComponent(url.pathname);
      const file = resolve(
        publicDir,
        `.${decoded === "/" ? "/index.html" : decoded}`,
      );
      if (!file.startsWith(resolve(publicDir) + sep))
        return json(403, { error: "Forbidden." });
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR")
        return json(404, { error: "File not found." });
      json(error.status || 500, {
        error: error.status
          ? error.message
          : "An unexpected error occurred. Please try again.",
      });
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "127.0.0.1";
  const server = createApp();
  server.listen(port, host, () =>
    console.log(`Movie World is ready at http://${host}:${port}`),
  );
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is busy. Set PORT in .env to another port.`
        : error.message,
    );
    process.exitCode = 1;
  });
}
