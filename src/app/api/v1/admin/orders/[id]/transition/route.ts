import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { adminTransitionOrder } from "@/server/services/admin/orders-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  to: z.nativeEnum(OrderStatus),
  reason: z.string().trim().max(500).optional(),
});

/** POST /api/v1/admin/orders/:id/transition — ADMIN only; prepaid cancels auto-refund. */
export const POST = withRoute({ auth: "required", params: Params, body: Body }, async ({ actor, params, body, requestId, ipHash }) =>
  adminTransitionOrder(actor, params.id, body.to, body.reason, { requestId, ipHash }),
);
