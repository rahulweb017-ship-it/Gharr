import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getAdminOrder } from "@/server/services/admin/orders-admin.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/admin/orders/:id — order, payment and refunds (SUPPORT may read). */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) =>
  getAdminOrder(actor, params.id),
);
