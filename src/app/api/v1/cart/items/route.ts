import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { addItem } from "@/server/services/cart.service";

const AddItemInput = z.object({
  variantId: z.string().min(1),
  quantity: z.number().positive(),
});

/** POST /api/v1/cart/items */
export const POST = withRoute(
  { auth: "required", body: AddItemInput, status: 201 },
  async ({ actor, body }) => addItem(actor.userId, body.variantId, body.quantity),
);
