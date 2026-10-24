// Builds may run in UTC (CI), so every date is rendered explicitly in German local time.
const TZ = "Europe/Berlin";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: TZ, ...opts });

const dayFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const monthFmt = fmt({ month: "long", year: "numeric" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const dateFmt = fmt({ day: "numeric", month: "long", year: "numeric" });
const keyFmt = fmt({ year: "numeric", month: "2-digit" });

export const formatDay = (d: Date) => dayFmt.format(d);
export const formatMonth = (d: Date) => monthFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const monthKey = (d: Date) => keyFmt.format(d);

export interface EventTiming {
  start: Date;
  end: Date;
  allDay: boolean;
}

export function formatEventTime({ start, end, allDay }: EventTiming): string {
  if (allDay) {
    const lastDay = new Date(end.getTime() - 86_400_000);
    return lastDay > start ? `${formatDay(start)} – ${formatDay(lastDay)}` : "ganztägig";
  }
  const sameDay = formatDay(start) === formatDay(end);
  return sameDay
    ? `${formatTime(start)} – ${formatTime(end)} Uhr`
    : `${formatDay(start)}, ${formatTime(start)} – ${formatDay(end)}, ${formatTime(end)} Uhr`;
}

export function formatBytes(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
}

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.spreadsheet": "Google Tabelle",
  "application/vnd.google-apps.presentation": "Google Präsentation",
  "application/vnd.google-apps.form": "Formular",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.oasis.opendocument.text": "ODT",
  "text/plain": "Text",
};

export function mimeLabel(mime: string): string {
  return MIME_LABELS[mime] ?? (mime.startsWith("image/") ? "Bild" : mime.split("/").pop()!.toUpperCase());
}

/** Short badge text for the document icon. */
export function mimeBadge(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (/document|word|opendocument\.text|text\/plain/.test(mime)) return "DOC";
  if (/spreadsheet|excel/.test(mime)) return "XLS";
  if (/presentation|powerpoint/.test(mime)) return "PPT";
  if (mime.startsWith("image/")) return "IMG";
  return "FILE";
}
