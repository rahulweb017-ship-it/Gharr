import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";
import { NotFoundError, ValidationError } from "@/server/http/errors";

/**
 * Private file storage — ID proofs, GST certificates, bank proofs.
 *
 * These are sensitive personal documents, so they never sit under /public and
 * are never served by a static path. Reads go through a staff-authorised route
 * that streams the bytes with no-store caching.
 *
 * Local disk in development; this module is the single swap point for S3 or R2.
 */

/** Lowercase path segments of [a-z0-9._-]; no leading slash, no "..". */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key) || key.includes("..")) {
    throw new ValidationError("Invalid storage key");
  }
  const root = path.resolve(env.PRIVATE_STORAGE_DIR);
  const full = path.resolve(root, key);
  // Belt and braces: the pattern already forbids traversal.
  if (!full.startsWith(root + path.sep)) throw new ValidationError("Invalid storage key");
  return full;
}

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

export async function putPrivate(key: string, bytes: Uint8Array | string): Promise<void> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readPrivate(key: string): Promise<{ bytes: Buffer; contentType: string; size: number }> {
  const full = resolveKey(key);
  try {
    const [bytes, info] = await Promise.all([readFile(full), stat(full)]);
    return { bytes, contentType: contentTypeFor(key), size: info.size };
  } catch {
    throw new NotFoundError("File");
  }
}
