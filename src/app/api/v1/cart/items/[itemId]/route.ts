import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { removeItem, updateItemQuantity } from "@/server/services/cart.service";

const Params = z.object({ itemId: z.string().min(1) });
const UpdateInput = z.object({ quantity: z.number().min(0) });

/** PATCH /api/v1/cart/items/:itemId */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: UpdateInput },
  async ({ actor, params, body }) =>
    updateItemQuantity(actor.userId, params.itemId, body.quantity),
);

/** DELETE /api/v1/cart/items/:itemId */
export const DELETE = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => removeItem(actor.userId, params.itemId),
);
