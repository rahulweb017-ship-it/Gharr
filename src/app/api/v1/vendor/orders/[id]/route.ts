import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getVendorOrder } from "@/server/services/vendor/orders.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/vendor/orders/:id — one of the supplier's orders, with the buyer's contact. */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) =>
  getVendorOrder(actor, params.id),
);
