import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createCatalog } from "../public/js/catalog.js";
import { handleApi } from "../public/js/api-core.js";

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
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://image.tmdb.org https://cdn.myanimelist.net https://s1.anilist.co https://s2.anilist.co https://s3.anilist.co https://s4.anilist.co data:; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'",
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
      if (url.pathname.startsWith("/api/"))
        return json(200, await handleApi(url, catalog));
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
      // A malformed %-escape in the path is a bad request for a file that cannot exist.
      if (error.code === "ENOENT" || error.code === "EISDIR" || error instanceof URIError)
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
