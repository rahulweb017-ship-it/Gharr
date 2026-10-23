import { z } from "zod";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { dateRange } from "@/lib/admin-format";
import { listAdminOrders } from "@/server/services/admin/orders-admin.service";

const Query = z.object({
  view: z.enum(["attention"]).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  vendor: z.string().min(1).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/v1/admin/orders — staff order search (SUPPORT may read). */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  listAdminOrders(actor, { ...query, vendorId: query.vendor, placedAt: dateRange(query.from, query.to) }),
);
