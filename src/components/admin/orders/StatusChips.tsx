import type { BookingStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { Chip } from "@/components/ui/Chip";
import { orderTone } from "@/components/orders/order-status";
import { bookingTone } from "@/components/labour/booking-status";
import { humanize } from "@/lib/admin-format";

/**
 * Status pills for the orders and bookings screens. Staff see the raw status
 * name (humanised) rather than customer copy — "Cancelled by customer", not
 * "Cancelled by you".
 */

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  return <Chip tone={orderTone(status)}>{humanize(status)}</Chip>;
}

export function BookingStatusChip({ status }: { status: BookingStatus }) {
  // A dispute is waiting on staff, which is louder than "cancelled".
  return <Chip tone={status === "DISPUTED" ? "warning" : bookingTone(status)}>{humanize(status)}</Chip>;
}

/** Green only once money has actually landed; refunds are neutral bookkeeping. */
export function paymentTone(status: PaymentStatus) {
  if (status === "CAPTURED") return "trust" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "REFUND_PENDING") return "warning" as const;
  if (status === "PARTIALLY_REFUNDED") return "info" as const;
  return "neutral" as const;
}

export function PaymentStatusChip({ status }: { status: PaymentStatus }) {
  return <Chip tone={paymentTone(status)}>{humanize(status)}</Chip>;
}
