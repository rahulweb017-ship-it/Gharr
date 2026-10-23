import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listOrders } from "@/server/services/order.service";

const Query = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(20),
});

/** GET /api/v1/orders */
export const GET = withRoute(
  { auth: "required", query: Query },
  async ({ actor, query }) => listOrders(actor.userId, query.page, query.perPage),
);
