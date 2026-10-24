import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { readFile } from "node:fs/promises";
import { cachedDriveFile } from "../../../lib/drive-cache";
import { driveDownloadUrl, driveExportPdfUrl, drivePublicDownloadUrl, env } from "../../../lib/google";

// Copies every Drive document into the static site at build time, so downloads
// come from our own server and visitors never contact Google.

export const getStaticPaths = (async () => {
  const documents = await getCollection("documents");
  return documents.map(({ data }) => ({
    params: { file: data.fileName },
    props: {
      driveId: data.driveId,
      exported: data.exported,
      version: data.modifiedAt.toISOString(),
      ext: data.ext,
      mimeType: data.mimeType,
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { driveId, exported, version, ext, mimeType } = props as {
    driveId: string;
    exported: boolean;
    version: string;
    ext: string;
    mimeType: string;
  };
  const apiKey = env.apiKey!;
  const file = await cachedDriveFile({
    id: driveId,
    version,
    ext,
    url: () => (exported ? driveExportPdfUrl(driveId, apiKey) : driveDownloadUrl(driveId, apiKey)),
    fallbackUrl: exported ? undefined : drivePublicDownloadUrl(driveId),
  });
  return new Response(await readFile(file), { headers: { "Content-Type": mimeType } });
};
