import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Small JSON store. On Vercel it uses a private Blob store; locally (no token)
 * it falls back to files under .data/ so the app can run against mock data.
 */
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const localDir = path.join(process.cwd(), ".data");
const localPath = (key: string) => path.join(localDir, key.replace(/\//g, "__"));

export async function getJSON<T>(key: string): Promise<T | null> {
  if (useBlob()) {
    const { get } = await import("@vercel/blob");
    try {
      const res = await get(key, { access: "private", useCache: false });
      if (!res || !res.stream) return null;
      const text = await new Response(res.stream as ReadableStream).text();
      return JSON.parse(text) as T;
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? "";
      if (name === "BlobNotFoundError") return null;
      throw err;
    }
  }
  try {
    return JSON.parse(await fs.readFile(localPath(key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function putJSON(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(key, body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(localPath(key), body, "utf8");
}

export async function deletePrefix(prefix: string): Promise<void> {
  if (useBlob()) {
    const { list, del } = await import("@vercel/blob");
    let cursor: string | undefined;
    do {
      const res = await list({ prefix, cursor, limit: 500 });
      if (res.blobs.length) await del(res.blobs.map((b) => b.url));
      cursor = res.cursor;
    } while (cursor);
    return;
  }
  try {
    const flat = prefix.replace(/\//g, "__");
    for (const f of await fs.readdir(localDir)) {
      if (f.startsWith(flat)) await fs.unlink(path.join(localDir, f));
    }
  } catch {
    /* nothing to delete */
  }
}
