// In-memory DOM integration tests. These do not claim visual/browser verification.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { createCatalog } from "../server/catalog.js";
import { setTimeout as delay } from "node:timers/promises";

test("app interactions: discovery filters, diary, goals, collections, bulk edit and recommendation views", async (t) => {
  const window = new Window({
    url: "http://localhost:3000/#discover",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  window.document.write(
    await readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  );
  window.document.querySelectorAll("script,link").forEach((el) => el.remove());
  const previous = {};
  for (const key of [
    "window",
    "document",
    "location",
    "localStorage",
    "matchMedia",
    "FormData",
    "setTimeout",
    "clearTimeout",
  ]) {
    previous[key] = globalThis[key];
    globalThis[key] = ["matchMedia", "setTimeout", "clearTimeout"].includes(key)
      ? window[key].bind(window)
      : window[key];
  }
  const originalFetch = globalThis.fetch,
    cat = createCatalog();
  globalThis.fetch = async (path) => {
    const url = new URL(path, "http://localhost:3000");
    if (url.pathname === "/api/config")
      return Response.json({ tmdbConfigured: false, animeAvailable: true });
    if (url.pathname === "/api/catalog")
      return Response.json(
        await cat.catalog(Object.fromEntries(url.searchParams)),
      );
    const match = url.pathname.match(/^\/api\/title\/(\w+)\/(\w+)\/(\d+)$/);
    if (match)
      return Response.json(
        await cat.detail(
          match[1],
          match[2],
          Number(match[3]),
          url.searchParams.get("mode") || "demo",
        ),
      );
    return Response.json(
      { error: "Mock endpoint not available" },
      { status: 503 },
    );
  };
  const originalAdd = globalThis.addEventListener;
  // Native dialog layout is outside a virtual DOM's scope; model its open/close events.
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
    for (const key of Object.keys(previous))
      if (previous[key] === undefined) delete globalThis[key];
      else globalThis[key] = previous[key];
    if (originalAdd) globalThis.addEventListener = originalAdd;
  });
  const doc = window.document,
    settle = () => delay(20);
  const click = (selector) => {
    const el = doc.querySelector(selector);
    assert.ok(el, `Missing control ${selector}`);
    el.click();
  };
  const change = (selector, value) => {
    const el = doc.querySelector(selector);
    assert.ok(el, `Missing field ${selector}`);
    el.value = value;
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const navigate = async (hash) => {
    window.location.hash = hash;
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await settle();
  };
  const submit = (selector) =>
    doc
      .querySelector(selector)
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
  await import("../public/js/app.js");
  await settle();
  assert.equal(doc.querySelectorAll("#main .title-card").length, 24);
  assert.ok(doc.querySelector('a[href="#dashboard"]'));
  change("#discovery-genre", "Crime");
  await settle();
  assert.equal(doc.querySelectorAll("#main .title-card").length, 3);
  click('[data-action="clear-filters"]');
  await settle();
  assert.equal(doc.querySelectorAll("#main .title-card").length, 24);
  click('[data-action="card-save"][data-key="tmdb:movie:335984"]');
  await settle();
  click('[data-action="detail"][data-key="tmdb:movie:335984"]');
  await settle();
  assert.ok(doc.querySelector(".related-grid .title-card"));
  change("#detail-priority", "high");
  change("#detail-tags", "neon, masterpiece");
  click('[data-action="log-watch"]');
  await settle();
  doc.querySelector('#watch-log-form [name="date"]').value = "2020-01-01";
  doc.querySelector('#watch-log-form [name="notes"]').value =
    "A memorable first watch.";
  submit("#watch-log-form");
  await settle();
  const saved = JSON.parse(
    window.localStorage.getItem("movie-world.library.v1"),
  );
  assert.equal(saved.diary.length, 1);
  assert.equal(saved.entries["tmdb:movie:335984"].priority, "high");
  assert.deepEqual(saved.entries["tmdb:movie:335984"].tags, [
    "neon",
    "masterpiece",
  ]);
  assert.equal(saved.entries["tmdb:movie:335984"].status, "completed");
  click('[data-action="close-detail"]');
  await navigate("dashboard");
  assert.match(doc.querySelector("#main").textContent, /Your screen life/);
  click('[data-action="edit-goal"]');
  doc.querySelector("#goal-form input").value = "12";
  submit("#goal-form");
  await settle();
  assert.equal(
    JSON.parse(window.localStorage.getItem("movie-world.library.v1")).goal,
    12,
  );
  await navigate("diary");
  assert.match(
    doc.querySelector("#main").textContent,
    /A memorable first watch/,
  );
  await navigate("collections");
  assert.equal(doc.querySelectorAll(".collection-tile").length, 3);
  await navigate("library");
  click('[data-action="toggle-selection"]');
  const check = doc.querySelector("[data-selection]");
  check.checked = true;
  check.dispatchEvent(new window.Event("change", { bubbles: true }));
  click('[data-action="bulk-edit"]');
  doc.querySelector('#bulk-form [name="folder"]').value = "next-up";
  submit("#bulk-form");
  await settle();
  assert.ok(
    JSON.parse(window.localStorage.getItem("movie-world.library.v1")).entries[
      "tmdb:movie:335984"
    ].folders.includes("next-up"),
  );
  click('[data-action="list-view"]');
  assert.ok(doc.querySelector(".title-grid.list-view"));
  await navigate("calendar");
  assert.ok(doc.querySelectorAll(".calendar-day").length >= 28);
  await navigate("recommendations");
  assert.ok(doc.querySelector(".recommendation-grid .title-card"));
  await navigate('watched');assert.equal(doc.querySelectorAll('#main .title-card').length,1);
  click('[data-action="queue-rewatch"][data-key="tmdb:movie:335984"]');
  await navigate('rewatch');assert.equal(doc.querySelectorAll('#main .title-card').length,1);
  await navigate('discover');
  let hide=doc.querySelector('#hide-watched');hide.checked=true;hide.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(doc.querySelectorAll('#main .title-card').length,23);
  assert.equal(doc.querySelector('#main [data-action="detail"][data-key="tmdb:movie:335984"]'),null);
  hide=doc.querySelector('#hide-watched');hide.checked=false;hide.dispatchEvent(new window.Event('change',{bubbles:true}));
  click('[data-action="mark-watched"][data-key="tmdb:movie:27205"]');
  assert.equal(JSON.parse(window.localStorage.getItem('movie-world.library.v1')).entries['tmdb:movie:27205'].watched,true);
  assert.equal(JSON.parse(window.localStorage.getItem('movie-world.library.v1')).diary.length,1,'Marking watched must not invent a watch date');
});
