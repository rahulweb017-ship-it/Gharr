import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { reviewProduct } from "@/server/services/admin/catalog-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).nullish(),
});

/** POST /api/v1/admin/catalogue/products/:id/review — approve or reject a supplier submission. */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => reviewProduct(actor, params.id, body, { requestId, ipHash }),
);
