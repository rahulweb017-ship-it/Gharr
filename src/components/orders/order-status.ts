import type { OrderStatus } from "@prisma/client";

/**
 * Pill colour for an order status. Green is reserved for goods that reached
 * the customer; labels themselves come from order-state.ts.
 */
export function orderTone(status: OrderStatus) {
  if (status === "DELIVERED") return "trust" as const;
  if (status === "CANCELLED" || status === "DELIVERY_FAILED") return "danger" as const;
  if (status === "PENDING_PAYMENT" || status === "RETURN_REQUESTED") return "warning" as const;
  if (status === "RETURNED" || status === "REFUNDED") return "neutral" as const;
  return "info" as const;
}
