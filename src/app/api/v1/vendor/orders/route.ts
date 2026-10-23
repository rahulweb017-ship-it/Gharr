import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { listVendorOrders } from "@/server/services/order.service";
import { OPEN_STATUSES } from "@/server/services/vendor/earnings.service";

const Query = z.object({
  view: z.enum(["open", "all", "delivered", "cancelled"]).default("open"),
  q: z.string().trim().max(30).optional(),
});

const VIEW_STATUSES: Record<z.infer<typeof Query>["view"], OrderStatus[] | undefined> = {
  open: OPEN_STATUSES,
  all: undefined,
  delivered: ["DELIVERED"],
  cancelled: ["CANCELLED", "RETURNED", "REFUNDED"],
};

/**
 * GET /api/v1/vendor/orders — the supplier's orders. Moving an order uses the
 * shared PATCH /api/v1/orders/:id/status, which applies the vendor state table.
 */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  listVendorOrders(actor, undefined, { statuses: VIEW_STATUSES[query.view], q: query.q, take: 100 }),
);
