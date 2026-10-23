import { z } from "zod";
import type { DocumentType } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import { ValidationError } from "@/server/http/errors";
import { uploadVendorDocument } from "@/server/services/vendor/onboarding.service";
import { MAX_UPLOAD_BYTES, VENDOR_DOCUMENT_TYPES } from "@/server/services/vendor/vendor-rules";

const DocType = z.string().refine((v): v is DocumentType => VENDOR_DOCUMENT_TYPES.includes(v as DocumentType));

/**
 * POST /api/v1/vendor/documents — multipart upload of one KYC document
 * (fields: `type`, `file`). withRoute only parses JSON bodies, so the form is
 * read here; auth, CSRF and rate limiting still come from the wrapper.
 */
export const POST = withRoute(
  { auth: "required", status: 201, rateLimit: { rule: RATE_LIMITS.vendorUploadPerUserHour } },
  async ({ actor, request, requestId, ipHash }) => {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new ValidationError("Files must be 5 MB or smaller");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Send the document as multipart/form-data");
    }
    const type = DocType.safeParse(form.get("type"));
    if (!type.success) throw new ValidationError("Choose which document this is", [{ field: "type", message: "Unknown document type" }]);
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Attach a file", [{ field: "file", message: "Missing file" }]);

    const bytes = new Uint8Array(await file.arrayBuffer());
    return uploadVendorDocument(
      actor,
      type.data as DocumentType,
      { type: file.type, size: bytes.byteLength, bytes },
      { requestId, ipHash },
    );
  },
);
