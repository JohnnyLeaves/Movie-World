// In-memory DOM integration tests. These do not claim visual/browser verification.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { createCatalog } from "../public/js/catalog.js";
import { setTimeout as delay } from "node:timers/promises";

test("app interactions: filters, rating, watched, collections, hide-watched, suggestions and the tonight game", async (t) => {
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
    settle = () => delay(20),
    state = () =>
      JSON.parse(window.localStorage.getItem("movie-world.library.v1")),
    cards = () => doc.querySelectorAll("#main .title-card").length;
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
  const tick = (selector, checked) => {
    const el = doc.querySelector(selector);
    assert.ok(el, `Missing checkbox ${selector}`);
    el.checked = checked;
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
  const BLADE = "tmdb:movie:335984",
    INCEPTION = "tmdb:movie:27205";
  await import("../public/js/app.js");
  await settle();

  // --- navigation and the discovery filters -------------------------------------------
  assert.equal(cards(), 24);
  assert.ok(doc.querySelector('a[href="#dashboard"]'));
  assert.ok(doc.querySelector('a[href="#upcoming"]'), "Upcoming is in the menu");
  assert.ok(doc.querySelector('a[href="#interested"]'));
  assert.equal(doc.querySelector('a[href="#diary"]'), null, "Watch diary left the menu");
  click('[data-action="filters-toggle"]');
  assert.ok(doc.querySelector("#filters-panel").classList.contains("open"));
  click('[data-action="filter-genre"][data-genre="Crime"]');
  await settle();
  assert.equal(cards(), 3);
  assert.equal(doc.querySelectorAll(".fchip").length, 1);
  click('[data-action="filter-remove"][data-kind="genre"]');
  await settle();
  assert.equal(cards(), 24);
  click('[data-action="filter-decade"][data-from="2010"]');
  await settle();
  assert.ok(cards() > 0 && cards() < 24);
  assert.match(doc.querySelector(".fchip").textContent, /2010.2019/);
  const slider = doc.querySelector("#filter-score");
  slider.value = "8";
  slider.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(doc.querySelectorAll(".fchip").length, 2);
  click('[data-action="clear-filters"]');
  await settle();
  assert.equal(cards(), 24);

  // --- save, rate, mark watched and queue a rewatch from the title view -----------------
  click(`[data-action="card-save"][data-key="${BLADE}"]`);
  await settle();
  assert.ok(state().entries[BLADE]);
  click(`[data-action="detail"][data-key="${BLADE}"]`);
  await settle();
  assert.ok(doc.querySelector(".related-grid .title-card"));
  assert.equal(doc.querySelector("#detail-dialog .watched-pct"), null, "movies have no episode percentage");
  click('#detail-dialog .star-rating .hit.r[data-value="8"]');
  await settle();
  assert.equal(state().entries[BLADE].rating, 8);
  click('#detail-dialog .star-rating .hit.r[data-value="8"]');
  await settle();
  assert.equal(state().entries[BLADE].rating, 0, "clicking the current rating clears it");
  click('#detail-dialog .star-rating .hit.l[data-value="7.5"]');
  await settle();
  assert.equal(state().entries[BLADE].rating, 7.5);
  assert.equal(doc.querySelector('#detail-dialog [data-action="queue-rewatch"]'), null, "rewatch needs a finished title");
  click('#detail-dialog [data-action="mark-watched"]');
  await settle();
  assert.equal(state().entries[BLADE].status, "completed");
  assert.equal(state().diary.length, 0, "Marking watched must not invent a watch date");
  click('#detail-dialog [data-action="queue-rewatch"]');
  await settle();
  assert.equal(state().entries[BLADE].rewatchQueued, true);
  click('[data-action="close-detail"]');

  // --- dashboard, diary page, collections, library tools, calendar, upcoming, suggestions -
  await navigate("dashboard");
  assert.match(doc.querySelector("#main").textContent, /Your screen life/);
  click('[data-action="edit-goal"]');
  doc.querySelector("#goal-form input").value = "12";
  submit("#goal-form");
  await settle();
  assert.equal(state().goal, 12);
  await navigate("diary");
  assert.match(doc.querySelector("#main").textContent, /watch diary/i);
  await navigate("collections");
  assert.equal(doc.querySelectorAll(".collection-tile").length, 3);
  await navigate("library");
  const statusFilter = doc.querySelector("#status-filter");
  assert.equal(statusFilter.value, "queue", "the Watchlist opens on want-to-watch and watching");
  assert.equal(cards(), 0, "a completed title is not in the default view");
  statusFilter.value = "all";
  statusFilter.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
  click('[data-action="toggle-selection"]');
  const check = doc.querySelector("[data-selection]");
  check.checked = true;
  check.dispatchEvent(new window.Event("change", { bubbles: true }));
  click('[data-action="bulk-edit"]');
  doc.querySelector('#bulk-form [name="folder"]').value = "next-up";
  submit("#bulk-form");
  await settle();
  assert.ok(state().entries[BLADE].folders.includes("next-up"));
  click('[data-action="list-view"]');
  assert.ok(doc.querySelector(".title-grid.list-view"));
  await navigate("calendar");
  assert.ok(doc.querySelectorAll(".calendar-day").length >= 28);
  await navigate("recommendations");
  assert.ok(doc.querySelector(".recommendation-grid .title-card"), "demo suggestions use the genre model");
  await navigate("upcoming/tv");
  assert.equal(doc.querySelectorAll(".type-tabs.segmented a").length, 3);
  assert.equal(doc.querySelector(".type-tabs.segmented a.selected").textContent.includes("TV"), true);
  assert.equal(cards(), 0, "nothing is upcoming in the demo catalogue");
  await navigate("interested");
  assert.match(doc.querySelector("#main").textContent, /Nothing on your radar yet/);

  // --- dismissing fades the card out of the list; the dismissed page restores it ----------
  await navigate("discover");
  click(`#main [data-action="dismiss-title"][data-key="${BLADE}"]`);
  assert.ok(state().dismissed[BLADE]);
  assert.equal(state().entries[BLADE].status, "completed", "dismissal keeps library history");
  assert.ok(doc.querySelector(`#main [data-action="detail"][data-key="${BLADE}"]`), "the card is still there while it fades");
  await delay(450);
  assert.equal(doc.querySelector(`#main [data-action="detail"][data-key="${BLADE}"]`), null);
  await navigate("dismissed");
  assert.equal(cards(), 1);
  click('#main [data-action="restore-title"]');
  assert.equal(Object.keys(state().dismissed).length, 0);

  // --- collection notes are shown as text and never run as markup ---------------------------
  await navigate("folder/next-up");
  click('[data-action="rename-folder"]');
  doc.querySelector("#folder-notes").value =
    "Watch together\nNo spoilers <script>bad</script>";
  submit("#folder-form");
  assert.equal(state().folders[0].notes, "Watch together\nNo spoilers <script>bad</script>");
  assert.match(doc.querySelector(".section-heading").textContent, /No spoilers/);
  assert.equal(doc.querySelector("#main script"), null);
  await navigate("collections");
  assert.match(doc.querySelector(".collection-notes").textContent, /Watch together/);
  await navigate("watched");
  assert.equal(cards(), 1);
  await navigate("rewatch");
  assert.equal(cards(), 1);

  // --- watching from a card asks for a rating and updates the card in place ------------------
  await navigate("discover");
  const grid = doc.querySelector("#main .title-grid");
  click(`#main .quick-watched[data-key="${INCEPTION}"]`);
  assert.equal(state().entries[INCEPTION].watched, true);
  assert.ok(doc.querySelector(".rate-pop"), "a rating box opens on the card");
  assert.ok(doc.querySelector(`#main [data-action="detail"][data-key="${INCEPTION}"]`), "the card stays while rating");
  click(`.rate-pop [data-action="rate-card"][data-value="8"]`);
  assert.equal(state().entries[INCEPTION].rating, 8);
  await delay(1200);
  assert.equal(doc.querySelector(".rate-pop"), null);
  assert.equal(doc.querySelector("#main .title-grid"), grid, "the page was not rebuilt");
  const inceptionCard = doc.querySelector(`#main .quick-watched[data-key="${INCEPTION}"]`).closest(".title-card");
  assert.ok(inceptionCard.querySelector(".quick-watched").classList.contains("is-watched"));
  assert.match(inceptionCard.querySelector(".personal-score").textContent, /8/);
  assert.equal(cards(), 24);

  // --- hide titles I have watched on the explore pages -------------------------------------
  tick("#hide-watched", true);
  await settle();
  assert.equal(cards(), 22, "both watched movies are hidden");
  assert.equal(window.localStorage.getItem("movie-world.hide-watched"), "true");
  tick("#hide-watched", false);
  await settle();
  assert.equal(cards(), 24);
  await navigate("library");
  assert.equal(doc.querySelector("#hide-watched"), null, "not offered on your own lists");
  await navigate("discover");

  // --- favourites patch the card; collections can be deleted ---------------------------------
  click(`#main .quick-favorite[data-key="${INCEPTION}"]`);
  assert.equal(state().entries[INCEPTION].favorite, true);
  assert.ok(doc.querySelector(`#main .quick-favorite[data-key="${INCEPTION}"]`).classList.contains("is-favorite"));
  await navigate("folder/next-up");
  click('[data-action="delete-folder"]');
  click('[data-action="confirm-delete-folder"]');
  await settle();
  assert.equal(state().folders.some((f) => f.id === "next-up"), false);
  assert.equal(state().entries[BLADE].folders.includes("next-up"), false);

  // --- tonight, decided: three questions, then one card from the watchlist ---------------------
  await navigate("discover");
  const planned = doc.querySelector('#main [data-action="card-save"]:not(.is-saved)');
  const plannedKey = planned.dataset.key;
  planned.click();
  await settle();
  click('[data-action="tonight"]');
  assert.match(doc.querySelector("#utility-dialog h2").textContent, /mood/);
  click('[data-action="tonight-answer"][data-field="kind"][data-value="all"]');
  assert.match(doc.querySelector("#utility-dialog h2").textContent, /time/);
  click('[data-action="tonight-answer"][data-field="minutes"][data-value="0"]');
  assert.match(doc.querySelector("#utility-dialog h2").textContent, /genre/);
  click('[data-action="tonight-answer"][data-field="genre"][data-value=""]');
  await delay(2600);
  assert.equal(doc.querySelector("#tonight-again").disabled, false);
  assert.ok(doc.querySelector(".tonight-pick .quick-save, .tonight-pick .title-card"));
  assert.equal(
    doc.querySelector(`.tonight-pick [data-key="${plannedKey}"]`) !== null,
    true,
    "the only unwatched watchlist title is the pick",
  );
  assert.match(doc.querySelector(".tonight-badge").textContent, /watchlist/i);
  click('[data-action="close-utility"]');

  // --- another tab changing the library is picked up, never overwritten -----------------------
  const external = { ...state(), goal: 99 };
  window.localStorage.setItem("movie-world.library.v1", JSON.stringify(external));
  window.dispatchEvent(
    new window.StorageEvent("storage", {
      key: "movie-world.library.v1",
      newValue: JSON.stringify(external),
    }),
  );
  await navigate("dashboard");
  assert.equal(state().goal, 99);
});
