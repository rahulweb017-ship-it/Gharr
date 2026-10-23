import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getOrder } from "@/server/services/order.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/orders/:id */
export const GET = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => getOrder(params.id, actor),
);
