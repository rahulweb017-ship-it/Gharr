import { withRoute } from "@/server/http/route";
import { setWorkerStatus } from "@/server/services/admin/verification.service";
import { IdParams, StatusBody } from "../../../_schemas";

/** POST /api/v1/admin/verification/workers/:id/status — verify, reject (reason required) or move back to pending. */
export const POST = withRoute(
  { auth: "required", params: IdParams, body: StatusBody },
  async ({ actor, params, body, requestId, ipHash }) => setWorkerStatus(actor, params.id, body, { requestId, ipHash }),
);
