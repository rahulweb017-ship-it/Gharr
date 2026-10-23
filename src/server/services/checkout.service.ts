import { randomUUID } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/server/http/errors";
import { percentOfPaise } from "@/shared/money";
import { getCart } from "./cart.service";
import { getPaymentProvider } from "./payment";

/**
 * Checkout: cart → orders → payment.
 *
 * One checkout produces N orders (one per vendor) sharing a `checkoutGroupId`,
 * plus exactly one Payment keyed on that group. Vendors ship independently, so
 * fulfilment and status are per-vendor; the customer pays once, so money is
 * per-group. Everything downstream — refunds, cancellation, commission —
 * follows from that split.
 */

export interface CheckoutInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  deliverySlotDate?: string;
  deliverySlotStartMinute?: number;
  deliverySlotEndMinute?: number;
  customerNote?: string;
  /** Supplied by the client so a double-tap cannot create two payments. */
  idempotencyKey?: string;
}

export interface CheckoutResult {
  checkoutGroupId: string;
  paymentId: string;
  orders: Array<{ id: string; orderNumber: string; vendorName: string; totalPaise: number }>;
  totalPaise: number;
  paymentMethod: PaymentMethod;
  /** Provider-specific; carries a redirect URL for gateway payments. */
  clientPayload: Record<string, unknown>;
}

/** HA-YYMM-NNNNNN, generated from a Postgres sequence so it never collides. */
async function nextOrderNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('homeall_order_seq') AS value
  `;
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `HA-${stamp}-${String(rows[0].value).padStart(6, "0")}`;
}

export async function checkout(
  userId: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const cart = await getCart(userId);

  if (cart.items.length === 0) {
    throw new ValidationError("Your cart is empty");
  }

  const unavailable = cart.items.filter((item) => !item.isAvailable);
  if (unavailable.length > 0) {
    throw new ConflictError(
      `${unavailable[0].product.name} is no longer available. Remove it to continue.`,
      { itemIds: unavailable.map((i) => i.id) },
    );
  }

  // Vendor minimum order values are enforced per group, because each group is a
  // separate commercial transaction with that vendor.
  const belowMinimum = cart.pricing.groups.find((g) => g.belowMinimum);
  if (belowMinimum) {
    const vendor = cart.vendors.find((v) => v.id === belowMinimum.vendorId);
    throw new ConflictError(
      `Minimum order for ${vendor?.businessName ?? "this seller"} is ₹${Math.ceil(
        (belowMinimum.belowMinimum?.minOrderPaise ?? 0) / 100,
      )}`,
    );
  }

  const address = await prisma.address.findFirst({
    where: { id: input.addressId, userId, deletedAt: null },
  });
  if (!address) throw new NotFoundError("Address");

  // Idempotency: replay of the same key returns the existing payment rather than
  // charging again.
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      checkoutGroupId: true,
      amountPaise: true,
      method: true,
      providerPayload: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          totalPaise: true,
          vendor: { select: { businessName: true } },
        },
      },
    },
  });

  if (existing) {
    return {
      checkoutGroupId: existing.checkoutGroupId,
      paymentId: existing.id,
      orders: existing.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        vendorName: o.vendor.businessName,
        totalPaise: o.totalPaise,
      })),
      totalPaise: existing.amountPaise,
      paymentMethod: existing.method,
      clientPayload: {},
    };
  }

  const checkoutGroupId = randomUUID();
  const provider = getPaymentProvider(input.paymentMethod);
  const totalPaise = cart.pricing.totalPaise;

  const addressSnapshot = {
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    type: address.type,
    gstin: address.gstin,
  };

  // COD confirms immediately because there is nothing to authorise. Prepaid
  // orders wait in PENDING_PAYMENT until the gateway webhook arrives — the
  // client's word that it paid is never trusted.
  const initialStatus =
    input.paymentMethod === "COD" ? "CONFIRMED" : "PENDING_PAYMENT";

  const commissionPercent = env.MATERIAL_COMMISSION_PERCENT;

  const orderNumbers = await Promise.all(
    cart.pricing.groups.map(() => nextOrderNumber()),
  );

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        checkoutGroupId,
        userId,
        provider: provider.key,
        method: input.paymentMethod,
        amountPaise: totalPaise,
        status: input.paymentMethod === "COD" ? "PENDING" : "CREATED",
        idempotencyKey,
      },
    });

    const created = [];

    for (const [index, group] of cart.pricing.groups.entries()) {
      const vendor = cart.vendors.find((v) => v.id === group.vendorId);

      const order = await tx.order.create({
        data: {
          orderNumber: orderNumbers[index],
          checkoutGroupId,
          userId,
          vendorId: group.vendorId,
          status: initialStatus,
          deliveryAddress: addressSnapshot,
          deliveryMode: cart.items.find((i) => i.vendor.id === group.vendorId)
            ?.deliveryMode ?? "STANDARD",
          ...(input.deliverySlotDate
            ? {
                deliverySlotDate: new Date(input.deliverySlotDate),
                deliverySlotStartMinute: input.deliverySlotStartMinute,
                deliverySlotEndMinute: input.deliverySlotEndMinute,
              }
            : {}),
          customerNote: input.customerNote,
          itemsSubtotalPaise: group.itemsSubtotalPaise,
          deliveryFeePaise: group.deliveryFeePaise,
          discountPaise: group.discountPaise,
          taxPaise: group.taxPaise,
          totalPaise: group.totalPaise,
          commissionPaise: percentOfPaise(
            group.itemsSubtotalPaise - group.discountPaise,
            commissionPercent,
          ),
          paymentId: payment.id,
          paymentMethod: input.paymentMethod,
          items: {
            create: group.lines.map((line) => {
              const cartItem = cart.items.find((i) => i.variantId === line.variantId)!;
              return {
                variantId: line.variantId,
                productId: cartItem.product.id,
                productName: cartItem.product.name,
                variantLabel: cartItem.variantLabel,
                vendorName: vendor?.businessName ?? "",
                unit: cartItem.unit,
                imageUrl: cartItem.product.images[0] ?? null,
                quantity: line.quantity,
                unitPricePaise: line.unitPricePaise,
                mrpPaise: line.mrpPaise,
                lineSubtotalPaise: line.lineSubtotalPaise,
                lineDiscountPaise: line.lineDiscountPaise,
                lineTaxPaise: line.lineTaxPaise,
                lineTotalPaise: line.lineTotalPaise,
              };
            }),
          },
          events: {
            create: {
              toStatus: initialStatus,
              actorUserId: userId,
              actorRole: "CUSTOMER",
              reason: "Order placed",
            },
          },
        },
        select: { id: true, orderNumber: true, totalPaise: true },
      });

      // Stock is decremented at order time. A reservation model would be better
      // under heavy contention, but this is correct and simple at pilot volume.
      for (const line of group.lines) {
        await tx.inventory.updateMany({
          where: { variantId: line.variantId },
          data: { quantityAvailable: { decrement: line.quantity } },
        });
      }

      created.push({
        id: order.id,
        orderNumber: order.orderNumber,
        vendorName: vendor?.businessName ?? "",
        totalPaise: order.totalPaise,
      });
    }

    // Coupon redemption is recorded inside the same transaction, so a coupon can
    // never be consumed by an order that failed to create.
    if (cart.pricing.couponCode && cart.pricing.discountPaise > 0) {
      const coupon = await tx.coupon.findUnique({
        where: { code: cart.pricing.couponCode },
        select: { id: true },
      });

      if (coupon) {
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            userId,
            orderId: created[0]?.id,
            discountPaise: cart.pricing.discountPaise,
          },
        });
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    // The cart is emptied only once the orders exist.
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    await tx.cart.update({
      where: { userId },
      data: { couponCode: null },
    });

    return { payment, orders: created };
  });

  const intent = await provider.createIntent({
    paymentId: result.payment.id,
    checkoutGroupId,
    amountPaise: totalPaise,
    method: input.paymentMethod,
    customer: { id: userId, phone: address.contactPhone, name: address.contactName },
    returnUrl: `${env.APP_BASE_URL}/orders`,
  });

  await prisma.payment.update({
    where: { id: result.payment.id },
    data: {
      providerOrderId: intent.providerOrderId,
      status: intent.status,
    },
  });

  logger.info(
    {
      userId,
      checkoutGroupId,
      orderCount: result.orders.length,
      totalPaise,
      method: input.paymentMethod,
    },
    "Checkout completed",
  );

  return {
    checkoutGroupId,
    paymentId: result.payment.id,
    orders: result.orders,
    totalPaise,
    paymentMethod: input.paymentMethod,
    clientPayload: intent.clientPayload,
  };
}

/**
 * Delivery slots for the next seven days.
 *
 * Heavy materials need a scheduled window — a tipper of sand cannot simply be
 * left at a gate. Slots are IST wall-clock, expressed as minute-of-day.
 */
export function availableDeliverySlots(leadTimeDays = 1) {
  const slots: Array<{
    date: string;
    label: string;
    windows: Array<{ startMinute: number; endMinute: number; label: string }>;
  }> = [];

  const windows = [
    { startMinute: 8 * 60, endMinute: 12 * 60, label: "8 AM – 12 PM" },
    { startMinute: 12 * 60, endMinute: 16 * 60, label: "12 PM – 4 PM" },
    { startMinute: 16 * 60, endMinute: 20 * 60, label: "4 PM – 8 PM" },
  ];

  for (let offset = leadTimeDays; offset < leadTimeDays + 7; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    slots.push({
      date: date.toISOString().slice(0, 10),
      label:
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
      windows,
    });
  }

  return slots;
}
