import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyLibrary,
  saveTitle,
  removeTitle,
  addFolder,
  deleteFolder,
  renameFolder,
  parseLibrary,
  filterEntries,
} from "../public/js/library.js";
import { demoTitles } from "../server/demo.js";

test("favourites, rating, notes, status and progress survive a backup round trip", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0], {
    favorite: true,
    rating: 8.5,
    notes: "A stunning world.",
    status: "completed",
    progress: 4,
    folders: ["next-up"],
  });
  const restored = parseLibrary(JSON.stringify(lib));
  assert.deepEqual(restored, lib);
  assert.equal(filterEntries(restored, { view: "favorites" })[0].rating, 8.5);
  assert.equal(filterEntries(restored, { status: "completed" }).length, 1);
});
test("saving a title preserves existing fields and never duplicates the entry", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0], {
    notes: "Keep me",
    favorite: true,
  });
  lib = saveTitle(lib, demoTitles[0], { rating: 9 });
  assert.equal(Object.keys(lib.entries).length, 1);
  assert.equal(lib.entries[demoTitles[0].key].notes, "Keep me");
  assert.equal(lib.entries[demoTitles[0].key].favorite, true);
});
test("collections can be created and renamed; deletion preserves titles", () => {
  let lib = addFolder(emptyLibrary(), "Neon nights", "neon");
  lib = saveTitle(lib, demoTitles[0], { folders: ["neon", "next-up"] });
  assert.equal(filterEntries(lib, { folder: "neon" }).length, 1);
  lib = renameFolder(lib, "neon", "Future worlds");
  assert.equal(lib.folders.find((f) => f.id === "neon").name, "Future worlds");
  lib = deleteFolder(lib, "neon");
  assert.equal(Object.keys(lib.entries).length, 1);
  assert.deepEqual(lib.entries[demoTitles[0].key].folders, ["next-up"]);
});
test("duplicate collection names and invalid backups are rejected", () => {
  assert.throws(() => addFolder(emptyLibrary(), " next UP "), /already exists/);
  assert.throws(() => addFolder(emptyLibrary(), ""));
  assert.throws(() => parseLibrary('{"version":2}'));
  const lib = saveTitle(emptyLibrary(), demoTitles[0], { rating: 11 });
  assert.throws(() => parseLibrary(JSON.stringify(lib)), /rating/);
});
test("backup imports strip untrusted image and trailer URLs and orphan folder memberships", () => {
  const lib = saveTitle(emptyLibrary(), demoTitles[0], {
    folders: ["missing", "next-up"],
  });
  const entry = lib.entries[demoTitles[0].key];
  entry.title.poster = "https://attacker.example/track";
  entry.title.trailer = "javascript:alert(1)";
  const clean = parseLibrary(JSON.stringify(lib)).entries[demoTitles[0].key];
  assert.equal(clean.title.poster, "");
  assert.equal(clean.title.trailer, null);
  assert.deepEqual(clean.folders, ["next-up"]);
});
test("personal library filtering is case insensitive and supports media type and ratings", () => {
  let lib = saveTitle(emptyLibrary(), demoTitles[0], { rating: 7 });
  lib = saveTitle(lib, demoTitles[12], { rating: 9, favorite: true });
  assert.equal(filterEntries(lib, { query: "BLADE" }).length, 1);
  assert.equal(
    filterEntries(lib, { kind: "tv" })[0].title.title,
    "Breaking Bad",
  );
  assert.equal(filterEntries(lib, { sort: "rating" })[0].rating, 9);
  lib = removeTitle(lib, demoTitles[0].key);
  assert.equal(Object.keys(lib.entries).length, 1);
});
