import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import { requireVendor } from "./vendor-scope";

/**
 * Read-only money views for a supplier. Commission accrues on delivery
 * (order.service.ts), so "sales" here means delivered goods; payouts are
 * created by finance and only listed.
 */

export const OPEN_STATUSES: OrderStatus[] = ["CONFIRMED", "ACCEPTED", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY"];

function monthStart(offset = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

export async function getEarnings(actor: Actor | null, months = 6) {
  const me = await requireVendor(actor);
  const from = monthStart(-(months - 1));

  const [commissions, payouts, totals] = await Promise.all([
    prisma.commission.findMany({
      where: { vendorId: me.vendorId, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        baseAmountPaise: true,
        ratePercent: true,
        commissionPaise: true,
        status: true,
        createdAt: true,
        order: { select: { id: true, orderNumber: true } },
      },
    }),
    prisma.payout.findMany({
      where: { vendorId: me.vendorId },
      orderBy: { periodStart: "desc" },
      take: 24,
      select: { id: true, periodStart: true, periodEnd: true, grossPaise: true, commissionPaise: true, netPaise: true, status: true, reference: true, paidAt: true },
    }),
    prisma.commission.aggregate({
      where: { vendorId: me.vendorId },
      _sum: { baseAmountPaise: true, commissionPaise: true },
    }),
  ]);

  const byMonth = new Map<string, { month: string; grossPaise: number; commissionPaise: number; orders: number }>();
  for (let i = 0; i < months; i++) {
    const d = monthStart(-i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, { month: key, grossPaise: 0, commissionPaise: 0, orders: 0 });
  }
  for (const c of commissions) {
    const key = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    bucket.grossPaise += c.baseAmountPaise;
    bucket.commissionPaise += c.commissionPaise;
    bucket.orders += 1;
  }

  const lifetimeGross = totals._sum.baseAmountPaise ?? 0;
  const lifetimeCommission = totals._sum.commissionPaise ?? 0;
  const paidOut = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.netPaise, 0);

  return {
    months: [...byMonth.values()],
    commissions: commissions.map((c) => ({ ...c, ratePercent: Number(c.ratePercent), netPaise: c.baseAmountPaise - c.commissionPaise })),
    payouts,
    lifetime: {
      grossPaise: lifetimeGross,
      commissionPaise: lifetimeCommission,
      netPaise: lifetimeGross - lifetimeCommission,
      paidOutPaise: paidOut,
      outstandingPaise: lifetimeGross - lifetimeCommission - paidOut,
    },
  };
}

/** Numbers for the portal home screen. */
export async function getDashboard(actor: Actor | null) {
  const me = await requireVendor(actor);
  const since = monthStart();

  const [openOrders, monthSales, listings, lowStock, pendingProducts] = await Promise.all([
    prisma.order.count({ where: { vendorId: me.vendorId, status: { in: OPEN_STATUSES } } }),
    prisma.commission.aggregate({ where: { vendorId: me.vendorId, createdAt: { gte: since } }, _sum: { baseAmountPaise: true }, _count: true }),
    prisma.productVariant.count({ where: { vendorId: me.vendorId, isActive: true } }),
    // Column-to-column comparison is not expressible in Prisma's where.
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n
      FROM "ProductVariant" v JOIN "Inventory" i ON i."variantId" = v."id"
      WHERE v."vendorId" = ${me.vendorId} AND v."isActive" = true
        AND i."quantityAvailable" <= i."lowStockThreshold"
    `,
    prisma.product.count({ where: { submittedByVendorId: me.vendorId, reviewStatus: "PENDING" } }),
  ]);

  return {
    status: me.status,
    openOrders,
    monthSalesPaise: monthSales._sum.baseAmountPaise ?? 0,
    monthDelivered: monthSales._count,
    activeListings: listings,
    lowStock: Number(lowStock[0]?.n ?? 0),
    pendingProducts,
  };
}
