import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listProducts } from "@/server/services/admin/catalog-admin.service";

const Query = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(64).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  lowStock: z.enum(["1", "true"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/v1/admin/catalogue — ADMIN product table. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  listProducts(actor, {
    q: query.q,
    categoryId: query.category,
    status: query.status,
    lowStock: !!query.lowStock,
    page: query.page,
    perPage: query.perPage,
  }),
);
