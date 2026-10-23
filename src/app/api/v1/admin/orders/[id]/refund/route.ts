import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { adminRefundOrder } from "@/server/services/admin/orders-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  amountPaise: z.number().int().positive(),
  reason: z.string().trim().min(3, "Say why").max(500),
});

/** POST /api/v1/admin/orders/:id/refund — ADMIN only; partial refunds capped at what is left. */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body, status: 201 },
  async ({ actor, params, body, requestId, ipHash }) => adminRefundOrder(actor, params.id, body, { requestId, ipHash }),
);
