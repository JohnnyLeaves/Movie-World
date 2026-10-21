// Renders the SVG logo into the PNG sources @capacitor/assets expects (run before `npx capacitor-assets generate`).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const mark = (stroke, hi) =>
  `<path d="M22 70V30l28 24 28-24v40" fill="none" stroke="${stroke}" stroke-width="9" stroke-linejoin="round"/><path d="m42 30 8 7 8-7" fill="none" stroke="${hi}" stroke-width="6"/>`;
const svg = (body, size = 100) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${body}</svg>`);
const bg = `<rect width="100" height="100" fill="#12080b"/>`;
// Adaptive icons keep the mark inside the central 66% so launcher masks never clip it.
const small = (body) => `<g transform="translate(17 17) scale(.66)">${body}</g>`;

await mkdir("resources", { recursive: true });
const out = (name, input, px) => sharp(input, { density: 600 }).resize(px, px).png().toFile(`resources/${name}`);
await out("icon-only.png", svg(bg + mark("#ff2e55", "#ff9aaf")), 1024);
await out("icon-foreground.png", svg(small(mark("#ff2e55", "#ff9aaf"))), 1024);
await out("icon-background.png", svg(bg), 1024);
// Splash: logo centred on the app background.
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: "#0a0608" } })
  .composite([{ input: await sharp(svg(mark("#ff2e55", "#ff9aaf")), { density: 600 }).resize(600, 600).png().toBuffer(), gravity: "centre" }])
  .png()
  .toFile("resources/splash.png");
await sharp("resources/splash.png").toFile("resources/splash-dark.png");
console.log("icons written to resources/");
