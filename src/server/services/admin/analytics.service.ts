import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import { requireStaff } from "./guard";
import {
  type DashboardRange,
  averagePaise,
  dayKeys,
  fillDaily,
  rangeStart,
  ratio,
} from "./analytics-math";

/**
 * Admin dashboard numbers, from grouped Prisma queries — no BI tool.
 *
 * Definitions (also shown as hints on the tiles):
 * - GMV: sum of `totalPaise` for orders now DELIVERED whose `deliveredAt` falls
 *   in the range. Delivered-then-returned orders drop out, which is intended.
 * - Orders placed: orders with `placedAt` in range, excluding PENDING_PAYMENT
 *   (a checkout that never got paid is not an order yet).
 * - Cancellation rate: of those placed orders, the share now CANCELLED.
 * - Checkout conversion: distinct checkout groups placed in range ÷ (those
 *   groups + carts that still hold items updated in range). Checkout empties the
 *   cart, so converted carts are counted through their checkout group.
 */

const PLACED_EXCLUDES = ["PENDING_PAYMENT"] as const;
const COMPLETED_BOOKING = ["COMPLETED", "APPROVED", "PAID_OUT"] as const;

export async function getDashboard(actor: Actor | null, days: DashboardRange, now = new Date()) {
  const staff = await requireStaff(actor, "SUPPORT");
  const start = rangeStart(days, now);
  const inRange = { gte: start, lte: now };

  const [
    delivered,
    placedByStatus,
    placedGroups,
    activeCarts,
    bookingsCreated,
    bookingsCompleted,
    newCustomers,
    openTickets,
    unassignedTickets,
    openDisputes,
    dailyOrders,
    dailyGmv,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "DELIVERED", deliveredAt: inRange },
      _sum: { totalPaise: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { placedAt: inRange, status: { notIn: [...PLACED_EXCLUDES] } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["checkoutGroupId"],
      where: { placedAt: inRange, status: { notIn: [...PLACED_EXCLUDES] } },
    }),
    prisma.cartItem.groupBy({ by: ["cartId"], where: { updatedAt: inRange } }),
    prisma.labourBooking.count({ where: { createdAt: inRange } }),
    prisma.labourBooking.count({
      where: { completedAt: inRange, status: { in: [...COMPLETED_BOOKING] } },
    }),
    // Sellers, workers and staff also carry CUSTOMER, so exclude them.
    prisma.user.count({
      where: {
        createdAt: inRange,
        roles: { has: "CUSTOMER" },
        NOT: { roles: { hasSome: ["VENDOR", "WORKER", "DELIVERY_PARTNER", "ADMIN", "SUPPORT"] } },
      },
    }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, assignedToId: null } }),
    prisma.labourBooking.count({ where: { status: "DISPUTED" } }),
    prisma.$queryRaw<Array<{ day: string; n: number }>>`
      SELECT to_char(("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
             count(*)::int AS n
      FROM "Order"
      WHERE "placedAt" >= ${start} AND "placedAt" <= ${now} AND status::text <> 'PENDING_PAYMENT'
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ day: string; paise: number }>>`
      SELECT to_char(("deliveredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
             coalesce(sum("totalPaise"), 0)::int AS paise
      FROM "Order"
      WHERE "deliveredAt" >= ${start} AND "deliveredAt" <= ${now} AND status::text = 'DELIVERED'
      GROUP BY 1`,
  ]);

  const placed = placedByStatus.reduce((sum, row) => sum + row._count._all, 0);
  const cancelled = placedByStatus.find((row) => row.status === "CANCELLED")?._count._all ?? 0;
  const gmvPaise = delivered._sum.totalPaise ?? 0;
  const deliveredCount = delivered._count._all;
  const groups = placedGroups.length;

  return {
    level: staff.level,
    days,
    start,
    end: now,
    kpis: {
      gmvPaise,
      deliveredCount,
      ordersPlaced: placed,
      aovPaise: averagePaise(gmvPaise, deliveredCount),
      cancelled,
      cancellationRate: ratio(cancelled, placed),
      bookingsCreated,
      bookingsCompleted,
      newCustomers,
      openTickets,
      unassignedTickets,
      openDisputes,
      checkoutGroups: groups,
      activeCarts: activeCarts.length,
      checkoutConversion: ratio(groups, groups + activeCarts.length),
    },
    daily: fillDaily(dayKeys(start, days), dailyOrders, dailyGmv),
    queues: await getActionQueues(),
  };
}

/** Current work waiting on staff — independent of the date range. */
async function getActionQueues() {
  const [pendingVendors, pendingWorkers, disputes, openTickets, lowStock, pendingRefunds, refundRows] =
    await Promise.all([
      prisma.vendor.count({ where: { status: "PENDING" } }),
      prisma.worker.count({ where: { idVerificationStatus: "PENDING" } }),
      prisma.labourBooking.count({ where: { status: "DISPUTED" } }),
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
      prisma.inventory.count({
        where: {
          quantityAvailable: { lte: prisma.inventory.fields.lowStockThreshold },
          variant: { isActive: true },
        },
      }),
      prisma.refund.count({ where: { status: "REFUND_PENDING" } }),
      prisma.refund.findMany({
        where: { status: "REFUND_PENDING" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          amountPaise: true,
          failureMessage: true,
          createdAt: true,
          orderId: true,
          bookingId: true,
          order: { select: { orderNumber: true } },
          booking: { select: { bookingNumber: true } },
        },
      }),
    ]);

  return { pendingVendors, pendingWorkers, disputes, openTickets, lowStock, pendingRefunds, refundRows };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
