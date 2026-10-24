// Builds may run in UTC (CI), so every date is rendered explicitly in German local time.
export const TZ = "Europe/Berlin";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: TZ, ...opts });

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const dateFmt = fmt({ day: "numeric", month: "long", year: "numeric" });
const shortDateFmt = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });

export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONTHS_SHORT = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** "YYYY-MM-DD" of the instant in German local time. */
export const dayKey = (d: Date) => keyFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatShortDate = (d: Date) => shortDateFmt.format(d);

/** Calendar math on day keys, done in UTC so it never depends on the machine timezone. */
export function keyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export const utcToKey = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(key: string, days: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToKey(d);
}

export function describeKey(key: string) {
  const d = keyToUtc(key);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
    weekday: d.getUTCDay(),
    mon: MONTHS_SHORT[d.getUTCMonth()],
    wd: WEEKDAYS_SHORT[d.getUTCDay()],
    long: `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`,
  };
}

export function formatBytes(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
}

export function fileTypeLabel(ext: string): string {
  const map: Record<string, string> = { pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", odt: "ODT", jpg: "JPG", jpeg: "JPG", png: "PNG" };
  return map[ext] ?? ext.toUpperCase();
}
