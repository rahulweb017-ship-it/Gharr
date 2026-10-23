import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { adminRetryRefund } from "@/server/services/admin/orders-admin.service";

const Params = z.object({ id: z.string().min(1) });

/** POST /api/v1/admin/refunds/:id/retry — ADMIN only; reuses the original idempotency key. */
export const POST = withRoute({ auth: "required", params: Params }, async ({ actor, params, requestId, ipHash }) =>
  adminRetryRefund(actor, params.id, { requestId, ipHash }),
);
