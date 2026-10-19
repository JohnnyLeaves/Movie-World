import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.js";

test("HTTP server serves the app and API with validation and security headers", async (t) => {
  const server = createApp();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Movie World/);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.match(
    home.headers.get("content-security-policy"),
    /script-src 'self'/,
  );
  const config = await (await fetch(base + "/api/config")).json();
  assert.equal(config.animeAvailable, true);
  assert.ok(!("token" in config));
  const search = await (await fetch(base + "/api/catalog?query=blade")).json();
  assert.equal(search.results[0].id, 335984);
  assert.equal((await fetch(base + "/api/catalog?page=-1")).status, 400);
  assert.equal((await fetch(base + "/api/catalog?kind=person")).status, 400);
  assert.equal((await fetch(base + "/api/title/tmdb/movie/nope")).status, 400);
  assert.equal((await fetch(base + "/api/unknown")).status, 404);
  assert.equal((await fetch(base + "/.env")).status, 404);
  assert.equal(
    (await fetch(base + "/api/catalog", { method: "POST" })).status,
    405,
  );
  assert.equal(
    (await fetch(base + "/js/app.js")).headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assert.equal((await fetch(base + "/..%2f..%2fpackage.json")).status, 403);
});
