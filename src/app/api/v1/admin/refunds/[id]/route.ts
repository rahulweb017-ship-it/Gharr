import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getAdminRefund } from "@/server/services/admin/orders-admin.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/admin/refunds/:id — a refund and its payment (SUPPORT may read). */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) =>
  getAdminRefund(actor, params.id),
);
