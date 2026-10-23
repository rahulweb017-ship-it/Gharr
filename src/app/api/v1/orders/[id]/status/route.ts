import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { transition } from "@/server/services/order.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  status: z.enum([
    "CONFIRMED", "ACCEPTED", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY",
    "DELIVERED", "DELIVERY_FAILED", "CANCELLED", "RETURN_REQUESTED",
    "RETURNED", "REFUNDED",
  ]),
  reason: z.string().max(300).optional(),
});

/**
 * PATCH /api/v1/orders/:id/status
 *
 * Legality of the move is decided by the state table in order-state.ts, not by
 * the caller — an unauthorised or out-of-sequence transition returns 409.
 */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body }) =>
    transition(actor, params.id, body.status, { reason: body.reason }),
);
