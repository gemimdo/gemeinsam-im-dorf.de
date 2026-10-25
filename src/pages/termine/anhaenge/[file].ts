import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { readFile } from "node:fs/promises";
import { cachedDriveFile } from "../../../lib/drive-cache";
import { driveDownloadUrl, driveExportPdfUrl, drivePublicDownloadUrl, env } from "../../../lib/google";

// Serves the Drive attachments of calendar events from our own server
// (they are downloaded into the cache by the events loader).

export const getStaticPaths = (async () => {
  const events = await getCollection("events");
  const files = new Map<string, (typeof events)[number]["data"]["attachments"][number]>();
  for (const event of events) for (const a of event.data.attachments) files.set(a.fileName, a);
  return [...files.values()].map((attachment) => ({ params: { file: attachment.fileName }, props: { attachment } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { driveId, version, exported, ext, mimeType } = props.attachment as {
    driveId: string;
    version: string;
    exported: boolean;
    ext: string;
    mimeType: string;
  };
  const apiKey = env.apiKey!;
  const file = await cachedDriveFile({
    id: driveId,
    version,
    ext,
    // Already cached by the loader; these URLs are only a fallback.
    url: () => (exported ? driveExportPdfUrl(driveId, apiKey) : driveDownloadUrl(driveId, apiKey)),
    fallbackUrl: exported ? undefined : drivePublicDownloadUrl(driveId),
  });
  return new Response(await readFile(file), { headers: { "Content-Type": mimeType } });
};
