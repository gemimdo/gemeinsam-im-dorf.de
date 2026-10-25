// All Google requests happen at build time with a plain API key, so the
// Drive folders and the calendar must be shared publicly ("anyone with the link").
// Visitors never talk to Google: images are downloaded and optimized by Astro.

import type { EventCategory } from "../site.config";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const env = {
  apiKey: read("GOOGLE_API_KEY"),
  /** One public calendar per event category (src/site.config.ts → eventCategories). */
  calendars: {
    verein: read("GOOGLE_CALENDAR_ID"),
  } satisfies Record<EventCategory, string | undefined>,
  photosFolderId: read("DRIVE_PHOTOS_FOLDER_ID"),
  documentsFolderId: read("DRIVE_DOCUMENTS_FOLDER_ID"),
};

/** The category calendars that have an ID configured. */
export function configuredCalendars(): [EventCategory, string][] {
  return (Object.entries(env.calendars) as [EventCategory, string | undefined][]).filter(
    (entry): entry is [EventCategory, string] => Boolean(entry[1]),
  );
}

function read(name: string): string | undefined {
  // import.meta.env only exists inside Astro/Vite; plain scripts (scripts/) use process.env.
  return import.meta.env?.[name] || process.env[name] || undefined;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  size?: string;
  fileExtension?: string;
  /** Short-lived preview image URL (also for PDFs); size suffix like "=s220". */
  thumbnailLink?: string;
  description?: string;
  webViewLink?: string;
  imageMediaMetadata?: { width?: number; height?: number; rotation?: number; time?: string };
  /** Names of the subfolders between the root folder and this file. */
  tags: string[];
}

/** With an API key Google answers 404 for anything that isn't shared publicly. */
function hint(url: URL, status: number): string {
  if (status === 404 && url.pathname.startsWith("/calendar/")) {
    return " – the calendar is not public (or the ID is wrong). Calendar settings → Access permissions → “Make available to public” + “See all event details”.";
  }
  if (status === 404) {
    return " – the folder or file is not shared as “Anyone with the link” (or the ID is wrong).";
  }
  if (status === 403) {
    return " – the API key is invalid, restricted, or the Drive/Calendar API is not enabled for its project.";
  }
  return "";
}

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    const message = (() => {
      try {
        return JSON.parse(body).error?.message as string;
      } catch {
        return body.slice(0, 200);
      }
    })();
    throw new Error(`Google API ${res.status} for ${decodeURIComponent(url.pathname)}: ${message}${hint(url, res.status)}`);
  }
  return res.json() as Promise<T>;
}

async function listChildren(folderId: string, apiKey: string): Promise<Omit<DriveFile, "tags">[]> {
  const files: Omit<DriveFile, "tags">[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(DRIVE_API);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set(
      "fields",
      "nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, size, fileExtension, thumbnailLink, description, webViewLink, imageMediaMetadata(width, height, rotation, time))",
    );
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await getJson<{ files: Omit<DriveFile, "tags">[]; nextPageToken?: string }>(url);
    files.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

/** Recursively lists all files below a folder; each subfolder name becomes a tag. */
export async function walkDriveFolder(rootId: string, apiKey: string, tags: string[] = []): Promise<DriveFile[]> {
  // Listing a folder that isn't shared returns an empty list, not an error. Reading the
  // top folder itself does fail, so an unshared folder can't silently empty the site.
  if (tags.length === 0) {
    const url = new URL(`${DRIVE_API}/${rootId}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fields", "mimeType");
    const root = await getJson<{ mimeType: string }>(url);
    if (root.mimeType !== FOLDER_MIME) throw new Error(`Drive ID ${rootId} is a file, not a folder.`);
  }
  const children = await listChildren(rootId, apiKey);
  const nested = await Promise.all(
    children.map((child) =>
      child.mimeType === FOLDER_MIME
        ? walkDriveFolder(child.id, apiKey, [...tags, child.name.trim()])
        : Promise.resolve([{ ...child, tags }]),
    ),
  );
  return nested.flat();
}

export function driveDownloadUrl(fileId: string, apiKey: string): string {
  return `${DRIVE_API}/${fileId}?alt=media&key=${apiKey}`;
}

/** Drive's own download link for files shared as "Anyone with the link"; needs no API key. */
export function drivePublicDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
}

/** Google Docs/Sheets/Slides have no binary to download; Drive renders them to PDF instead. */
export function driveExportPdfUrl(fileId: string, apiKey: string): string {
  return `${DRIVE_API}/${fileId}/export?mimeType=application%2Fpdf&key=${apiKey}`;
}

export const GOOGLE_EXPORTABLE = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing",
]);

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

export async function listCalendarEvents(
  calendarId: string,
  apiKey: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${CALENDAR_API}/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("key", apiKey);
    // Expands recurring events into single occurrences so we never parse RRULEs ourselves.
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("maxResults", "2500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await getJson<{ items: CalendarEvent[]; nextPageToken?: string }>(url);
    events.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return events;
}

/** One month back to twelve months ahead – what the site shows and what the change check watches. */
export function calendarRange(now = new Date()) {
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: new Date(now.getFullYear() + 1, now.getMonth() + 1, 1),
  };
}

/** Events of all category calendars, each tagged with its category. */
export async function listCategoryEvents(apiKey: string, timeMin: Date, timeMax: Date) {
  const perCalendar = await Promise.all(
    configuredCalendars().map(async ([category, calendarId]) =>
      (await listCalendarEvents(calendarId, apiKey, timeMin, timeMax)).map((event) => ({ category, event })),
    ),
  );
  return perCalendar.flat();
}
