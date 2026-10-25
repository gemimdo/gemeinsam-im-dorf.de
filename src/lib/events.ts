import type { ImageMetadata } from "astro";
import { getCollection } from "astro:content";
import { eventCategories, type EventCategory } from "../site.config";
import { MONTHS, addDays, dayKey, describeKey, formatTime, keyToUtc, utcToKey } from "./format";

export interface EventView {
  id: string;
  title: string;
  category: EventCategory;
  categoryLabel: string;
  location?: string;
  description?: string;
  fee?: string;
  contact?: string;
  allDay: boolean;
  start: string;
  end: string;
  /** Every German-local day the event covers (all-day events can span several). */
  days: string[];
  firstDay: string;
  /** "11:00 – 13:00 Uhr", "22:00 Uhr – Sa, 02:00 Uhr" or "ganztägig" */
  timeLabel: string;
  /** "Samstag, 7. November 2026, 11:00 – 13:00 Uhr" */
  whenLong: string;
  icsPath: string;
  attachments: EventAttachment[];
}

export interface EventAttachment {
  title: string;
  href: string;
  type: string;
  mimeType: string;
  size?: number;
  /** Viewer images; empty when the file can only be downloaded. */
  pages: ImageMetadata[];
  /** id of its PageViewer overlay */
  viewerId: string;
}

/** Start and end of a timed event; the end day is named only when it differs. */
function timeRange(start: Date, end: Date): string {
  const from = formatTime(start);
  if (end.getTime() <= start.getTime()) return `${from} Uhr`;
  const endDay = dayKey(end);
  if (endDay === dayKey(start)) return `${from} – ${formatTime(end)} Uhr`;
  return `${from} Uhr – ${describeKey(endDay).wd}, ${formatTime(end)} Uhr`;
}

export async function getEvents(): Promise<EventView[]> {
  const entries = await getCollection("events");
  return entries
    .map(({ id, data }) => {
      const start = new Date(data.start);
      const end = new Date(data.end);
      const firstDay = dayKey(start);
      // All-day end dates are exclusive; timed events are shown on their start day only.
      const lastDay = data.allDay ? addDays(dayKey(end), -1) : firstDay;
      const days: string[] = [];
      for (let k = firstDay; k <= lastDay; k = addDays(k, 1)) days.push(k);

      const first = describeKey(firstDay);
      const timeLabel = data.allDay ? "ganztägig" : timeRange(start, end);
      const lastLabel = lastDay !== firstDay ? ` bis ${describeKey(lastDay).long}` : "";
      return {
        id,
        ...data,
        categoryLabel: eventCategories[data.category].label,
        days,
        firstDay,
        timeLabel,
        whenLong: `${first.long} ${first.year}${lastLabel}${data.allDay ? "" : `, ${timeLabel}`}`,
        icsPath: `/termine/${encodeURIComponent(id)}.ics`,
        attachments: data.attachments.map((a) => ({
          title: a.title,
          href: `/termine/anhaenge/${a.fileName}`,
          type: a.ext.toUpperCase(),
          mimeType: a.mimeType,
          pages: a.pages,
          viewerId: `viewer-${a.fileName.replace(/[^a-z0-9-]/gi, "-")}`,
          size: a.size,
        })),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export interface MonthView {
  key: string; // "2026-10"
  label: string; // "Oktober 2026"
  /** Monday-first grid, padded with neighbouring days. */
  cells: { key: string; inMonth: boolean; day: number }[];
}

/** Months from one before the build month to twelve after – the range the loader fetches. */
export function buildMonths(now = new Date()): MonthView[] {
  const today = keyToUtc(dayKey(now));
  const months: MonthView[] = [];
  for (let offset = -1; offset <= 12; offset++) {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
    const month = first.getUTCMonth();
    const lead = (first.getUTCDay() + 6) % 7;
    const daysIn = new Date(Date.UTC(first.getUTCFullYear(), month + 1, 0)).getUTCDate();
    const total = Math.ceil((lead + daysIn) / 7) * 7;
    const cells = Array.from({ length: total }, (_, i) => {
      const d = new Date(Date.UTC(first.getUTCFullYear(), month, 1 - lead + i));
      return { key: utcToKey(d), inMonth: d.getUTCMonth() === month, day: d.getUTCDate() };
    });
    months.push({ key: utcToKey(first).slice(0, 7), label: `${MONTHS[month]} ${first.getUTCFullYear()}`, cells });
  }
  return months;
}

export function eventsByDay(events: EventView[]): Map<string, EventView[]> {
  const map = new Map<string, EventView[]>();
  for (const e of events) {
    for (const d of e.days) {
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
  }
  return map;
}

/** webcal:// link to the combined feed (src/pages/termine/alle.ics.ts); calendar apps open it as a subscription. */
export function subscribeUrl(site: URL | undefined): string {
  const url = new URL("/termine/alle.ics", site ?? "https://gemeinsam-im-dorf.de");
  return url.href.replace(/^https?:/, "webcal:");
}
