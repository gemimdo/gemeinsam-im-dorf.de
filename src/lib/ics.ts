import type { EventView } from "./events";
import { addDays } from "./format";

const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (key: string) => key.replace(/-/g, "");

/** RFC 5545: lines longer than 75 bytes continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // keep UTF-8 characters whole
    parts.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
  }
  return parts.join("\r\n ");
}

function vevent(event: EventView, stamp: string, site: URL): string[] {
  const lastDay = event.days[event.days.length - 1];
  const timing = event.allDay
    ? [`DTSTART;VALUE=DATE:${dateOnly(event.firstDay)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(lastDay, 1))}`]
    : [`DTSTART:${utcStamp(new Date(event.start))}`, `DTEND:${utcStamp(new Date(event.end))}`];
  const description = [event.description, event.fee && `Eintritt: ${event.fee}`, event.contact && `Kontakt: ${event.contact}`]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:${event.id}@gemeinsam-im-dorf.de`,
    `DTSTAMP:${stamp}`,
    ...timing,
    `SUMMARY:${escape(event.title)}`,
    `CATEGORIES:${escape(event.categoryLabel)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(description ? [`DESCRIPTION:${escape(description)}`] : []),
    ...event.attachments.map((a) => `ATTACH;FMTTYPE=${a.mimeType}:${new URL(a.href, site).href}`),
    "END:VEVENT",
  ];
}

/** A complete .ics file. `name` is shown by calendar apps for subscribed feeds. */
export function icsFile(events: EventView[], site: URL | undefined, name?: string): Response {
  const base = site ?? new URL("https://gemeinsam-im-dorf.de");
  const stamp = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//gemeinsam-im-dorf.de//Termine//DE",
    "CALSCALE:GREGORIAN",
    ...(name ? [`X-WR-CALNAME:${escape(name)}`, "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"] : []),
    ...events.flatMap((e) => vevent(e, stamp, base)),
    "END:VCALENDAR",
  ];
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}
