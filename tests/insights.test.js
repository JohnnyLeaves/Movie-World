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
  pickTonight,
  scheduledTitles,
  validDate,
  hasWatched,
} from "../public/js/insights.js";
import { demoTitles } from "../server/demo.js";

test('watched status and a rewatch queue survive backup and future status changes',()=>{
  const title=demoTitles[0];let lib=saveTitle(emptyLibrary(),title,{status:'completed'});
  lib=saveTitle(lib,title,{status:'watching',rewatchQueued:true});
  assert.equal(hasWatched(lib,title.key),true);assert.equal(filterEntries(lib,{view:'rewatch'}).length,1);
  assert.deepEqual(parseLibrary(JSON.stringify(lib)),lib);
  lib=logWatch(lib,title,{rewatch:true,id:'another-watch'});assert.equal(lib.entries[title.key].rewatchQueued,false);
});
test('watched but unrated titles influence discovery; low ratings reduce matching suggestions',()=>{
  const seed={...demoTitles[0],genres:['Sci-Fi']},similar={...demoTitles[1],genres:['Sci-Fi'],score:8},different={...demoTitles[11],genres:['Crime'],score:8};
  let lib=saveTitle(emptyLibrary(),seed,{status:'completed'});
  assert.equal(recommendTitles(lib,[different,similar])[0].title.key,similar.key);
  lib=saveTitle(lib,seed,{rating:1});assert.equal(recommendTitles(lib,[different,similar])[0].title.key,different.key);
});
test('completed diary history prevents recommending a watched title even after library removal',()=>{
  let lib=saveTitle(emptyLibrary(),demoTitles[0]);lib=logWatch(lib,demoTitles[0],{id:'watched-once'});lib=removeTitle(lib,demoTitles[0].key);
  assert.equal(hasWatched(lib,demoTitles[0].key),true);assert.equal(recommendTitles(lib,[demoTitles[0]]).length,0);
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
  assert.equal(pickTonight(lib, { random: () => 0 }).key, demoTitles[2].key);
  assert.equal(
    pickTonight(lib, { minutes: 150, random: () => 0 }).key,
    demoTitles[2].key,
  );
  assert.equal(pickTonight(lib, { minutes: 60 }), null);
  assert.equal(pickTonight(lib, { kind: "anime" }), null);
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
