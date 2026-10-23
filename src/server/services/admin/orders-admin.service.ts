import type { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import type { RequestMeta } from "@/server/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { requireStaff, pageArgs } from "./guard";
import { allowedTransitions } from "../order-state";
import { transition } from "../order.service";
import { refundPayment, retryRefund } from "../refund.service";
import { refundableRemaining } from "../refund-math";
import { getProviderByKey } from "../payment";

/**
 * Admin views over orders and the refunds hanging off them.
 *
 * Status changes and money movement are delegated to `transition` and
 * `refundPayment` — the console gets no private write path, so the state table,
 * stock restoration, auto-refund and audit rules are the same ones customers
 * and vendors are held to.
 */

/** Moves that end or reverse an order must say why; the reason reaches the customer. */
export const ORDER_REASON_REQUIRED: OrderStatus[] = ["CANCELLED", "DELIVERY_FAILED", "REFUNDED"];

/** An unpaid order this old has probably been abandoned at the gateway. */
const STALE_PAYMENT_MS = 60 * 60 * 1000;

function attentionWhere(now = new Date()): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: "PENDING_PAYMENT", placedAt: { lt: new Date(now.getTime() - STALE_PAYMENT_MS) } },
      { status: { in: ["DELIVERY_FAILED", "RETURN_REQUESTED"] } },
      { refunds: { some: { status: "REFUND_PENDING" } } },
    ],
  };
}

export interface AdminOrderFilters {
  view?: "attention";
  status?: OrderStatus;
  vendorId?: string;
  method?: PaymentMethod;
  /** Placed-at range; routes and pages build it with `dateRange()` (IST days). */
  placedAt?: { gte?: Date; lt?: Date };
  q?: string;
  page?: number;
  perPage?: number;
}

function searchWhere(q: string): Prisma.OrderWhereInput {
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  return {
    OR: [
      { orderNumber: { contains: term, mode: "insensitive" } },
      { user: { name: { contains: term, mode: "insensitive" } } },
      // Phones are stored E.164; matching the last digits covers "98765…" and "+91…".
      ...(digits.length >= 4 ? [{ user: { phoneE164: { contains: digits.slice(-10) } } }] : []),
    ],
  };
}

export async function listAdminOrders(actor: Actor, filters: AdminOrderFilters = {}) {
  await requireStaff(actor, "SUPPORT");
  const { skip, take, page, perPage } = pageArgs(filters.page, filters.perPage);

  const placedAt = filters.placedAt;
  const where: Prisma.OrderWhereInput = {
    AND: [
      filters.view === "attention" ? attentionWhere() : {},
      filters.status ? { status: filters.status } : {},
      filters.vendorId ? { vendorId: filters.vendorId } : {},
      filters.method ? { paymentMethod: filters.method } : {},
      placedAt ? { placedAt } : {},
      filters.q?.trim() ? searchWhere(filters.q) : {},
    ],
  };

  const [rows, total, attention] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        paymentMethod: true,
        placedAt: true,
        user: { select: { id: true, name: true, phoneE164: true } },
        vendor: { select: { id: true, businessName: true } },
        payment: { select: { status: true } },
        refunds: { where: { status: "REFUND_PENDING" }, select: { id: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.count({ where: attentionWhere() }),
  ]);

  return {
    items: rows.map(({ _count, refunds, ...order }) => ({
      ...order,
      itemCount: _count.items,
      hasPendingRefund: refunds.length > 0,
    })),
    total,
    page,
    perPage,
    attentionCount: attention,
  };
}

/** Vendors that have at least one order, for the list filter. */
export async function listOrderVendors(actor: Actor) {
  await requireStaff(actor, "SUPPORT");
  return prisma.vendor.findMany({
    where: { orders: { some: {} } },
    orderBy: { businessName: "asc" },
    select: { id: true, businessName: true },
  });
}

function providerRefunds(provider: string): boolean {
  try {
    return getProviderByKey(provider).supportsRefund;
  } catch {
    return false;
  }
}

const inFlight = (r: { status: string }) => r.status === "REFUNDED" || r.status === "REFUND_PENDING";
const sumPaise = (rows: Array<{ amountPaise: number }>) => rows.reduce((s, r) => s + r.amountPaise, 0);

export async function getAdminOrder(actor: Actor, orderId: string) {
  const staff = await requireStaff(actor, "SUPPORT");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      checkoutGroupId: true,
      status: true,
      deliveryAddress: true,
      deliveryMode: true,
      deliverySlotDate: true,
      deliverySlotStartMinute: true,
      deliverySlotEndMinute: true,
      customerNote: true,
      itemsSubtotalPaise: true,
      deliveryFeePaise: true,
      discountPaise: true,
      taxPaise: true,
      totalPaise: true,
      commissionPaise: true,
      paymentMethod: true,
      placedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      cancelReason: true,
      user: { select: { id: true, name: true, phoneE164: true, email: true } },
      vendor: { select: { id: true, businessName: true, phoneE164: true, city: true } },
      payment: {
        select: {
          id: true,
          provider: true,
          method: true,
          status: true,
          amountPaise: true,
          providerPaymentId: true,
          capturedAt: true,
          failureMessage: true,
          _count: { select: { orders: true } },
          refunds: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              orderId: true,
              bookingId: true,
              amountPaise: true,
              reason: true,
              status: true,
              providerRefundId: true,
              processedAt: true,
              failureMessage: true,
              createdAt: true,
            },
          },
        },
      },
      items: {
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          unit: true,
          quantity: true,
          unitPricePaise: true,
          mrpPaise: true,
          lineDiscountPaise: true,
          lineTaxPaise: true,
          lineTotalPaise: true,
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStatus: true, toStatus: true, actorUserId: true, actorRole: true, reason: true, createdAt: true },
      },
    },
  });
  if (!order) throw new NotFoundError("Order");

  const actorIds = [...new Set(order.events.map((e) => e.actorUserId).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  const payment = order.payment;
  const orderRefunds = payment?.refunds.filter((r) => r.orderId === order.id) ?? [];
  const refundablePaise =
    payment && ["CAPTURED", "PARTIALLY_REFUNDED"].includes(payment.status)
      ? refundableRemaining({
          capturedPaise: payment.amountPaise,
          paymentRefundedPaise: sumPaise(payment.refunds.filter(inFlight)),
          partTotalPaise: order.totalPaise,
          partRefundedPaise: sumPaise(orderRefunds.filter(inFlight)),
        })
      : 0;

  const canWrite = staff.level === "ADMIN";

  return {
    ...order,
    items: order.items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
    events: order.events.map((e) => ({ ...e, actorName: e.actorUserId ? actorName.get(e.actorUserId) ?? null : null })),
    payment: payment
      ? {
          ...payment,
          sharedWithOrders: payment._count.orders,
          refundSupported: providerRefunds(payment.provider),
        }
      : null,
    refunds: orderRefunds,
    refundablePaise,
    canWrite,
    availableActions: canWrite
      ? allowedTransitions(order.status, "ADMIN").map((t) => ({
          ...t,
          reasonRequired: ORDER_REASON_REQUIRED.includes(t.to),
        }))
      : [],
  };
}

export async function adminTransitionOrder(
  actor: Actor,
  orderId: string,
  toStatus: OrderStatus,
  reason: string | undefined,
  meta?: RequestMeta,
) {
  const staff = await requireStaff(actor, "ADMIN");
  const note = reason?.trim() || undefined;
  if (ORDER_REASON_REQUIRED.includes(toStatus) && (!note || note.length < 3)) {
    throw new ValidationError("A reason is required for this change", [{ field: "reason", message: "Say why" }]);
  }

  const result = await transition(staff, orderId, toStatus, {
    reason: note,
    metadata: { via: "admin_console" },
    meta,
  });

  // Reported back so the console can show whether the automatic refund went through.
  const refunds = await prisma.refund.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true, amountPaise: true, status: true, failureMessage: true },
  });
  return { ...result, refunds };
}

export async function adminRefundOrder(
  actor: Actor,
  orderId: string,
  input: { amountPaise: number; reason: string },
  meta?: RequestMeta,
) {
  const staff = await requireStaff(actor, "ADMIN");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalPaise: true,
      payment: {
        select: {
          id: true,
          status: true,
          amountPaise: true,
          refunds: { select: { orderId: true, amountPaise: true, status: true } },
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Order");
  if (!order.payment || !["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.payment.status)) {
    throw new ConflictError("This order has no captured payment to refund");
  }

  const refunds = order.payment.refunds.filter(inFlight);
  const cap = refundableRemaining({
    capturedPaise: order.payment.amountPaise,
    paymentRefundedPaise: sumPaise(refunds),
    partTotalPaise: order.totalPaise,
    partRefundedPaise: sumPaise(refunds.filter((r) => r.orderId === order.id)),
  });
  if (input.amountPaise > cap) {
    throw new ConflictError(
      cap === 0
        ? "Nothing is left to refund on this order"
        : `At most ₹${(cap / 100).toLocaleString("en-IN")} can still be refunded on this order`,
      { refundablePaise: cap },
    );
  }

  return refundPayment({
    paymentId: order.payment.id,
    orderId: order.id,
    amountPaise: input.amountPaise,
    reason: input.reason.trim(),
    actor: staff,
    meta,
  });
}

export async function adminRetryRefund(actor: Actor, refundId: string, meta?: RequestMeta) {
  const staff = await requireStaff(actor, "ADMIN");
  return retryRefund(refundId, staff, meta);
}

/** Refunds and their payment, for the API detail view and verification. */
export async function getAdminRefund(actor: Actor, refundId: string) {
  await requireStaff(actor, "SUPPORT");
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      orderId: true,
      bookingId: true,
      amountPaise: true,
      reason: true,
      status: true,
      providerRefundId: true,
      processedAt: true,
      failureMessage: true,
      createdAt: true,
      payment: { select: { id: true, provider: true, method: true, status: true, amountPaise: true } },
    },
  });
  if (!refund) throw new NotFoundError("Refund");
  return refund;
}
