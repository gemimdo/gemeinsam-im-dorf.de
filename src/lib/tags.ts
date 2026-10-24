export function uniqueTags(entries: { data: { tags: string[] } }[]): string[] {
  const tags = new Set(entries.flatMap((e) => e.data.tags));
  return [...tags].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
}
