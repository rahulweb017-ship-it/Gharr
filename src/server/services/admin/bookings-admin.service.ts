import type { BookingStatus, Prisma, Trade } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import type { RequestMeta } from "@/server/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { requireStaff, pageArgs } from "./guard";
import { allowedBookingTransitions } from "../booking-state";
import { transitionBooking } from "../booking.service";
import { refundPayment } from "../refund.service";
import { refundableRemaining } from "../refund-math";

/**
 * Admin views over labour bookings, centred on disputes.
 *
 * Resolving a dispute is just the two ADMIN-only DISPUTED transitions in
 * booking-state.ts, applied through `transitionBooking` — so commission,
 * worker job counts and notifications behave exactly as for any other move.
 */

export const BOOKING_ADMIN_TABS = ["disputes", "active", "completed", "cancelled", "all"] as const;
export type BookingAdminTab = (typeof BOOKING_ADMIN_TABS)[number];

const TAB_STATUSES: Record<Exclude<BookingAdminTab, "all">, BookingStatus[]> = {
  disputes: ["DISPUTED"],
  active: ["REQUESTED", "ACCEPTED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"],
  completed: ["COMPLETED", "APPROVED", "PAID_OUT"],
  cancelled: ["REJECTED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_WORKER", "NO_SHOW"],
};

/** Moves that end a job early, or settle a dispute, must record why. */
export function bookingReasonRequired(from: BookingStatus, to: BookingStatus): boolean {
  if (from === "DISPUTED") return true;
  return ["REJECTED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_WORKER", "NO_SHOW", "DISPUTED"].includes(to);
}

export interface AdminBookingFilters {
  tab?: BookingAdminTab;
  trade?: Trade;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  perPage?: number;
}

/**
 * `scheduledDate` is a Postgres `date` stored as UTC midnight, so its range is
 * built in UTC — the IST-offset helper used for timestamps would shift a day.
 */
function scheduledRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const f = valid(from);
  const t = valid(to);
  if (!f && !t) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (f) range.gte = new Date(`${f}T00:00:00Z`);
  if (t) range.lt = new Date(new Date(`${t}T00:00:00Z`).getTime() + 86_400_000);
  return range;
}

function searchWhere(q: string): Prisma.LabourBookingWhereInput {
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  return {
    OR: [
      { bookingNumber: { contains: term, mode: "insensitive" } },
      { user: { name: { contains: term, mode: "insensitive" } } },
      { worker: { displayName: { contains: term, mode: "insensitive" } } },
      ...(digits.length >= 4
        ? [
            { user: { phoneE164: { contains: digits.slice(-10) } } },
            { worker: { user: { phoneE164: { contains: digits.slice(-10) } } } },
          ]
        : []),
    ],
  };
}

export async function listAdminBookings(actor: Actor, filters: AdminBookingFilters = {}) {
  await requireStaff(actor, "SUPPORT");
  const { skip, take, page, perPage } = pageArgs(filters.page, filters.perPage);

  const scheduledDate = scheduledRange(filters.from, filters.to);
  const base: Prisma.LabourBookingWhereInput[] = [
    filters.trade ? { trade: filters.trade } : {},
    scheduledDate ? { scheduledDate } : {},
    filters.q?.trim() ? searchWhere(filters.q) : {},
  ];

  const byStatus = await prisma.labourBooking.groupBy({
    by: ["status"],
    where: { AND: base },
    _count: { _all: true },
  });
  const countOf = (statuses: BookingStatus[]) =>
    byStatus.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + g._count._all, 0);
  const counts = {
    disputes: countOf(TAB_STATUSES.disputes),
    active: countOf(TAB_STATUSES.active),
    completed: countOf(TAB_STATUSES.completed),
    cancelled: countOf(TAB_STATUSES.cancelled),
    all: byStatus.reduce((s, g) => s + g._count._all, 0),
  };

  // Disputes are the reason this screen exists: open on them whenever any wait.
  const tab: BookingAdminTab = filters.tab ?? (counts.disputes > 0 ? "disputes" : "active");
  const where: Prisma.LabourBookingWhereInput = {
    AND: [...base, tab === "all" ? {} : { status: { in: TAB_STATUSES[tab] } }],
  };

  const [rows, total] = await Promise.all([
    prisma.labourBooking.findMany({
      where,
      orderBy: [{ scheduledDate: "desc" }, { startMinute: "desc" }],
      skip,
      take,
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        trade: true,
        scheduledDate: true,
        startMinute: true,
        estimatedTotalPaise: true,
        finalTotalPaise: true,
        createdAt: true,
        user: { select: { name: true, phoneE164: true } },
        worker: { select: { id: true, displayName: true } },
      },
    }),
    prisma.labourBooking.count({ where }),
  ]);

  return { items: rows, total, page, perPage, tab, counts };
}

const inFlight = (r: { status: string }) => r.status === "REFUNDED" || r.status === "REFUND_PENDING";
const sumPaise = (rows: Array<{ amountPaise: number }>) => rows.reduce((s, r) => s + r.amountPaise, 0);

export async function getAdminBooking(actor: Actor, bookingId: string) {
  const staff = await requireStaff(actor, "SUPPORT");

  const booking = await prisma.labourBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      trade: true,
      scheduledDate: true,
      startMinute: true,
      durationMinutes: true,
      rateType: true,
      rateAmountPaise: true,
      quantity: true,
      labourSubtotalPaise: true,
      extrasPaise: true,
      platformFeePaise: true,
      discountPaise: true,
      estimatedTotalPaise: true,
      finalTotalPaise: true,
      cancellationFeePaise: true,
      addressSnapshot: true,
      workDescription: true,
      checkedInAt: true,
      startedAt: true,
      completedAt: true,
      approvedAt: true,
      cancelledAt: true,
      cancelReason: true,
      createdAt: true,
      user: { select: { id: true, name: true, phoneE164: true } },
      worker: {
        select: {
          id: true,
          displayName: true,
          ratingAvg: true,
          completedJobs: true,
          idVerificationStatus: true,
          user: { select: { phoneE164: true } },
        },
      },
      lines: { select: { id: true, kind: true, description: true, quantity: true, unitAmountPaise: true, totalAmountPaise: true } },
      payment: {
        select: {
          id: true,
          provider: true,
          method: true,
          status: true,
          amountPaise: true,
          refunds: {
            orderBy: { createdAt: "desc" },
            select: { id: true, bookingId: true, amountPaise: true, reason: true, status: true, processedAt: true, failureMessage: true, createdAt: true },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStatus: true, toStatus: true, actorUserId: true, actorRole: true, reason: true, createdAt: true },
      },
    },
  });
  if (!booking) throw new NotFoundError("Booking");

  const actorIds = [...new Set(booking.events.map((e) => e.actorUserId).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  // The most recent dispute carries the customer's complaint.
  const disputeEvent = [...booking.events].reverse().find((e) => e.toStatus === "DISPUTED") ?? null;
  const resolutionEvent = [...booking.events].reverse().find((e) => e.fromStatus === "DISPUTED") ?? null;

  const payment = booking.payment;
  const bookingRefunds = payment?.refunds.filter((r) => r.bookingId === booking.id) ?? [];
  const refundablePaise =
    payment && ["CAPTURED", "PARTIALLY_REFUNDED"].includes(payment.status)
      ? refundableRemaining({
          capturedPaise: payment.amountPaise,
          paymentRefundedPaise: sumPaise(payment.refunds.filter(inFlight)),
          partTotalPaise: booking.finalTotalPaise ?? booking.estimatedTotalPaise,
          partRefundedPaise: sumPaise(bookingRefunds.filter(inFlight)),
        })
      : 0;

  const canWrite = staff.level === "ADMIN";

  return {
    ...booking,
    quantity: Number(booking.quantity),
    lines: booking.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
    worker: { ...booking.worker, ratingAvg: Number(booking.worker.ratingAvg) },
    events: booking.events.map((e) => ({ ...e, actorName: e.actorUserId ? actorName.get(e.actorUserId) ?? null : null })),
    disputeReason: disputeEvent?.reason ?? null,
    disputedAt: disputeEvent?.createdAt ?? null,
    resolution: resolutionEvent
      ? {
          favour: resolutionEvent.toStatus === "APPROVED" ? ("worker" as const) : ("customer" as const),
          note: resolutionEvent.reason,
          at: resolutionEvent.createdAt,
        }
      : null,
    refunds: bookingRefunds,
    refundablePaise,
    canWrite,
    availableActions: canWrite
      ? allowedBookingTransitions(booking.status, "ADMIN").map((t) => ({
          ...t,
          reasonRequired: bookingReasonRequired(booking.status, t.to),
        }))
      : [],
  };
}

export async function adminTransitionBooking(
  actor: Actor,
  bookingId: string,
  toStatus: BookingStatus,
  reason: string | undefined,
  meta?: RequestMeta,
) {
  const staff = await requireStaff(actor, "ADMIN");
  const current = await prisma.labourBooking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!current) throw new NotFoundError("Booking");

  const note = reason?.trim() || undefined;
  if (bookingReasonRequired(current.status, toStatus) && (!note || note.length < 3)) {
    throw new ValidationError(
      current.status === "DISPUTED" ? "A resolution note is required" : "A reason is required for this change",
      [{ field: "reason", message: "Say why" }],
    );
  }

  return transitionBooking(staff, bookingId, toStatus, { reason: note, meta });
}

export async function adminRefundBooking(
  actor: Actor,
  bookingId: string,
  input: { amountPaise: number; reason: string },
  meta?: RequestMeta,
) {
  const staff = await requireStaff(actor, "ADMIN");

  const booking = await prisma.labourBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      estimatedTotalPaise: true,
      finalTotalPaise: true,
      payment: {
        select: {
          id: true,
          status: true,
          amountPaise: true,
          refunds: { select: { bookingId: true, amountPaise: true, status: true } },
        },
      },
    },
  });
  if (!booking) throw new NotFoundError("Booking");
  // Labour is currently paid off-platform, so most bookings have no payment row.
  if (!booking.payment || !["CAPTURED", "PARTIALLY_REFUNDED"].includes(booking.payment.status)) {
    throw new ConflictError("This booking has no captured payment to refund");
  }

  const refunds = booking.payment.refunds.filter(inFlight);
  const cap = refundableRemaining({
    capturedPaise: booking.payment.amountPaise,
    paymentRefundedPaise: sumPaise(refunds),
    partTotalPaise: booking.finalTotalPaise ?? booking.estimatedTotalPaise,
    partRefundedPaise: sumPaise(refunds.filter((r) => r.bookingId === booking.id)),
  });
  if (input.amountPaise > cap) {
    throw new ConflictError(
      cap === 0
        ? "Nothing is left to refund on this booking"
        : `At most ₹${(cap / 100).toLocaleString("en-IN")} can still be refunded on this booking`,
      { refundablePaise: cap },
    );
  }

  return refundPayment({
    paymentId: booking.payment.id,
    bookingId: booking.id,
    amountPaise: input.amountPaise,
    reason: input.reason.trim(),
    actor: staff,
    meta,
  });
}
