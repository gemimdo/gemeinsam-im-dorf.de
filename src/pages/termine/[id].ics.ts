import type { APIRoute, GetStaticPaths } from "astro";
import { getEvents, type EventView } from "../../lib/events";
import { addDays } from "../../lib/format";

// One .ics file per event for the "In meinen Kalender" buttons.

export const getStaticPaths = (async () => {
  const events = await getEvents();
  return events.map((event) => ({ params: { id: event.id }, props: { event } }));
}) satisfies GetStaticPaths;

const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (key: string) => key.replace(/-/g, "");

export const GET: APIRoute = ({ props }) => {
  const event = props.event as EventView;
  const lastDay = event.days[event.days.length - 1];
  const timing = event.allDay
    ? [`DTSTART;VALUE=DATE:${dateOnly(event.firstDay)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(lastDay, 1))}`]
    : [`DTSTART:${utcStamp(new Date(event.start))}`, `DTEND:${utcStamp(new Date(event.end))}`];

  const description = [event.description, event.fee && `Eintritt: ${event.fee}`, event.contact && `Kontakt: ${event.contact}`]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//gemeinsam-im-dorf.de//Termine//DE",
    "BEGIN:VEVENT",
    `UID:${event.id}@gemeinsam-im-dorf.de`,
    `DTSTAMP:${utcStamp(new Date())}`,
    ...timing,
    `SUMMARY:${escape(event.title)}`,
    event.location && `LOCATION:${escape(event.location)}`,
    description && `DESCRIPTION:${escape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
};
