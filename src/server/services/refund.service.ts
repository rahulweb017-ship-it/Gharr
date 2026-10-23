import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { ConflictError, NotFoundError, ValidationError, isAppError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { getProviderByKey } from "./payment";
import { refundOutcome } from "./refund-math";

/**
 * Refunds.
 *
 * A Refund row is written BEFORE the provider is called, so a crash between the
 * two leaves a visible REFUND_PENDING row an admin can retry — never money sent
 * with no record, and never a record claiming money that was not sent. The
 * provider call carries an idempotency key so a retry cannot double-refund.
 */

export interface RefundRequest {
  paymentId: string;
  orderId?: string;
  bookingId?: string;
  amountPaise: number;
  reason: string;
  actor: Actor | null;
  meta?: RequestMeta;
  /** Distinguishes deliberate repeat refunds (partial top-ups) from retries. */
  idempotencyKey?: string;
}

export async function refundPayment(req: RefundRequest) {
  if (!Number.isInteger(req.amountPaise) || req.amountPaise <= 0) {
    throw new ValidationError("Refund amount must be a positive whole number of paise");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: req.paymentId },
    select: {
      id: true,
      provider: true,
      status: true,
      amountPaise: true,
      providerPaymentId: true,
      refunds: { select: { amountPaise: true, status: true } },
    },
  });
  if (!payment) throw new NotFoundError("Payment");

  const refundedSoFar = payment.refunds
    .filter((r) => r.status === "REFUNDED")
    .reduce((sum, r) => sum + r.amountPaise, 0);
  const pendingSoFar = payment.refunds
    .filter((r) => r.status === "REFUND_PENDING")
    .reduce((sum, r) => sum + r.amountPaise, 0);

  const refundable = ["CAPTURED", "PARTIALLY_REFUNDED"].includes(payment.status);
  if (!refundable) {
    throw new ConflictError(
      payment.status === "REFUNDED"
        ? "This payment has already been fully refunded"
        : "Only a captured payment can be refunded",
    );
  }

  const available = payment.amountPaise - refundedSoFar - pendingSoFar;
  if (req.amountPaise > available) {
    throw new ConflictError(`At most ₹${(available / 100).toLocaleString("en-IN")} can still be refunded`);
  }

  const provider = getProviderByKey(payment.provider);
  if (!provider.supportsRefund) {
    throw new ConflictError("This payment method cannot be refunded online. Settle it offline and record it.");
  }

  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      orderId: req.orderId ?? null,
      bookingId: req.bookingId ?? null,
      amountPaise: req.amountPaise,
      reason: req.reason,
      status: "REFUND_PENDING",
    },
    select: { id: true },
  });

  try {
    const result = await provider.refund({
      providerPaymentId: payment.providerPaymentId ?? payment.id,
      amountPaise: req.amountPaise,
      reason: req.reason,
      idempotencyKey: req.idempotencyKey ?? `refund:${refund.id}`,
    });

    const succeeded = result.status === "REFUNDED";
    const outcome = refundOutcome(payment.amountPaise, refundedSoFar + (succeeded ? req.amountPaise : 0));

    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: succeeded
          ? { status: "REFUNDED", providerRefundId: result.providerRefundId, processedAt: new Date(), failureMessage: null }
          : { failureMessage: `Provider returned ${result.status}` },
      });
      if (succeeded) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: outcome } });
      }
      await writeAudit(tx, {
        actor: req.actor,
        action: succeeded ? "refund.succeeded" : "refund.failed",
        entityType: "Refund",
        entityId: refund.id,
        before: { paymentStatus: payment.status, refundedPaise: refundedSoFar },
        after: { paymentStatus: succeeded ? outcome : payment.status, amountPaise: req.amountPaise },
        ...req.meta,
      });
    });

    return { id: refund.id, status: succeeded ? "REFUNDED" : "REFUND_PENDING", paymentStatus: succeeded ? outcome : payment.status };
  } catch (error) {
    const message = isAppError(error) || error instanceof Error ? error.message : "Unknown provider error";
    await prisma.refund.update({ where: { id: refund.id }, data: { failureMessage: message } });
    logger.error({ refundId: refund.id, paymentId: payment.id, error: message }, "refund failed");
    throw new ConflictError(`Refund could not be completed: ${message}. It is saved as pending and can be retried.`);
  }
}

/** Retries a REFUND_PENDING row with its original idempotency key. */
export async function retryRefund(refundId: string, actor: Actor, meta?: RequestMeta) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: { id: true, status: true, paymentId: true, orderId: true, bookingId: true, amountPaise: true, reason: true },
  });
  if (!refund) throw new NotFoundError("Refund");
  if (refund.status !== "REFUND_PENDING") throw new ConflictError("Only a pending refund can be retried");

  // Replace the stuck row with a fresh attempt that reuses its idempotency key,
  // so the provider treats it as the same refund.
  await prisma.refund.delete({ where: { id: refund.id } });
  return refundPayment({
    paymentId: refund.paymentId,
    orderId: refund.orderId ?? undefined,
    bookingId: refund.bookingId ?? undefined,
    amountPaise: refund.amountPaise,
    reason: refund.reason,
    actor,
    meta,
    idempotencyKey: `refund:${refund.id}`,
  });
}

/**
 * Refunds a prepaid order's share of its group payment after cancellation.
 * Called outside the transition transaction: the cancellation must stand even if
 * the gateway is down, and the pending refund row makes the gap visible.
 */
export async function refundCancelledOrder(orderId: string, actor: Actor | null, reason: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, totalPaise: true, payment: { select: { id: true, status: true } }, refunds: { select: { id: true } } },
  });
  if (!order?.payment) return null;
  if (!["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.payment.status)) return null;
  if (order.refunds.length > 0) return null; // already refunded or pending

  try {
    return await refundPayment({
      paymentId: order.payment.id,
      orderId: order.id,
      amountPaise: order.totalPaise,
      reason,
      actor,
      idempotencyKey: `refund:order:${order.id}`,
    });
  } catch (error) {
    // Surfaced in the admin queue as a pending refund; never fails the cancel.
    logger.error({ orderId, error: error instanceof Error ? error.message : error }, "automatic refund failed");
    return null;
  }
}
