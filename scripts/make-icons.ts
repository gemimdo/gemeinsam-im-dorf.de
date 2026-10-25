// Generates the site icons in public/ from the club crest (src/assets/wappen.webp).
// Run after replacing the crest: bun scripts/make-icons.ts
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "src/assets/wappen.webp";

/** Crest trimmed to its visible edges and centred on a transparent square. */
async function square(size: number, background = { r: 0, g: 0, b: 0, alpha: 0 }, padding = 0) {
  const inner = size - 2 * padding;
  const crest = await sharp(SOURCE).trim().resize(inner, inner, { fit: "contain", background }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: crest, left: padding, top: padding }])
    // The crest is greyscale, so a 256-colour palette keeps it sharp at a fraction of the size.
    .png({ palette: true, compressionLevel: 9 })
    .toBuffer();
}

/** ICO container holding PNG images (supported by all current browsers). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map(async (size) => ({ size, png: await square(size) })));
await writeFile("public/favicon.ico", ico(icoImages));
await writeFile("public/icon-192.png", await square(192));
// iOS shows transparent areas as black, so the home screen icon gets a white background.
await writeFile("public/apple-touch-icon.png", await square(180, { r: 255, g: 255, b: 255, alpha: 1 }, 12));

console.log("Icons written to public/: favicon.ico, icon-192.png, apple-touch-icon.png");
