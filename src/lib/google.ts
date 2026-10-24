// All Google requests happen at build time with a plain API key, so the
// Drive folders and the calendar must be shared publicly ("anyone with the link").
// Visitors never talk to Google: images are downloaded and optimized by Astro.

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const env = {
  apiKey: read("GOOGLE_API_KEY"),
  calendarId: read("GOOGLE_CALENDAR_ID"),
  photosFolderId: read("DRIVE_PHOTOS_FOLDER_ID"),
  documentsFolderId: read("DRIVE_DOCUMENTS_FOLDER_ID"),
};

function read(name: string): string | undefined {
  return import.meta.env[name] || process.env[name] || undefined;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  description?: string;
  webViewLink?: string;
  imageMediaMetadata?: { width?: number; height?: number; rotation?: number; time?: string };
  /** Names of the subfolders between the root folder and this file. */
  tags: string[];
}

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google API ${res.status} for ${url.pathname}: ${body.slice(0, 500)}`);
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
      "nextPageToken, files(id, name, mimeType, modifiedTime, size, description, webViewLink, imageMediaMetadata(width, height, rotation, time))",
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

export function publicIcsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}
