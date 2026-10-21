import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyLibrary,
  saveTitle,
  parseLibrary,
  removeTitle,
  filterEntries,
} from "../public/js/library.js";
import {
  logWatch,
  getStats,
  recommendTitles,
  scheduledTitles,
  validDate,
  hasWatched,
} from "../public/js/insights.js";
import { demoTitles } from "../server/demo.js";

test("watched status and a rewatch queue survive backup and future status changes", () => {
  const title = demoTitles[0];
  let lib = saveTitle(emptyLibrary(), title, { status: "completed" });
  lib = saveTitle(lib, title, { status: "watching", rewatchQueued: true });
  assert.equal(hasWatched(lib, title.key), true);
  assert.equal(filterEntries(lib, { view: "rewatch" }).length, 1);
  assert.deepEqual(parseLibrary(JSON.stringify(lib)), lib);
  lib = logWatch(lib, title, { rewatch: true, id: "another-watch" });
  assert.equal(lib.entries[title.key].rewatchQueued, false);
});
test("watched but unrated titles influence discovery; low ratings reduce matching suggestions", () => {
  const seed = { ...demoTitles[0], genres: ["Sci-Fi"] },
    similar = { ...demoTitles[1], genres: ["Sci-Fi"], score: 8 },
    different = { ...demoTitles[11], genres: ["Crime"], score: 8 };
  let lib = saveTitle(emptyLibrary(), seed, { status: "completed" });
  assert.equal(
    recommendTitles(lib, [different, similar])[0].title.key,
    similar.key,
  );
  lib = saveTitle(lib, seed, { rating: 1 });
  assert.equal(
    recommendTitles(lib, [different, similar])[0].title.key,
    different.key,
  );
});
test("completed diary history prevents recommending a watched title even after library removal", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0]);
  lib = logWatch(lib, demoTitles[0], { id: "watched-once" });
  lib = removeTitle(lib, demoTitles[0].key);
  assert.equal(hasWatched(lib, demoTitles[0].key), true);
  assert.equal(recommendTitles(lib, [demoTitles[0]]).length, 0);
});

test("watch logs preserve diary metadata through backups and after title removal", () => {
  const title = demoTitles[0];
  let lib = saveTitle(emptyLibrary(), title);
  lib = logWatch(lib, title, {
    date: "2020-01-10",
    rating: 8.5,
    notes: "Worth revisiting",
    id: "first-watch",
  });
  assert.equal(lib.entries[title.key].status, "completed");
  assert.equal(getStats(lib, 2020).yearly, 1);
  assert.equal(lib.diary[0].minutes, 164);
  assert.deepEqual(parseLibrary(JSON.stringify(lib)), lib);
  assert.equal(removeTitle(lib, title.key).diary.length, 1);
});
test("episode logging advances progress and completes a series at its known episode count", () => {
  const title = { ...demoTitles[18], episodes: 2, runtime: 24 };
  let lib = saveTitle(emptyLibrary(), title);
  lib = logWatch(lib, title, {
    type: "episode",
    date: "2020-01-01",
    id: "ep-1",
  });
  assert.equal(lib.entries[title.key].progress, 1);
  assert.equal(lib.entries[title.key].status, "watching");
  lib = logWatch(lib, title, {
    type: "episode",
    date: "2020-01-02",
    id: "ep-2",
  });
  assert.equal(lib.entries[title.key].status, "completed");
  assert.equal(getStats(lib).hours, 1);
  assert.equal(getStats(lib, 2020).yearly, 1);
  assert.throws(
    () => logWatch(lib, title, { type: "episode" }),
    /already watched/,
  );
});
test("finishing a partly watched series avoids double-counting already logged episode time", () => {
  const title = { ...demoTitles[18], episodes: 3, runtime: 20 };
  let lib = saveTitle(emptyLibrary(), title);
  lib = logWatch(lib, title, { type: "episode", date: "2020-01-01", id: "ep" });
  lib = logWatch(lib, title, { date: "2020-01-02", id: "finish" });
  assert.equal(
    lib.diary.reduce((sum, l) => sum + l.minutes, 0),
    60,
  );
  lib = logWatch(lib, title, {
    date: "2020-01-03",
    id: "rewatch",
    rewatch: true,
  });
  assert.equal(lib.diary.at(-1).minutes, 60);
  assert.equal(lib.diary.at(-1).rewatch, true);
});
test("watch logging rejects impossible dates, future dates and movie episode logs", () => {
  const title = demoTitles[0],
    lib = saveTitle(emptyLibrary(), title);
  assert.equal(validDate("2024-02-30"), false);
  assert.equal(validDate("9999-99-99"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.throws(() => logWatch(lib, title, { date: "2999-01-01" }), /future/);
  assert.throws(() => logWatch(lib, title, { type: "episode" }), /Movies/);
});
test("older version-one backups migrate without losing saved entries", () => {
  const lib = saveTitle(emptyLibrary(), demoTitles[0], {
    rating: 9,
    notes: "Original note",
  });
  delete lib.diary;
  delete lib.goal;
  const migrated = parseLibrary(JSON.stringify(lib));
  assert.deepEqual(migrated.diary, []);
  assert.equal(migrated.goal, 52);
  assert.equal(migrated.entries[demoTitles[0].key].notes, "Original note");
});
test("duplicate or malformed diary entries cannot be imported", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0]);
  lib = logWatch(lib, demoTitles[0], { id: "one" });
  lib.diary.push({ ...lib.diary[0] });
  assert.throws(() => parseLibrary(JSON.stringify(lib)), /Duplicate/);
  lib.diary = [{ ...lib.diary[0], rating: 12 }];
  assert.throws(() => parseLibrary(JSON.stringify(lib)), /diary/);
});
test("personal recommendations rank taste matches and exclude titles already saved", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0], {
    favorite: true,
    rating: 9,
  });
  const picks = recommendTitles(lib, [
    demoTitles[0],
    demoTitles[1],
    demoTitles[11],
  ]);
  assert.equal(picks.length, 2);
  assert.equal(picks[0].title.title, "Dune: Part Two");
  assert.match(picks[0].reason, /Sci-Fi/);
});
test("watch-tonight picker honours media, runtime and high-priority choices", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0]);
  lib = saveTitle(lib, demoTitles[2], { priority: "high" });
  // Sweeping the random value shows the high-priority title is drawn most often (weight 4 vs 2.5).
  let high = 0;
  for (let i = 0; i < 100; i++)
    if (tonightPick(lib, { random: () => i / 100 }).title.key === demoTitles[2].key) high++;
  assert.ok(high > 55 && high < 70, `high-priority share was ${high}%`);
  assert.equal(tonightPick(lib, { random: () => 0 }).from, "watchlist");
  assert.equal(tonightPick(lib, { minutes: 150, random: () => 0 }).title.key, demoTitles[2].key);
  assert.equal(tonightPick(lib, { minutes: 60 }), null);
  assert.equal(tonightPick(lib, { kind: "anime" }), null);
});
test("calendar only schedules dates that exist in actual saved metadata", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0]);
  lib = saveTitle(lib, { ...demoTitles[12], nextAirDate: "2026-12-01" });
  assert.equal(scheduledTitles(lib, "2026-12").length, 1);
  assert.equal(scheduledTitles(lib, "2026-11").length, 0);
});
test("tagged library titles are searchable and stats derive from real entries and logs", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0], {
    tags: ["neon nights"],
    rating: 8,
  });
  assert.equal(filterEntries(lib, { query: "neon" }).length, 1);
  assert.equal(getStats(lib).average, 8);
  assert.equal(getStats(lib).yearly, 0);
});

test("not-interested titles are excluded from recommendations and tonight picks", () => {
  const title = demoTitles[0];
  let lib = saveTitle(emptyLibrary(), title, { favorite: true });
  lib.dismissed = { [title.key]: title, [demoTitles[1].key]: demoTitles[1] };
  assert.equal(tonightPick(lib), null);
  const picks = recommendTitles(lib, demoTitles);
  assert.ok(picks.every((p) => !lib.dismissed[p.title.key]));
});
import {
  entryWeight,
  tasteProfiles,
  rankForYou,
  tonightPick,
} from "../public/js/insights.js";

const tmdbTitle = (id, keywords, extra = {}) => ({
  key: `tmdb:movie:${id}`,
  source: "tmdb",
  kind: "movie",
  id,
  title: `Movie ${id}`,
  year: 2020,
  score: 7,
  poster: "",
  backdrop: "",
  overview: "",
  genres: ["Drama"],
  keywords: keywords.map((name, i) => ({ id: id * 100 + i, name })),
  ...extra,
});
const withEntry = (lib, title, patch) => ({
  ...lib,
  entries: {
    ...lib.entries,
    [title.key]: { title, favorite: false, watched: false, rewatchQueued: false, status: "planned", rating: 0, notes: "", folders: [], progress: 0, priority: "normal", tags: [], ...patch },
  },
});

test("entry weights: a 5 counts little, 7.5 more, a favourite more again regardless of rating, low ratings push away", () => {
  const t = tmdbTitle(1, []);
  const w = (patch) => entryWeight(emptyLibrary(), { title: t, status: "planned", ...patch });
  const watched5 = w({ watched: true, rating: 5 }),
    watched75 = w({ watched: true, rating: 7.5 }),
    favUnrated = w({ favorite: true }),
    favLow = w({ favorite: true, rating: 3 });
  assert.ok(watched5 > 0 && watched5 < watched75);
  assert.ok(favUnrated > watched75);
  assert.ok(favLow > watched75, "a favourite outweighs its rating");
  assert.ok(w({ rating: 3 }) < 0);
  assert.ok(w({ rewatchQueued: true, watched: true, rating: 8 }) > w({ watched: true, rating: 8 }));
});

test("taste profiles keep TMDB keywords and AniList tags in separate models", () => {
  const anime = tmdbTitle(2, ["Time Loop"], { key: "jikan:anime:2", source: "jikan", kind: "anime" });
  let lib = withEntry(emptyLibrary(), tmdbTitle(1, ["heist"]), { favorite: true });
  lib = withEntry(lib, anime, { favorite: true });
  const p = tasteProfiles(lib);
  assert.ok(p.tmdb.keywords.has("heist") && !p.tmdb.keywords.has("time loop"));
  assert.ok(p.anime.keywords.has("time loop") && !p.anime.keywords.has("heist"));
});

test("ranking prefers keyword matches, drops saved titles and explains itself", () => {
  let lib = withEntry(emptyLibrary(), tmdbTitle(1, ["heist", "chef"]), { favorite: true, watched: true, rating: 9 });
  const p = tasteProfiles(lib).tmdb;
  const match = tmdbTitle(10, [], { matched: ["heist"], genres: ["Comedy"] }),
    plain = tmdbTitle(11, [], { genres: ["Comedy"] }),
    saved = tmdbTitle(1, ["heist"]);
  const ranked = rankForYou(p, [plain, match, saved], lib);
  assert.deepEqual(ranked.map((r) => r.title.id), [10, 11]);
  assert.match(ranked[0].reason, /heist/i);
});

test("tonight pick mixes watchlist and suggestions, honours filters and avoids repeats until the pool runs out", () => {
  const list = withEntry(emptyLibrary(), tmdbTitle(1, [], { genres: ["Drama"], runtime: 45 }), { status: "planned" });
  const sug = [{ title: tmdbTitle(2, [], { genres: ["Comedy"], runtime: 30 }), reason: "Matches your taste for x" }];
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(tonightPick(list, { suggestions: sug }).title.id);
  assert.deepEqual([...seen].sort(), [1, 2]);
  assert.equal(tonightPick(list, { suggestions: sug, genre: "Comedy" }).from, "suggestion");
  assert.equal(tonightPick(list, { suggestions: sug, minutes: 30 }).title.id, 2, "45 min does not fit 30");
  assert.equal(tonightPick(list, { suggestions: sug, genre: "Horror" }), null);
  const next = tonightPick(list, { suggestions: sug, exclude: ["tmdb:movie:1"] });
  assert.equal(next.title.id, 2);
  assert.equal(tonightPick(list, { suggestions: sug, exclude: ["tmdb:movie:1", "tmdb:movie:2"] }).cycled, true);
});
