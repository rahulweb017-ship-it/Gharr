import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { cancelOrder } from "@/server/services/order.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({ reason: z.string().min(3).max(300) });

/** POST /api/v1/orders/:id/cancel */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body }) => cancelOrder(actor, params.id, body.reason),
);
