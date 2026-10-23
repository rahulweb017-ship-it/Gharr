import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { checkout } from "@/server/services/checkout.service";
import { RATE_LIMITS } from "@/server/http/rate-limit";

const CheckoutInput = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "NETBANKING", "WALLET", "OFFLINE_MOCK"]),
  deliverySlotDate: z.string().optional(),
  deliverySlotStartMinute: z.number().int().min(0).max(1439).optional(),
  deliverySlotEndMinute: z.number().int().min(0).max(1439).optional(),
  customerNote: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

/** POST /api/v1/cart/checkout — cart becomes one order per vendor. */
export const POST = withRoute(
  {
    auth: "required",
    body: CheckoutInput,
    status: 201,
    rateLimit: { rule: RATE_LIMITS.orderCreatePerUserHour },
  },
  async ({ actor, body }) => checkout(actor.userId, body),
);
