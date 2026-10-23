import { withRoute } from "@/server/http/route";
import { clearCart, getCart } from "@/server/services/cart.service";

/** GET /api/v1/cart */
export const GET = withRoute({ auth: "required" }, async ({ actor }) =>
  getCart(actor.userId),
);

/** DELETE /api/v1/cart — empties the cart and drops any applied coupon. */
export const DELETE = withRoute({ auth: "required" }, async ({ actor }) =>
  clearCart(actor.userId),
);

export const dynamic = "force-dynamic";
