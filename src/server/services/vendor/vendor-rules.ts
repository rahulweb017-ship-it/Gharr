import type { DocumentType } from "@prisma/client";
import { REQUIRED_DOCUMENTS } from "@/server/services/admin/verification-rules";

/**
 * Pure rules for supplier self-service — no Prisma client, so they are unit
 * tested and shared by the API validation and the portal forms.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Indian GSTIN: 2-digit state, PAN, entity number, "Z", checksum. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

/** A supplier can only upload the documents its verification actually needs. */
export const VENDOR_DOCUMENT_TYPES: DocumentType[] = REQUIRED_DOCUMENTS.vendor.flatMap((r) => r.anyOf);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES).join(",");

/**
 * Checks an uploaded file and returns the extension to store it under. The
 * extension comes from the declared type, never the client's file name, so a
 * name like "gst.pdf.html" cannot change how the file is later served.
 */
export function checkUpload(file: { type: string; size: number }): { ok: true; ext: string } | { ok: false; message: string } {
  const ext = UPLOAD_TYPES[file.type];
  if (!ext) return { ok: false, message: "Upload a PDF, PNG, JPG or WebP file" };
  if (file.size <= 0) return { ok: false, message: "The file is empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "Files must be 5 MB or smaller" };
  return { ok: true, ext };
}

/** Magic-byte sniff so a renamed executable is not accepted as a "PDF". */
export function sniffMatches(ext: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (ext) {
    case "pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "jpg":
      return starts(0xff, 0xd8, 0xff);
    case "webp":
      return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    default:
      return false;
  }
}

/** Same shape the seed uses, so search ranks supplier products like the rest. */
export function buildSearchText(parts: { name: string; brand?: string | null; category: string; short: string }): string {
  return [parts.name, parts.brand ?? "", parts.category, parts.short].join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}
