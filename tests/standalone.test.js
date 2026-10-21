// In-memory DOM test of the no-server mode: the app finds no /api/config, answers its own API calls, and the
// TMDB token is pasted, tested and saved in Settings. Kept in its own file because app.js can only be loaded once
// per process (it binds to the window that exists at import time).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { setTimeout as delay } from "node:timers/promises";

test("standalone mode: demo works, the token form saves a token and live requests carry it", async (t) => {
  const window = new Window({
    url: "http://localhost:3000/#discover",
    settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
  });
  window.document.write(await readFile(new URL("../public/index.html", import.meta.url), "utf8"));
  window.document.querySelectorAll("script,link").forEach((el) => el.remove());
  const previous = {};
  for (const key of ["window", "document", "location", "localStorage", "matchMedia", "FormData", "setTimeout", "clearTimeout"]) {
    previous[key] = globalThis[key];
    globalThis[key] = ["matchMedia", "setTimeout", "clearTimeout"].includes(key) ? window[key].bind(window) : window[key];
  }
  const originalFetch = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (path, init) => {
    const url = new URL(String(path), "http://localhost:3000");
    calls.push({ url: String(path), auth: init?.headers?.Authorization });
    // No server: the app's own address answers with a web page, not JSON.
    if (url.origin === "http://localhost:3000") return new Response("<html></html>", { status: 404 });
    if (url.pathname === "/3/authentication")
      return init.headers.Authorization === "Bearer secret-token" ? Response.json({ success: true }) : Response.json({}, { status: 401 });
    if (url.hostname === "graphql.anilist.co")
      return Response.json({ data: { Page: { pageInfo: { lastPage: 1, total: 0 }, media: [] } } });
    return Response.json({ results: [], total_pages: 1, total_results: 0 });
  };
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event("close"));
  };
  t.after(async () => {
    await window.happyDOM.abort();
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(previous)) if (previous[key] === undefined) delete globalThis[key];
    else globalThis[key] = previous[key];
  });
  const doc = window.document,
    settle = () => delay(40);

  await import("../public/js/app.js");
  await settle();
  await settle();
  assert.equal(doc.querySelectorAll("#main .title-card").length, 24, "the demo catalogue works with no server");

  doc.querySelector('.topbar [data-action="settings"]').click();
  await settle();
  const field = doc.querySelector("#tmdb-token");
  assert.ok(field, "Settings offers a token field when there is no server");
  assert.equal(doc.querySelector(".connection-pill").textContent.trim(), "Key needed");

  field.value = "wrong";
  doc.querySelector('[data-action="test-token"]').click();
  await settle();
  assert.match(doc.querySelector("#token-status").textContent, /rejected/);
  assert.equal(window.localStorage.getItem("movie-world.tmdb-token"), null, "testing does not save");

  field.value = "secret-token";
  doc.querySelector('[data-action="test-token"]').click();
  await settle();
  assert.match(doc.querySelector("#token-status").textContent, /accepted/);
  doc.querySelector('[data-action="save-token"]').click();
  await settle();
  assert.equal(window.localStorage.getItem("movie-world.tmdb-token"), "secret-token");
  assert.equal(doc.querySelector(".connection-pill").textContent.trim(), "Connected");
  assert.ok(!window.localStorage.getItem("movie-world.library.v1")?.includes("secret-token"), "the token stays out of the library");

  // Switching to Live now asks TMDB directly, with the pasted token.
  const select = doc.querySelector("#mode-select");
  select.value = "live";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await delay(150);
  const tmdb = calls.find((c) => c.url.startsWith("https://api.themoviedb.org/3/trending") || c.url.startsWith("https://api.themoviedb.org/3/discover"));
  assert.ok(tmdb, "a live catalogue request went straight to TMDB");
  assert.equal(tmdb.auth, "Bearer secret-token");
  assert.ok(!calls.some((c) => c.url.startsWith("/api/catalog")), "no request was sent to a server for the catalogue");
});
