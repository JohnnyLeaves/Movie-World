import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.(js|mjs)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
for (const file of ["public", "server", "scripts"].flatMap(files)) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("All application JavaScript modules passed syntax checks.");
