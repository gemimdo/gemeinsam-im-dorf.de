import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import {
  GOOGLE_EXPORTABLE,
  driveDownloadUrl,
  driveExportPdfUrl,
  calendarRange,
  env,
  listCalendarEvents,
  walkDriveFolder,
} from "./lib/google";
import { defaultEventCategory, driveFolders, eventColorToCategory } from "./site.config";

// Formats Astro's image pipeline (sharp) can process. HEIC from iPhones is not among them.
const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff"]);

/**
 * In the dev server a Google error only empties that section, so the rest of the site
 * stays usable. A real build fails instead – the scheduled upload must never publish
 * a site with a missing calendar or gallery.
 */
async function guarded<T>(collection: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    console.warn(
      `[${collection}] ${(error as Error).message}\n[${collection}] dev server continues with this section empty.`,
    );
    return [];
  }
}

function missing(collection: string, ...vars: string[]) {
  console.warn(`[${collection}] ${vars.join(", ")} not set – collection stays empty.`);
  return [];
}

const photos = defineCollection({
  loader: () =>
    guarded("photos", async () => {
      const { apiKey, photosFolderId } = env;
      if (!apiKey || !photosFolderId) return missing("photos", "GOOGLE_API_KEY", "DRIVE_PHOTOS_FOLDER_ID");

      const files = await walkDriveFolder(photosFolderId, apiKey);
      const skipped = files.filter((f) => !SUPPORTED_IMAGES.has(f.mimeType));
      if (skipped.length) {
        console.warn(
          `[photos] skipped ${skipped.length} unsupported file(s): ${skipped.map((f) => f.name).join(", ")}`,
        );
      }

      return files
        .filter((f) => SUPPORTED_IMAGES.has(f.mimeType))
        .map((f) => {
          const meta = f.imageMediaMetadata ?? {};
          const rotated = meta.rotation === 1 || meta.rotation === 3;
          return {
            id: f.id,
            name: f.name.replace(/\.[^.]+$/, ""),
            description: f.description,
            src: driveDownloadUrl(f.id, apiKey),
            width: rotated ? meta.height : meta.width,
            height: rotated ? meta.width : meta.height,
            takenAt: parseExifTime(meta.time) ?? f.modifiedTime,
            // The top-level subfolder is the album; deeper folders only add tags.
            album: f.tags[0] ?? "",
            isHero: f.tags[0] === driveFolders.heroPhotos,
            tags: f.tags,
          };
        });
    }),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    src: z.url(),
    width: z.number().optional(),
    height: z.number().optional(),
    takenAt: z.coerce.date(),
    album: z.string(),
    isHero: z.boolean(),
    tags: z.array(z.string()),
  }),
});

const documents = defineCollection({
  loader: () =>
    guarded("documents", async () => {
      const { apiKey, documentsFolderId } = env;
      if (!apiKey || !documentsFolderId) return missing("documents", "GOOGLE_API_KEY", "DRIVE_DOCUMENTS_FOLDER_ID");

      const files = await walkDriveFolder(documentsFolderId, apiKey);
      return files
        .filter((f) => !f.mimeType.startsWith("application/vnd.google-apps.") || GOOGLE_EXPORTABLE.has(f.mimeType))
        .map((f) => {
          const exported = GOOGLE_EXPORTABLE.has(f.mimeType);
          const ext = exported ? "pdf" : (f.fileExtension || f.name.split(".").pop() || "bin").toLowerCase();
          const base = exported ? f.name : f.name.replace(/\.[^.]+$/, "");
          return {
            id: f.id,
            title: base,
            description: f.description,
            mimeType: exported ? "application/pdf" : f.mimeType,
            ext,
            // Files are re-hosted on the site (see src/pages/dokumente/dateien), never linked to Drive.
            fileName: `${slugify(base)}-${f.id.slice(0, 6)}.${ext}`,
            source: exported ? driveExportPdfUrl(f.id, apiKey) : driveDownloadUrl(f.id, apiKey),
            thumbnail: f.thumbnailLink?.replace(/=s\d+$/, "=s1600"),
            size: f.size ? Number(f.size) : undefined,
            createdAt: f.createdTime,
            modifiedAt: f.modifiedTime,
            category: f.tags[0] ?? "Allgemein",
            isFlyer: f.tags[0] === driveFolders.flyers,
            tags: f.tags,
          };
        });
    }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    mimeType: z.string(),
    ext: z.string(),
    fileName: z.string(),
    source: z.url(),
    thumbnail: z.url().optional(),
    size: z.number().optional(),
    createdAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    category: z.string(),
    isFlyer: z.boolean(),
    tags: z.array(z.string()),
  }),
});

const events = defineCollection({
  loader: () =>
    guarded("events", async () => {
      const { apiKey, calendarId } = env;
      if (!apiKey || !calendarId) return missing("events", "GOOGLE_API_KEY", "GOOGLE_CALENDAR_ID");

      const { from, to } = calendarRange();
      const items = await listCalendarEvents(calendarId, apiKey, from, to);

      return items.map((e) => {
        const details = parseDescription(e.description ? htmlToText(e.description) : "");
        return {
          id: e.id,
          title: e.summary?.trim() || "Termin",
          category: (e.colorId && eventColorToCategory[e.colorId]) || defaultEventCategory,
          location: e.location,
          ...details,
          allDay: Boolean(e.start.date),
          // All-day events come as plain dates (end exclusive). Noon keeps them on the
          // right day regardless of the build machine timezone or DST shifts.
          start: e.start.dateTime ?? `${e.start.date}T12:00:00`,
          end: e.end.dateTime ?? `${e.end.date}T12:00:00`,
        };
      });
    }),
  schema: z.object({
    title: z.string(),
    category: z.enum(["feste", "familie", "verein"]),
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
