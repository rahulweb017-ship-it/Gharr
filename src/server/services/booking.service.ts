import type { BookingStatus, RateType, Trade } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { priceBooking } from "./pricing.service";
import { isSlotAvailable, isWithinWorkingHours } from "./availability.service";
import {
  allowedBookingTransitions,
  canTransitionBooking,
  cancellationFeePercent,
  type BookingRole,
} from "./booking-state";

/**
 * Labour bookings — the feature that distinguishes Gharr from a pure
 * materials marketplace.
 *
 * As with orders, one function owns every status change, and the slot conflict
 * check is repeated inside the write transaction: two customers can both see a
 * free 9 AM slot and tap Book at the same instant, and only one may win.
 */

function bookingRole(actor: Actor, workerUserId?: string): BookingRole {
  if (actor.roles.includes("ADMIN")) return "ADMIN";
  if (workerUserId && actor.userId === workerUserId) return "WORKER";
  if (actor.roles.includes("WORKER")) return "WORKER";
  return "CUSTOMER";
}

/** HB-YYMM-NNNNNN, from a sequence so concurrent bookings cannot collide. */
async function nextBookingNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('homeall_booking_seq') AS value
  `;
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `HB-${stamp}-${String(rows[0].value).padStart(6, "0")}`;
}

export interface CreateBookingInput {
  workerId: string;
  trade: Trade;
  rateType: RateType;
  /** YYYY-MM-DD, IST. */
  scheduledDate: string;
  startMinute: number;
  durationMinutes: number;
  addressId: string;
  workDescription: string;
  photoKeys?: string[];
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const worker = await prisma.worker.findFirst({
    where: { id: input.workerId, isActive: true },
    select: {
      id: true,
      displayName: true,
      userId: true,
      acceptsFixedPrice: true,
      rates: {
        where: { isActive: true, trade: input.trade },
        select: { rateType: true, amountPaise: true, minUnits: true },
      },
      skills: { select: { trade: true } },
    },
  });

  if (!worker) throw new NotFoundError("Worker");

  if (!worker.skills.some((skill) => skill.trade === input.trade)) {
    throw new ValidationError("This worker does not offer that trade");
  }

  if (input.rateType === "FIXED" && !worker.acceptsFixedPrice) {
    throw new ValidationError("This worker does not take fixed-price jobs");
  }

  const rate = worker.rates.find((r) => r.rateType === input.rateType);
  if (!rate) {
    throw new ValidationError("This worker does not offer that rate type");
  }

  const address = await prisma.address.findFirst({
    where: { id: input.addressId, userId, deletedAt: null },
  });
  if (!address) throw new NotFoundError("Address");

  const date = new Date(`${input.scheduledDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date");
  }

  if (input.durationMinutes < 60) {
    throw new ValidationError("Minimum booking is 1 hour");
  }

  if (input.startMinute + input.durationMinutes > 24 * 60) {
    throw new ValidationError("The job cannot run past midnight");
  }

  const withinHours = await isWithinWorkingHours(
    worker.id,
    date,
    input.startMinute,
    input.durationMinutes,
  );
  if (!withinHours) {
    throw new ConflictError(
      "That time is outside the worker's available hours. Pick another slot.",
    );
  }

  // Hours for HOURLY, days for DAILY, 1 for FIXED — the tuple the pricing
  // engine expects.
  const quantity =
    input.rateType === "HOURLY"
      ? input.durationMinutes / 60
      : input.rateType === "DAILY"
        ? Math.max(1, Math.ceil(input.durationMinutes / (8 * 60)))
        : 1;

  const pricing = priceBooking({
    rateType: input.rateType,
    rateAmountPaise: rate.amountPaise,
    quantity,
    minUnits: Number(rate.minUnits),
    platformFeePercent: env.LABOUR_COMMISSION_PERCENT,
  });

  const bookingNumber = await nextBookingNumber();

  const booking = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction. The check above was for a friendly error
    // message; this one is the actual guarantee.
    const free = await isSlotAvailable(
      worker.id,
      date,
      input.startMinute,
      input.durationMinutes,
    );

    if (!free) {
      throw new ConflictError(
        "That slot was just booked by someone else. Please pick another time.",
      );
    }

    return tx.labourBooking.create({
      data: {
        bookingNumber,
        userId,
        workerId: worker.id,
        trade: input.trade,
        status: "REQUESTED",
        scheduledDate: date,
        startMinute: input.startMinute,
        durationMinutes: input.durationMinutes,
        rateType: input.rateType,
        rateAmountPaise: rate.amountPaise,
        quantity: pricing.billableQuantity,
        labourSubtotalPaise: pricing.labourSubtotalPaise,
        extrasPaise: pricing.extrasPaise,
        platformFeePaise: pricing.platformFeePaise,
        discountPaise: pricing.discountPaise,
        estimatedTotalPaise: pricing.estimatedTotalPaise,
        addressSnapshot: {
          contactName: address.contactName,
          contactPhone: address.contactPhone,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
        workDescription: input.workDescription,
        photoKeys: input.photoKeys ?? [],
        events: {
          create: {
            toStatus: "REQUESTED",
            actorUserId: userId,
            actorRole: "CUSTOMER",
            reason: "Booking requested",
          },
        },
      },
      select: { id: true, bookingNumber: true, estimatedTotalPaise: true },
    });
  });

  // The worker is told there is a job waiting; delivery is out of band.
  await prisma.notification.create({
    data: {
      userId: worker.userId,
      type: "booking.requested",
      title: "New job request",
      body: `${input.trade.replace(/_/g, " ").toLowerCase()} work on ${input.scheduledDate}.`,
      data: { bookingId: booking.id },
    },
  });

  logger.info(
    { userId, workerId: worker.id, bookingId: booking.id },
    "Booking created",
  );

  return { ...booking, minimumApplied: pricing.minimumApplied };
}

export async function listBookings(userId: string, page = 1, perPage = 20) {
  const [rows, total] = await Promise.all([
    prisma.labourBooking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        trade: true,
        scheduledDate: true,
        startMinute: true,
        durationMinutes: true,
        rateType: true,
        estimatedTotalPaise: true,
        finalTotalPaise: true,
        worker: {
          select: { id: true, displayName: true, photoUrl: true, ratingAvg: true },
        },
      },
    }),
    prisma.labourBooking.count({ where: { userId } }),
  ]);

  return {
    items: rows.map((row) => ({
      ...row,
      worker: { ...row.worker, ratingAvg: Number(row.worker.ratingAvg) },
    })),
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getBooking(bookingId: string, actor: Actor) {
  const booking = await prisma.labourBooking.findFirst({
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
      photoKeys: true,
      checkedInAt: true,
      startedAt: true,
      completedAt: true,
      approvedAt: true,
      cancelledAt: true,
      cancelReason: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, phoneE164: true } },
      worker: {
        select: {
          id: true,
          displayName: true,
          photoUrl: true,
          ratingAvg: true,
          completedJobs: true,
          userId: true,
          user: { select: { phoneE164: true } },
        },
      },
      lines: true,
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

  if (!booking) throw new NotFoundError("Booking");

  const role = bookingRole(actor, booking.worker.userId);

  // Only the customer, the assigned worker, or an admin may read a booking.
  const permitted =
    booking.userId === actor.userId ||
    booking.worker.userId === actor.userId ||
    actor.roles.includes("ADMIN");

  if (!permitted) throw new NotFoundError("Booking");

  return {
    ...booking,
    quantity: Number(booking.quantity),
    worker: { ...booking.worker, ratingAvg: Number(booking.worker.ratingAvg) },
    viewerRole: role,
    availableActions: allowedBookingTransitions(booking.status, role),
  };
}

export interface BookingTransitionOptions {
  reason?: string;
  system?: boolean;
  meta?: RequestMeta;
}

/** The only function permitted to write LabourBooking.status. */
export async function transitionBooking(
  actor: Actor,
  bookingId: string,
  toStatus: BookingStatus,
  options: BookingTransitionOptions = {},
) {
  const booking = await prisma.labourBooking.findFirst({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      userId: true,
      workerId: true,
      scheduledDate: true,
      startMinute: true,
      estimatedTotalPaise: true,
      labourSubtotalPaise: true,
      worker: { select: { userId: true, displayName: true } },
    },
  });

  if (!booking) throw new NotFoundError("Booking");

  const role: BookingRole = options.system
    ? "SYSTEM"
    : bookingRole(actor, booking.worker.userId);

  // Neither party may act on someone else's booking.
  if (
    !options.system &&
    booking.userId !== actor.userId &&
    booking.worker.userId !== actor.userId &&
    !actor.roles.includes("ADMIN")
  ) {
    throw new NotFoundError("Booking");
  }

  if (!canTransitionBooking(booking.status, toStatus, role)) {
    throw new ConflictError(
      `Cannot move a booking from ${booking.status} to ${toStatus}`,
      { from: booking.status, to: toStatus, role },
    );
  }

  const now = new Date();

  // Cancellation fee depends on how close to the start time we are.
  const startsAt = new Date(booking.scheduledDate);
  startsAt.setMinutes(startsAt.getMinutes() + booking.startMinute);
  const hoursUntilStart = (startsAt.getTime() - now.getTime()) / 3_600_000;

  const isCancellation =
    toStatus === "CANCELLED_BY_CUSTOMER" || toStatus === "CANCELLED_BY_WORKER";

  // Only the customer pays a late-cancellation fee; a worker who withdraws does
  // not charge the customer for the privilege. Nor does a dispute resolved in
  // the customer's favour — that is a finding against the work, not a late
  // cancellation, so charging the fee would penalise the side that was upheld.
  const feePercent =
    toStatus === "CANCELLED_BY_CUSTOMER" && booking.status !== "DISPUTED"
      ? cancellationFeePercent(booking.status, hoursUntilStart)
      : 0;

  const cancellationFeePaise = Math.round(
    (booking.labourSubtotalPaise * feePercent) / 100,
  );

  await prisma.$transaction(async (tx) => {
    const updated = await tx.labourBooking.updateMany({
      where: { id: bookingId, status: booking.status },
      data: {
        status: toStatus,
        ...(toStatus === "CHECKED_IN" ? { checkedInAt: now } : {}),
        ...(toStatus === "IN_PROGRESS" ? { startedAt: now } : {}),
        ...(toStatus === "COMPLETED" ? { completedAt: now } : {}),
        ...(toStatus === "APPROVED"
          ? { approvedAt: now, finalTotalPaise: booking.estimatedTotalPaise }
          : {}),
        ...(isCancellation
          ? {
              cancelledAt: now,
              cancelReason: options.reason ?? null,
              cancellationFeePaise,
            }
          : {}),
      },
    });

    if (updated.count !== 1) {
      throw new ConflictError(
        "This booking was updated by someone else. Refresh and try again.",
      );
    }

    await tx.labourBookingEvent.create({
      data: {
        bookingId,
        fromStatus: booking.status,
        toStatus,
        actorUserId: options.system ? null : actor.userId,
        actorRole: role,
        reason: options.reason,
      },
    });

    await writeAudit(tx, {
      actor: options.system ? null : actor,
      actorRole: role,
      action: "booking.transition",
      entityType: "LabourBooking",
      entityId: bookingId,
      before: { status: booking.status },
      after: { status: toStatus, reason: options.reason },
      ...options.meta,
    });

    // Approval is what earns the platform its cut and completes the worker's job
    // count — not mere completion, which the worker declares unilaterally.
    if (toStatus === "APPROVED") {
      await tx.commission.create({
        data: {
          bookingId,
          workerId: booking.workerId,
          baseAmountPaise: booking.labourSubtotalPaise,
          ratePercent: env.LABOUR_COMMISSION_PERCENT,
          commissionPaise: Math.round(
            (booking.labourSubtotalPaise * env.LABOUR_COMMISSION_PERCENT) / 100,
          ),
        },
      });

      await tx.worker.update({
        where: { id: booking.workerId },
        data: { completedJobs: { increment: 1 } },
      });
    }

    // Notify whichever party did not act.
    const notifyUserId =
      role === "CUSTOMER" ? booking.worker.userId : booking.userId;

    await tx.notification.create({
      data: {
        userId: notifyUserId,
        type: `booking.${toStatus.toLowerCase()}`,
        title: "Booking update",
        body: `Booking is now ${toStatus.replace(/_/g, " ").toLowerCase()}.`,
        data: { bookingId },
      },
    });
  });

  // Hourly and daily work needs no negotiation, so acceptance confirms straight
  // away. Fixed-price jobs will stop at ACCEPTED for the customer to agree the
  // quote once that surface exists.
  if (toStatus === "ACCEPTED") {
    await transitionBooking(actor, bookingId, "CONFIRMED", {
      system: true,
      reason: "Auto-confirmed on acceptance",
    }).catch((error) => {
      logger.error({ err: error, bookingId }, "Auto-confirm after accept failed");
    });
  }

  logger.info(
    { bookingId, from: booking.status, to: toStatus, role },
    "Booking transitioned",
  );

  return { id: bookingId, status: toStatus, cancellationFeePaise };
}

/** The worker's job queue, for the worker console. */
export async function listWorkerBookings(actor: Actor, status?: BookingStatus) {
  const worker = await prisma.worker.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });

  const isAdmin = actor.roles.includes("ADMIN");
  if (!worker && !isAdmin) throw new NotFoundError("Worker profile");

  const rows = await prisma.labourBooking.findMany({
    where: {
      ...(worker ? { workerId: worker.id } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ scheduledDate: "asc" }, { startMinute: "asc" }],
    take: 50,
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      trade: true,
      scheduledDate: true,
      startMinute: true,
      durationMinutes: true,
      estimatedTotalPaise: true,
      workDescription: true,
      addressSnapshot: true,
      user: { select: { name: true, phoneE164: true } },
      worker: { select: { userId: true, displayName: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    availableActions: allowedBookingTransitions(
      row.status,
      bookingRole(actor, row.worker.userId),
    ),
  }));
}
