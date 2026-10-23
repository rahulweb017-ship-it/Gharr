import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { readDocumentFile } from "@/server/services/admin/verification.service";

const Params = z.object({ id: z.string().min(1) });
const Query = z.object({ kind: z.enum(["vendor", "worker"]) });

/**
 * GET /api/v1/admin/documents/:id/file?kind=vendor|worker — streams a private
 * verification document to an administrator.
 *
 * Uploaded files are untrusted: an "image" may be an SVG carrying script. The
 * CSP sandbox gives the response an opaque origin with scripts disabled, and
 * nosniff stops a browser second-guessing the declared type. PDFs skip only the
 * `sandbox` directive — browser PDF viewers refuse to render inside one — and
 * still get `default-src 'none'`.
 */
export const GET = withRoute(
  { auth: "required", params: Params, query: Query },
  async ({ actor, params, query, requestId, ipHash }) => {
    const file = await readDocumentFile(actor, query.kind, params.id, { requestId, ipHash });
    const csp = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
    return new Response(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": file.contentType === "application/pdf" ? csp : `sandbox; ${csp}`,
        "X-Request-Id": requestId,
      },
    });
  },
);
