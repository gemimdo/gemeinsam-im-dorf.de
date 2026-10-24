import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

// Copies every Drive document into the static site at build time, so downloads
// come from our own server and visitors never contact Google.

export const getStaticPaths = (async () => {
  const documents = await getCollection("documents");
  return documents.map((doc) => ({
    params: { file: doc.data.fileName },
    props: { source: doc.data.source, mimeType: doc.data.mimeType },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const res = await fetch(props.source as string);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${new URL(props.source as string).pathname}`);
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": props.mimeType as string } });
};
