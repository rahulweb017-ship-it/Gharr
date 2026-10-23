import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { allowedTransitions } from "@/server/services/order-state";
import { requireVendor } from "./vendor-scope";

/**
 * One order as its seller sees it: what to pack, where it goes, who to call.
 * Unlike the customer view it carries the buyer's contact, and it is scoped to
 * the caller's vendor so an id from another shop reads as not found.
 */
export async function getVendorOrder(actor: Actor | null, orderId: string) {
  const me = await requireVendor(actor);
  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId: me.vendorId },
    select: {
      id: true,
      orderNumber: true,
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
      user: { select: { name: true, phoneE164: true } },
      payment: { select: { status: true } },
      items: {
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          unit: true,
          quantity: true,
          unitPricePaise: true,
          lineTotalPaise: true,
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, toStatus: true, reason: true, createdAt: true },
      },
    },
  });
  if (!order) throw new NotFoundError("Order");

  return {
    ...order,
    items: order.items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
    availableActions: allowedTransitions(order.status, "VENDOR"),
  };
}
