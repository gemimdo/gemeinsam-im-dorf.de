import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { defineCollection } from "astro:content";
import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { CACHE_DIR, cachedDriveFile } from "./lib/drive-cache";
import { toLocalTime } from "./lib/format";
import { renderPdfPages } from "./lib/pdf-pages";
import {
  GOOGLE_EXPORTABLE,
  type DriveFile,
  driveDownloadUrl,
  driveExportPdfUrl,
  drivePublicDownloadUrl,
  calendarRange,
  configuredCalendars,
  env,
  listCategoryEvents,
  walkDriveFolder,
} from "./lib/google";
import { driveFolders, eventCategories, type EventCategory } from "./site.config";

// Formats Astro's image pipeline (sharp) can process. HEIC from iPhones is not among them.
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/tiff": "tiff",
};

interface StoredEntry {
  id: string;
  data: Record<string, unknown>;
  /** Set when data contains an image path; image() resolves "./name" next to this file. */
  filePath?: string;
  digest: string;
}

/**
 * Wraps a Google-backed loader. In the dev server a Google error keeps the previously
 * loaded entries, so the site stays usable. A real build fails instead – the scheduled
 * upload must never publish a site with a missing calendar or gallery.
 */
function googleLoader(name: string, load: () => Promise<StoredEntry[]>): Loader {
  return {
    name,
    load: async ({ store, parseData }) => {
      let entries: StoredEntry[];
      try {
        entries = await load();
      } catch (error) {
        if (!import.meta.env.DEV) throw error;
        console.warn(`[${name}] ${(error as Error).message}\n[${name}] dev server keeps the last loaded data.`);
        return;
      }
      store.clear();
      for (const entry of entries) {
        const data = await parseData({ id: entry.id, data: entry.data, filePath: entry.filePath });
        store.set({ id: entry.id, data, filePath: entry.filePath, digest: entry.digest });
      }
    },
  };
}

function missing(collection: string, ...vars: string[]): StoredEntry[] {
  console.warn(`[${collection}] ${vars.join(", ")} not set – collection stays empty.`);
  return [];
}

/** Path relative to the project root plus the "./file" form image() expects next to it. */
function localImage(absPath: string) {
  return { filePath: path.relative(process.cwd(), absPath), image: `./${path.basename(absPath)}` };
}

/**
 * A failed download skips that file in the dev server; a build stops, so a half-downloaded
 * gallery never goes online.
 */
async function tryDownload<T>(label: string, task: () => Promise<T>): Promise<T | undefined> {
  try {
    return await task();
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    console.warn(`[${label}] ${(error as Error).message} – skipped for now.`);
    return undefined;
  }
}

const photos = defineCollection({
  loader: googleLoader("photos", async () => {
    const { apiKey, photosFolderId } = env;
    if (!apiKey || !photosFolderId) return missing("photos", "GOOGLE_API_KEY", "DRIVE_PHOTOS_FOLDER_ID");

    const files = await walkDriveFolder(photosFolderId, apiKey);
    const skipped = files.filter((f) => !IMAGE_EXT[f.mimeType]);
    if (skipped.length) {
      console.warn(`[photos] skipped ${skipped.length} unsupported file(s): ${skipped.map((f) => f.name).join(", ")}`);
    }

    const entries = await Promise.all(
      files
        .filter((f) => IMAGE_EXT[f.mimeType])
        .map(async (f): Promise<StoredEntry | undefined> => {
          const local = await tryDownload("photos", () =>
            cachedDriveFile({
              id: f.id,
              version: f.modifiedTime,
              ext: IMAGE_EXT[f.mimeType],
              url: () => driveDownloadUrl(f.id, apiKey),
              fallbackUrl: drivePublicDownloadUrl(f.id),
            }),
          );
          if (!local) return undefined;
          const { filePath, image } = localImage(local);
          return {
            id: f.id,
            filePath,
            digest: f.modifiedTime + (f.description ?? "") + f.tags.join("/"),
            data: {
              name: f.name.replace(/\.[^.]+$/, ""),
              description: f.description,
              image,
              // Capture time from the photo's EXIF data; upload time only if the camera stored none.
              takenAt: parseExifTime(f.imageMediaMetadata?.time) ?? toLocalTime(f.modifiedTime),
              // The top-level subfolder is the album; deeper folders only add tags.
              album: f.tags[0] ?? "",
              isHero: f.tags[0] === driveFolders.heroPhotos,
              tags: f.tags,
            },
          };
        }),
    );
    return entries.filter((e) => e !== undefined);
  }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      description: z.string().optional(),
      image: image(),
      /** German local time, "YYYY-MM-DDTHH:mm:ss" – sorts correctly as text. */
      takenAt: z.string(),
      album: z.string(),
      isHero: z.boolean(),
      tags: z.array(z.string()),
    }),
});

const documents = defineCollection({
  loader: googleLoader("documents", async () => {
    const { apiKey, documentsFolderId } = env;
    if (!apiKey || !documentsFolderId) return missing("documents", "GOOGLE_API_KEY", "DRIVE_DOCUMENTS_FOLDER_ID");

    const files = await walkDriveFolder(documentsFolderId, apiKey);
    // Newest newsletter issue: last by name, numbers compared by value ("… 10" after "… 9").
    const latestIssue = files
      .filter((f) => f.tags[0] === driveFolders.newsletter)
      .sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }))
      .at(-1);
    return Promise.all(
      files
        .filter((f) => !f.mimeType.startsWith("application/vnd.google-apps.") || GOOGLE_EXPORTABLE.has(f.mimeType))
        .map(async (f): Promise<StoredEntry> => {
          const exported = GOOGLE_EXPORTABLE.has(f.mimeType);
          const ext = exported ? "pdf" : (f.fileExtension || f.name.split(".").pop() || "bin").toLowerCase();
          const base = exported ? f.name : f.name.replace(/\.[^.]+$/, "");
          const isFlyer = f.tags[0] === driveFolders.flyers;

          // Flyers need a picture for the start page: the image itself, or Drive's render of page 1.
          let preview: ReturnType<typeof localImage> | undefined;
          if (isFlyer) {
            const imageExt = IMAGE_EXT[f.mimeType];
            const previewUrl = imageExt
              ? () => driveDownloadUrl(f.id, apiKey)
              : f.thumbnailLink && (() => f.thumbnailLink!.replace(/=s\d+$/, "=s1600"));
            if (previewUrl) {
              const local = await tryDownload("documents", () =>
                cachedDriveFile({
                  id: `preview-${f.id}`,
                  version: f.modifiedTime,
                  ext: imageExt ?? "jpg",
                  url: previewUrl,
                  fallbackUrl: imageExt ? drivePublicDownloadUrl(f.id) : undefined,
                }),
              );
              if (local) preview = localImage(local);
            }
          }

          // The newest newsletter is shown page by page in the start page reader.
          const isLatestIssue = f.id === latestIssue?.id;
          const pages = isLatestIssue
            ? await tryDownload("documents", () => issuePages(f, exported, apiKey))
            : undefined;

          return {
            id: f.id,
            filePath: preview?.filePath ?? (pages?.length ? path.relative(process.cwd(), pages[0]) : undefined),
            digest: f.modifiedTime + (f.description ?? "") + f.tags.join("/"),
            data: {
              title: base,
              description: f.description,
              mimeType: exported ? "application/pdf" : f.mimeType,
              ext,
              // Files are re-hosted on the site (see src/pages/dokumente/dateien), never linked to Drive.
              fileName: `${slugify(base)}-${f.id.slice(0, 6)}.${ext}`,
              driveId: f.id,
              exported,
              preview: preview?.image,
              pages: pages?.map((page) => `./${path.basename(page)}`),
              isLatestIssue,
              size: f.size ? Number(f.size) : undefined,
              createdAt: f.createdTime,
              modifiedAt: f.modifiedTime,
              category: f.tags[0] ?? "Allgemein",
              isFlyer,
              tags: f.tags,
            },
          };
        }),
    );
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      mimeType: z.string(),
      ext: z.string(),
      fileName: z.string(),
      driveId: z.string(),
      exported: z.boolean(),
      preview: image().optional(),
      pages: z.array(image()).optional(),
      isLatestIssue: z.boolean(),
      size: z.number().optional(),
      createdAt: z.coerce.date(),
      modifiedAt: z.coerce.date(),
      category: z.string(),
      isFlyer: z.boolean(),
      tags: z.array(z.string()),
    }),
});

const events = defineCollection({
  loader: googleLoader("events", async () => {
    const { apiKey } = env;
    if (!apiKey || configuredCalendars().length === 0) {
      return missing("events", "GOOGLE_API_KEY", "GOOGLE_CALENDAR_ID");
    }

    const { from, to } = calendarRange();
    const items = await listCategoryEvents(apiKey, from, to);

    return items.map(({ category, event: e }) => {
      const details = parseDescription(e.description ? htmlToText(e.description) : "");
      const data = {
        title: e.summary?.trim() || "Termin",
        category,
        location: e.location,
        ...details,
        allDay: Boolean(e.start.date),
        // All-day events come as plain dates (end exclusive). Noon keeps them on the
        // right day regardless of the build machine timezone or DST shifts.
        start: e.start.dateTime ?? `${e.start.date}T12:00:00`,
        end: e.end.dateTime ?? `${e.end.date}T12:00:00`,
      };
      // Event IDs are only unique within one calendar.
      return { id: `${category}-${e.id}`, data, digest: JSON.stringify(data) };
    });
  }),
  schema: z.object({
    title: z.string(),
    category: z.enum(Object.keys(eventCategories) as [EventCategory, ...EventCategory[]]),
    location: z.string().optional(),
    description: z.string().optional(),
    fee: z.string().optional(),
    contact: z.string().optional(),
    allDay: z.boolean(),
    start: z.string(),
    end: z.string(),
  }),
});

/**
 * Lines like "Eintritt: frei" or "Kontakt: Anna, 0123" in the event description
 * become their own fields; the remaining text is the description.
 */
function parseDescription(text: string) {
  let fee: string | undefined;
  let contact: string | undefined;
  const rest = text
    .split("\n")
    .filter((line) => {
      const m = line.match(/^\s*(Eintritt|Kosten|Kontakt)\s*:\s*(.+)$/i);
      if (!m) return true;
      if (m[1].toLowerCase() === "kontakt") contact = m[2].trim();
      else fee = m[2].trim();
      return false;
    })
    .join("\n")
    .trim();
  return { description: rest || undefined, fee, contact };
}

/** Page images of a newsletter issue: rendered PDF pages, or the file itself if it is an image. */
async function issuePages(f: DriveFile, exported: boolean, apiKey: string): Promise<string[]> {
  const imageExt = IMAGE_EXT[f.mimeType];
  const download = (ext: string) =>
    cachedDriveFile({
      id: f.id,
      version: f.modifiedTime,
      ext,
      url: () => (exported ? driveExportPdfUrl(f.id, apiKey) : driveDownloadUrl(f.id, apiKey)),
      fallbackUrl: exported ? undefined : drivePublicDownloadUrl(f.id),
    });
  if (imageExt) return [await download(imageExt)];
  if (!exported && f.mimeType !== "application/pdf") return [];

  const pdf = await download("pdf");
  const prefix = `pages-${f.id}-`;
  const base = `${prefix}${createHash("sha1").update(f.modifiedTime).digest("hex").slice(0, 10)}`;
  // Drop renderings of older versions of this issue.
  for (const name of await readdir(CACHE_DIR)) {
    if (name.startsWith(prefix) && !name.startsWith(base)) await rm(path.join(CACHE_DIR, name), { force: true });
  }
  return renderPdfPages(pdf, path.join(CACHE_DIR, base));
}

/** EXIF timestamps look like "2024:05:12 14:03:00". */
function parseExifTime(time?: string): string | undefined {
  const m = time?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined;
}

/** Google Calendar stores descriptions as HTML; we only render plain text to stay XSS-safe. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "datei"
  );
}

export const collections = { photos, documents, events };
