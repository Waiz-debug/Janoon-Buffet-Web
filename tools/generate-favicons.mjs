/**
 * Generates every browser icon from `public/logo.svg`.
 *
 * One source of truth: the tab, the iOS home-screen tile and the PWA manifest
 * icon are all cut from the same brand mark the header renders, so the favicon
 * can never drift away from the logo again. Regenerate after the mark changes:
 *
 *     bun tools/generate-favicons.mjs
 *
 * Then bump the `?v=` suffix on the icon links in `index.html` and
 * `public/manifest.webmanifest` — browsers cache favicons by URL for a long
 * time, and a new query string is what makes them fetch the new one.
 *
 * `sharp` (already a devDependency) does the rasterising, so there is no
 * hand-drawn geometry to keep in sync and no Python toolchain to install.
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** The mark itself, read once and rendered at every size. */
const logo = readFileSync("public/logo.svg");

/**
 * The background the SVG paints its tile with. iOS and Android apply their own
 * mask to home-screen icons, so the full-bleed sizes are flattened onto it
 * rather than left with transparent corners the mask would reveal as black.
 */
const TILE_BG = "#141008";

/** Rasterise the mark. `flat` fills the corners for the masked sizes. */
async function png(size, { flat = false } = {}) {
  const pipeline = sharp(logo, { density: 512 }).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  return (flat ? pipeline.flatten({ background: TILE_BG }) : pipeline)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * A multi-size `.ico` whose entries are PNGs — every browser that asks for
 * `favicon.ico` understands PNG entries, and Windows draws the 48px one in the
 * taskbar. Layout per the ICONDIR/ICONDIRENTRY spec in the ICO format.
 */
function ico(items) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(items.length, 4);

  let offset = 6 + 16 * items.length;
  const entries = [];
  for (const { size, data } of items) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...items.map((i) => i.data)]);
}

function write(path, data) {
  writeFileSync(path, data);
  console.log(`wrote ${path.padEnd(30)} ${String(data.length).padStart(7)} bytes`);
}

const [favicon16, favicon32, favicon48, touch180, icon192, icon512] =
  await Promise.all([
    png(16),
    png(32),
    png(48),
    png(180, { flat: true }),
    png(192, { flat: true }),
    png(512, { flat: true }),
  ]);

write("public/favicon-16x16.png", favicon16);
write("public/favicon-32x32.png", favicon32);
write("public/apple-touch-icon.png", touch180);
write("public/icon-192.png", icon192);
write("public/icon-512.png", icon512);
write(
  "public/favicon.ico",
  ico([
    { size: 16, data: favicon16 },
    { size: 32, data: favicon32 },
    { size: 48, data: favicon48 },
  ]),
);
