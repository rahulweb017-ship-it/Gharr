import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { refundCancelledOrder } from "./refund.service";
import {
  DISPATCH_POINT,
  allowedTransitions,
  canTransition,
  type TransitionRole,
} from "./order-state";

/**
 * Order reads and the one function permitted to write Order.status.
 *
 * Every status change goes through `transition`, which validates the move
 * against the state table, applies it with a conditional update (so two
 * concurrent actors cannot both advance the same order), writes an OrderEvent
 * for the customer timeline and an AuditLog for compliance — all in one
 * transaction.
 */

function actorRole(actor: Actor): TransitionRole {
  if (actor.roles.includes("ADMIN")) return "ADMIN";
  if (actor.roles.includes("VENDOR")) return "VENDOR";
  if (actor.roles.includes("DELIVERY_PARTNER")) return "DELIVERY_PARTNER";
  return "CUSTOMER";
}

/**
 * The vendor profile a VENDOR actor acts for. A vendor may only ever see and
 * move its own orders; without a profile it can see none.
 */
async function vendorIdFor(actor: Actor): Promise<string> {
  const vendor = await prisma.vendor.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!vendor) throw new ForbiddenError("No vendor profile is linked to this account");
  return vendor.id;
}

/** Row filter for order reads and writes, by the role the actor acts in. */
async function orderScope(actor: Actor, role: TransitionRole) {
  if (role === "ADMIN" || role === "SYSTEM") return {};
  if (role === "VENDOR") return { vendorId: await vendorIdFor(actor) };
  if (role === "DELIVERY_PARTNER") return {};
  return { userId: actor.userId };
}

export async function listOrders(userId: string, page = 1, perPage = 20) {
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        placedAt: true,
        deliveredAt: true,
        paymentMethod: true,
        deliverySlotDate: true,
        vendor: { select: { businessName: true } },
        items: {
          take: 3,
          select: {
            productName: true,
            imageUrl: true,
            quantity: true,
            unit: true,
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return {
    items: rows.map((order) => ({
      ...order,
      itemCount: order._count.items,
      items: order.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
    })),
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * Order detail.
 *
 * Ownership is enforced by filtering on userId rather than fetching then
 * comparing, and a miss returns 404 rather than 403 so the endpoint cannot be
 * used to confirm that an order id exists.
 */
export async function getOrder(orderId: string, actor: Actor) {
  // SUPPORT staff read orders to answer tickets but cannot act on them.
  const readRole: TransitionRole = actor.roles.includes("SUPPORT") && !actor.roles.includes("ADMIN")
    ? "ADMIN"
    : actorRole(actor);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(await orderScope(actor, readRole)),
    },
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
      paymentMethod: true,
      placedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      cancelReason: true,
      vendor: {
        select: { id: true, businessName: true, slug: true, phoneE164: true },
      },
      payment: { select: { id: true, status: true, method: true, provider: true } },
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          variantLabel: true,
          unit: true,
          imageUrl: true,
          quantity: true,
          unitPricePaise: true,
          mrpPaise: true,
          lineSubtotalPaise: true,
          lineDiscountPaise: true,
          lineTaxPaise: true,
          lineTotalPaise: true,
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) throw new NotFoundError("Order");

  return {
    ...order,
    items: order.items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
    availableActions: allowedTransitions(order.status, actorRole(actor)),
  };
}

export interface TransitionOptions {
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Set for webhook- and sweep-driven changes that have no human actor. */
  system?: boolean;
  meta?: RequestMeta;
}

/**
 * The only place in the codebase that writes Order.status.
 *
 * The conditional `updateMany` with the expected current status is what makes
 * this race-safe: if another actor advanced the order first, zero rows match and
 * the caller gets a 409 instead of silently overwriting.
 */
export async function transition(
  actor: Actor,
  orderId: string,
  toStatus: OrderStatus,
  options: TransitionOptions = {},
) {
  const role: TransitionRole = options.system ? "SYSTEM" : actorRole(actor);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(await orderScope(actor, role)),
    },
    select: {
      id: true,
      status: true,
      userId: true,
      vendorId: true,
      checkoutGroupId: true,
      paymentId: true,
      paymentMethod: true,
      totalPaise: true,
      itemsSubtotalPaise: true,
      discountPaise: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });

  if (!order) throw new NotFoundError("Order");

  if (!canTransition(order.status, toStatus, role)) {
    throw new ConflictError(
      `Cannot move an order from ${order.status} to ${toStatus}`,
      { from: order.status, to: toStatus, role },
    );
  }

  // Customers may only cancel before the goods have left the vendor.
  if (
    role === "CUSTOMER" &&
    toStatus === "CANCELLED" &&
    DISPATCH_POINT.includes(order.status)
  ) {
    throw new ConflictError(
      "This order has already been dispatched. Please request a return instead.",
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      // Matching on the status we read is the concurrency guard.
      where: { id: orderId, status: order.status },
      data: {
        status: toStatus,
        ...(toStatus === "DELIVERED" ? { deliveredAt: now } : {}),
        ...(toStatus === "CANCELLED"
          ? { cancelledAt: now, cancelReason: options.reason ?? null }
          : {}),
      },
    });

    if (updated.count !== 1) {
      throw new ConflictError(
        "This order was updated by someone else. Refresh and try again.",
      );
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus,
        actorUserId: options.system ? null : actor.userId,
        actorRole: role,
        reason: options.reason,
        metadata: options.metadata as never,
      },
    });

    await writeAudit(tx, {
      actor: options.system ? null : actor,
      actorRole: role,
      action: "order.transition",
      entityType: "Order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: toStatus, reason: options.reason },
      ...options.meta,
    });

    // Cancelling returns the reserved stock.
    if (toStatus === "CANCELLED") {
      for (const item of order.items) {
        if (!item.variantId) continue;
        await tx.inventory.updateMany({
          where: { variantId: item.variantId },
          data: { quantityAvailable: { increment: Number(item.quantity) } },
        });
      }
    }

    // COD money is collected at the door, so delivery is the capture event —
    // but one Payment spans every vendor in the checkout group, and each vendor
    // delivers separately. Capturing on the first delivery would book cash that
    // the other vendors have not collected yet, so the payment is only captured
    // once no order in the group is still outstanding.
    if (toStatus === "DELIVERED" && order.paymentMethod === "COD" && order.paymentId) {
      const outstanding = await tx.order.count({
        where: {
          checkoutGroupId: order.checkoutGroupId,
          id: { not: orderId },
          status: { notIn: ["DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"] },
        },
      });

      if (outstanding === 0) {
        // Cancelled siblings were never collected, so the captured amount is the
        // sum of what was actually delivered rather than the original total.
        // This order's own update has already been applied in this transaction,
        // so the aggregate includes it.
        const delivered = await tx.order.aggregate({
          where: {
            checkoutGroupId: order.checkoutGroupId,
            status: "DELIVERED",
          },
          _sum: { totalPaise: true },
        });

        await tx.payment.update({
          where: { id: order.paymentId },
          data: {
            status: "CAPTURED",
            capturedAt: now,
            amountPaise: delivered._sum.totalPaise ?? 0,
          },
        });
      }
    }

    // Commission accrues on delivery, not at checkout — an order that is never
    // delivered earns nothing.
    if (toStatus === "DELIVERED") {
      await tx.commission.create({
        data: {
          orderId,
          vendorId: order.vendorId,
          baseAmountPaise: order.itemsSubtotalPaise - order.discountPaise,
          ratePercent: env.MATERIAL_COMMISSION_PERCENT,
          commissionPaise: Math.round(
            ((order.itemsSubtotalPaise - order.discountPaise) *
              env.MATERIAL_COMMISSION_PERCENT) /
              100,
          ),
        },
      });
    }

    // Notifications are queued as rows; delivery is out of band.
    await tx.notification.create({
      data: {
        userId: order.userId,
        type: `order.${toStatus.toLowerCase()}`,
        title: notificationTitle(toStatus),
        body: `Order status updated to ${toStatus.replace(/_/g, " ").toLowerCase()}.`,
        data: { orderId },
      },
    });
  });

  logger.info({ orderId, from: order.status, to: toStatus, role }, "Order transitioned");

  // Prepaid money goes back when the order ends without delivery. This runs
  // after commit: the cancellation stands even if the gateway is down, and a
  // failed attempt remains visible as a pending refund in the admin console.
  if (toStatus === "CANCELLED" || toStatus === "REFUNDED") {
    await refundCancelledOrder(
      orderId,
      options.system ? null : actor,
      options.reason ?? (toStatus === "CANCELLED" ? "Order cancelled" : "Order returned"),
    );
  }

  return { id: orderId, status: toStatus };
}

function notificationTitle(status: OrderStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "Order confirmed";
    case "ACCEPTED":
      return "Seller accepted your order";
    case "PACKED":
      return "Your order is packed";
    case "DISPATCHED":
      return "Your order has been dispatched";
    case "OUT_FOR_DELIVERY":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Order cancelled";
    default:
      return "Order update";
  }
}

/** Customer-initiated cancellation, with the policy check in one place. */
export async function cancelOrder(actor: Actor, orderId: string, reason: string) {
  return transition(actor, orderId, "CANCELLED", { reason });
}

/**
 * Vendor-facing queue for the ops console. Vendor users see only their own
 * orders; admins see everything.
 */
export async function listVendorOrders(actor: Actor, status?: OrderStatus) {
  const isAdmin = actor.roles.includes("ADMIN");

  if (!isAdmin && !actor.roles.includes("VENDOR")) {
    throw new ForbiddenError();
  }

  // A VENDOR without a linked profile used to fall through to every order.
  const vendorId = isAdmin ? null : await vendorIdFor(actor);

  const rows = await prisma.order.findMany({
    where: {
      ...(vendorId ? { vendorId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { placedAt: "desc" },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalPaise: true,
      placedAt: true,
      paymentMethod: true,
      deliveryAddress: true,
      vendor: { select: { businessName: true } },
      user: { select: { name: true, phoneE164: true } },
      _count: { select: { items: true } },
    },
  });

  return rows.map((order) => ({
    ...order,
    itemCount: order._count.items,
    availableActions: allowedTransitions(order.status, actorRole(actor)),
  }));
}
