// Prints a hash of everything the site pulls from Google. The scheduled
// workflow compares it with the last deployed one and skips the build when
// nothing changed. Run: bun scripts/content-fingerprint.ts
import { createHash } from "node:crypto";
import { calendarRange, env, listCalendarEvents, walkDriveFolder } from "../src/lib/google.ts";

const { apiKey, calendarId, photosFolderId, documentsFolderId } = env;
if (!apiKey || !calendarId || !photosFolderId || !documentsFolderId) {
  console.error("GOOGLE_API_KEY, GOOGLE_CALENDAR_ID, DRIVE_PHOTOS_FOLDER_ID and DRIVE_DOCUMENTS_FOLDER_ID must be set.");
  process.exit(1);
}

const { from, to } = calendarRange();
const [photos, documents, events] = await Promise.all([
  walkDriveFolder(photosFolderId, apiKey),
  walkDriveFolder(documentsFolderId, apiKey),
  listCalendarEvents(calendarId, apiKey, from, to),
]);

const driveState = (files: Awaited<ReturnType<typeof walkDriveFolder>>) =>
  files
    .map((f) => [f.id, f.name, f.modifiedTime, f.description ?? "", f.tags.join("/")].join("|"))
    .sort();

const hash = createHash("sha256")
  .update(JSON.stringify({
    photos: driveState(photos),
    documents: driveState(documents),
    events,
    // The date is part of the hash, so the site rebuilds at least once a day
    // (the calendar shows a rolling range of months).
    day: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()),
  }))
  .digest("hex");

console.log(hash);
