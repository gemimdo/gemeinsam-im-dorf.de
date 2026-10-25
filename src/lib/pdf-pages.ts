// Renders PDF pages to PNG images at build time, so a PDF can be read in the page
// overlay on every device (phone browsers don't show embedded PDFs reliably).
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const pdfjsDir = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));

async function readManifest(file: string): Promise<string[] | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Renders every page of `pdfFile` to `<outBase>-p<n>.png` (width `targetWidth` px) and
 * returns the image paths. `outBase` should contain the file version, so a changed PDF
 * is rendered again while an unchanged one is reused from disk.
 */
export async function renderPdfPages(pdfFile: string, outBase: string, targetWidth = 1600): Promise<string[]> {
  const manifest = `${outBase}.pages.json`;
  const cached = await readManifest(manifest);
  if (cached) return cached;

  const task = getDocument({
    data: new Uint8Array(await readFile(pdfFile)),
    standardFontDataUrl: path.join(pdfjsDir, "standard_fonts") + path.sep,
    cMapUrl: path.join(pdfjsDir, "cmaps") + path.sep,
    cMapPacked: true,
    verbosity: 0,
  });
  const doc = await task.promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const scale = targetWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff"; // PDFs assume white paper; transparency would show the page background
    context.fillRect(0, 0, canvas.width, canvas.height);
    // pdf.js accepts any 2D canvas; the node canvas types differ slightly from the DOM ones.
    await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
    const file = `${outBase}-p${n}.png`;
    await writeFile(file, await canvas.encode("png"));
    pages.push(file);
    page.cleanup();
  }
  await task.destroy();
  await writeFile(manifest, JSON.stringify(pages));
  return pages;
}
