/**
 * Pure refund arithmetic, kept apart from the service so it can be unit-tested
 * without a database.
 */

export type RefundedPaymentStatus = "CAPTURED" | "PARTIALLY_REFUNDED" | "REFUNDED";

/** The payment's status once `refundedPaise` of `capturedPaise` has gone back. */
export function refundOutcome(capturedPaise: number, refundedPaise: number): RefundedPaymentStatus {
  if (refundedPaise <= 0) return "CAPTURED";
  if (refundedPaise >= capturedPaise) return "REFUNDED";
  return "PARTIALLY_REFUNDED";
}

export interface RefundableInput {
  /** What the payment captured — for a checkout group, every vendor's orders. */
  capturedPaise: number;
  /** Refunds against the payment that are done or in flight. */
  paymentRefundedPaise: number;
  /** The order's (or booking's) own total, when refunding one part of the group. */
  partTotalPaise?: number;
  /** Refunds already made or pending against that part. */
  partRefundedPaise?: number;
}

/**
 * How much can still go back. One Payment spans every order in a checkout group,
 * so a single order is capped by its own total as well as by what is left on
 * the payment — otherwise refunding one vendor's order could drain money paid
 * for another's.
 */
export function refundableRemaining(input: RefundableInput): number {
  const onPayment = input.capturedPaise - input.paymentRefundedPaise;
  const onPart =
    input.partTotalPaise == null ? onPayment : input.partTotalPaise - (input.partRefundedPaise ?? 0);
  return Math.max(0, Math.min(onPayment, onPart));
}
