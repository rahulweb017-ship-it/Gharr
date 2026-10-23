import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { addBoqToCart } from "@/server/services/estimate.service";
import { BoqCartInput } from "@/shared/contracts/estimate";

const Params = z.object({ id: z.string().min(1) });

/**
 * POST /api/v1/estimates/:id/cart — "Buy Complete List".
 * Accepts line ids and pack counts only; prices and variants resolve server-side.
 */
export const POST = withRoute(
  { auth: "required", params: Params, body: BoqCartInput },
  async ({ actor, params, body }) => addBoqToCart(actor.userId, params.id, body),
);
