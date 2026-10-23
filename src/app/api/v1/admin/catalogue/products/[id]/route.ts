import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getProduct, updateProduct } from "@/server/services/admin/catalog-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({ isActive: z.boolean() }).strict();

/** GET /api/v1/admin/catalogue/products/:id */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) =>
  getProduct(actor, params.id),
);

/** PATCH /api/v1/admin/catalogue/products/:id — list or delist a product. */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => updateProduct(actor, params.id, body, { requestId, ipHash }),
);
