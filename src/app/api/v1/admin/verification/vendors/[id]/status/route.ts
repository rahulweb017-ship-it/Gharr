import { withRoute } from "@/server/http/route";
import { setVendorStatus } from "@/server/services/admin/verification.service";
import { IdParams, StatusBody } from "../../../_schemas";

/** POST /api/v1/admin/verification/vendors/:id/status — verify, reject (reason required) or move back to pending. */
export const POST = withRoute(
  { auth: "required", params: IdParams, body: StatusBody },
  async ({ actor, params, body, requestId, ipHash }) => setVendorStatus(actor, params.id, body, { requestId, ipHash }),
);
