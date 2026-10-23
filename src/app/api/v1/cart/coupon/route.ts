import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { applyCoupon, removeCoupon } from "@/server/services/cart.service";

const CouponInput = z.object({
  code: z.string().trim().min(3).max(24),
});

/** POST /api/v1/cart/coupon */
export const POST = withRoute(
  { auth: "required", body: CouponInput },
  async ({ actor, body }) => applyCoupon(actor.userId, body.code),
);

/** DELETE /api/v1/cart/coupon */
export const DELETE = withRoute({ auth: "required" }, async ({ actor }) =>
  removeCoupon(actor.userId),
);
