import { withRoute } from "@/server/http/route";
import { reviewDocument } from "@/server/services/admin/verification.service";
import { IdParams, ReviewBody } from "../../../_schemas";

/** POST /api/v1/admin/verification/documents/:id/review — approve or reject (notes required) one document. */
export const POST = withRoute(
  { auth: "required", params: IdParams, body: ReviewBody },
  async ({ actor, params, body, requestId, ipHash }) => reviewDocument(actor, params.id, body, { requestId, ipHash }),
);
