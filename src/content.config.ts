import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { driveDownloadUrl, env, listCalendarEvents, walkDriveFolder } from "./lib/google";

// Formats Astro's image pipeline (sharp) can process. HEIC from iPhones is not among them.
const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff"]);

function missing(collection: string, ...vars: string[]) {
  console.warn(`[${collection}] ${vars.join(", ")} not set – collection stays empty.`);
  return [];
}

const photos = defineCollection({
  loader: async () => {
    const { apiKey, photosFolderId } = env;
    if (!apiKey || !photosFolderId) return missing("photos", "GOOGLE_API_KEY", "DRIVE_PHOTOS_FOLDER_ID");

    const files = await walkDriveFolder(photosFolderId, apiKey);
    const skipped = files.filter((f) => !SUPPORTED_IMAGES.has(f.mimeType));
    if (skipped.length) {
      console.warn(`[photos] skipped ${skipped.length} unsupported file(s): ${skipped.map((f) => f.name).join(", ")}`);
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
          tags: f.tags,
        };
      });
  },
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    src: z.url(),
    width: z.number().optional(),
    height: z.number().optional(),
    takenAt: z.coerce.date(),
    tags: z.array(z.string()),
  }),
});

const documents = defineCollection({
  loader: async () => {
    const { apiKey, documentsFolderId } = env;
    if (!apiKey || !documentsFolderId) return missing("documents", "GOOGLE_API_KEY", "DRIVE_DOCUMENTS_FOLDER_ID");

    const files = await walkDriveFolder(documentsFolderId, apiKey);
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      mimeType: f.mimeType,
      url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
      size: f.size ? Number(f.size) : undefined,
      modifiedAt: f.modifiedTime,
      tags: f.tags,
    }));
  },
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    mimeType: z.string(),
    url: z.url(),
    size: z.number().optional(),
    modifiedAt: z.coerce.date(),
    tags: z.array(z.string()),
  }),
});

const events = defineCollection({
  loader: async () => {
    const { apiKey, calendarId } = env;
    if (!apiKey || !calendarId) return missing("events", "GOOGLE_API_KEY", "GOOGLE_CALENDAR_ID");

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear() + 1, now.getMonth(), 1);
    const items = await listCalendarEvents(calendarId, apiKey, from, to);

    return items.map((e) => ({
      id: e.id,
      title: e.summary?.trim() || "Termin",
      description: e.description ? htmlToText(e.description) : undefined,
      location: e.location,
      allDay: Boolean(e.start.date),
      // All-day events come as plain dates (end exclusive). Noon keeps them on the
      // right day regardless of the build machine timezone or DST shifts.
      start: e.start.dateTime ?? `${e.start.date}T12:00:00`,
      end: e.end.dateTime ?? `${e.end.date}T12:00:00`,
    }));
  },
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    location: z.string().optional(),
    allDay: z.boolean(),
    start: z.string(),
    end: z.string(),
  }),
});

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

export const collections = { photos, documents, events };
