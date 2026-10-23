import type { BookingStatus } from "@prisma/client";

/**
 * Labour booking lifecycle, from the blueprint:
 *   requested → accepted/rejected → confirmed → check-in → in progress →
 *   completed → customer approval → payout
 *
 * Unlike an order, both sides drive this machine: the customer requests and
 * approves, the worker accepts, checks in and completes. Encoding who may do
 * what is therefore the whole point of the table.
 */

export type BookingRole = "CUSTOMER" | "WORKER" | "ADMIN" | "SYSTEM";

export interface BookingTransition {
  to: BookingStatus;
  roles: BookingRole[];
  label: string;
}

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingTransition[]> = {
  REQUESTED: [
    { to: "ACCEPTED", roles: ["WORKER", "ADMIN"], label: "Accept job" },
    { to: "REJECTED", roles: ["WORKER", "ADMIN"], label: "Decline job" },
    {
      to: "CANCELLED_BY_CUSTOMER",
      roles: ["CUSTOMER", "ADMIN"],
      label: "Cancel request",
    },
  ],
  ACCEPTED: [
    // Confirmation is automatic on acceptance for hourly/daily work; the step
    // exists so fixed-price quotes can require explicit customer agreement.
    { to: "CONFIRMED", roles: ["SYSTEM", "CUSTOMER", "ADMIN"], label: "Confirm booking" },
    {
      to: "CANCELLED_BY_CUSTOMER",
      roles: ["CUSTOMER", "ADMIN"],
      label: "Cancel booking",
    },
    { to: "CANCELLED_BY_WORKER", roles: ["WORKER", "ADMIN"], label: "Withdraw" },
  ],
  CONFIRMED: [
    { to: "CHECKED_IN", roles: ["WORKER", "ADMIN"], label: "Check in on site" },
    {
      to: "CANCELLED_BY_CUSTOMER",
      roles: ["CUSTOMER", "ADMIN"],
      label: "Cancel booking",
    },
    { to: "CANCELLED_BY_WORKER", roles: ["WORKER", "ADMIN"], label: "Withdraw" },
    { to: "NO_SHOW", roles: ["CUSTOMER", "ADMIN"], label: "Worker did not arrive" },
  ],
  CHECKED_IN: [
    { to: "IN_PROGRESS", roles: ["WORKER", "ADMIN"], label: "Start work" },
    { to: "CANCELLED_BY_WORKER", roles: ["WORKER", "ADMIN"], label: "Abandon job" },
  ],
  IN_PROGRESS: [
    { to: "COMPLETED", roles: ["WORKER", "ADMIN"], label: "Mark complete" },
    { to: "DISPUTED", roles: ["CUSTOMER", "ADMIN"], label: "Raise an issue" },
  ],
  COMPLETED: [
    { to: "APPROVED", roles: ["CUSTOMER", "SYSTEM", "ADMIN"], label: "Approve work" },
    { to: "DISPUTED", roles: ["CUSTOMER", "ADMIN"], label: "Raise an issue" },
  ],
  APPROVED: [
    { to: "PAID_OUT", roles: ["SYSTEM", "ADMIN"], label: "Release payout" },
  ],
  DISPUTED: [
    { to: "APPROVED", roles: ["ADMIN"], label: "Resolve in worker's favour" },
    { to: "CANCELLED_BY_CUSTOMER", roles: ["ADMIN"], label: "Resolve in customer's favour" },
  ],
  // Terminal states.
  REJECTED: [],
  PAID_OUT: [],
  CANCELLED_BY_CUSTOMER: [],
  CANCELLED_BY_WORKER: [],
  NO_SHOW: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
  role: BookingRole,
): boolean {
  return (BOOKING_TRANSITIONS[from] ?? []).some(
    (transition) => transition.to === to && transition.roles.includes(role),
  );
}

export function allowedBookingTransitions(
  from: BookingStatus,
  role: BookingRole,
): BookingTransition[] {
  return (BOOKING_TRANSITIONS[from] ?? []).filter((t) => t.roles.includes(role));
}

export function isBookingTerminal(status: BookingStatus): boolean {
  return (BOOKING_TRANSITIONS[status] ?? []).length === 0;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED: "Awaiting worker response",
  ACCEPTED: "Accepted",
  REJECTED: "Declined by worker",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Worker on site",
  IN_PROGRESS: "Work in progress",
  COMPLETED: "Work completed",
  APPROVED: "Approved",
  PAID_OUT: "Paid out",
  CANCELLED_BY_CUSTOMER: "Cancelled by you",
  CANCELLED_BY_WORKER: "Cancelled by worker",
  NO_SHOW: "Worker did not arrive",
  DISPUTED: "Under review",
};

/** Happy path for the customer-facing progress tracker. */
export const BOOKING_TIMELINE: BookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "APPROVED",
];

/**
 * Cancellation policy, expressed once so the fee shown to the customer and the
 * fee actually charged cannot diverge.
 *
 * A worker who has turned down other jobs and travelled to site has a real loss,
 * which is what the tiers protect against.
 */
export function cancellationFeePercent(
  status: BookingStatus,
  hoursUntilStart: number,
): number {
  if (status === "REQUESTED" || status === "ACCEPTED") return 0;
  if (status === "CHECKED_IN" || status === "IN_PROGRESS") return 100;
  if (hoursUntilStart >= 12) return 0;
  return 25;
}
