// Local copy of Drive files. Each file is downloaded once per version (id + modifiedTime)
// and reused by the dev server and every later build. Without this, Drive gets one
// download per image per page view, which Google soon blocks as automated traffic.
import { createHash } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const CACHE_DIR = path.resolve(".cache/drive");

const MAX_PARALLEL = 3;
const RETRY_DELAYS_MS = [2_000, 6_000, 15_000];

let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file: string) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

export interface CacheRequest {
  id: string;
  /** Changes whenever the file changes in Drive; part of the cache key. */
  version: string;
  ext: string;
  /** Called only when the file is not cached yet. Never logged (contains the API key). */
  url: () => string;
  /** Used when Google blocks the API download, e.g. Drive's public download link. */
  fallbackUrl?: string;
}

/** Returns the absolute path of the cached file, downloading it if needed. */
export async function cachedDriveFile({ id, version, ext, url, fallbackUrl }: CacheRequest): Promise<string> {
  const tag = createHash("sha1").update(version).digest("hex").slice(0, 10);
  const file = path.join(CACHE_DIR, `${id}-${tag}.${ext}`);
  if (await exists(file)) return file;

  await mkdir(CACHE_DIR, { recursive: true });
  const body = await withSlot(() => download(id, url, fallbackUrl));
  const tmp = `${file}.part`;
  await writeFile(tmp, body);
  await rename(tmp, file);

  // Drop older versions of the same file.
  for (const name of await readdir(CACHE_DIR)) {
    if (name.startsWith(`${id}-`) && path.join(CACHE_DIR, name) !== file) {
      await rm(path.join(CACHE_DIR, name), { force: true });
    }
  }
  return file;
}

/** Once the API endpoint is blocked it stays blocked for a while; skip it for the rest of the run. */
let apiBlocked = false;

const isFile = (res: Response) => res.ok && !(res.headers.get("content-type") ?? "").startsWith("text/html");

async function download(id: string, url: () => string, fallbackUrl?: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    if (!apiBlocked || !fallbackUrl) {
      const res = await fetch(url());
      if (isFile(res)) return Buffer.from(await res.arrayBuffer());
      status = res.status;
      // Google answers rate limits with 403/429 and an HTML "Sorry…" page.
      if (status === 403 || status === 429) apiBlocked = true;
    }
    if (fallbackUrl) {
      const res = await fetch(fallbackUrl);
      if (isFile(res)) return Buffer.from(await res.arrayBuffer());
      status = res.status;
    }
    if (attempt >= RETRY_DELAYS_MS.length) {
      const reason =
        status === 403 || status === 429
          ? "Google is temporarily blocking downloads (too many requests) – try again later"
          : `HTTP ${status}`;
      throw new Error(`Drive download of ${id} failed: ${reason}`);
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}
