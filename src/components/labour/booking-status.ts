import type { BookingStatus } from "@prisma/client";

/**
 * Presentation grouping of booking statuses for the "Labour tracking" tabs and
 * status pills. The statuses and their labels still come from booking-state.ts;
 * this only decides which tab and colour each one lands in.
 */

export type BookingTab = "active" | "completed" | "cancelled";

export const BOOKING_TAB_STATUSES: Record<BookingTab, BookingStatus[]> = {
  active: ["REQUESTED", "ACCEPTED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"],
  completed: ["COMPLETED", "APPROVED", "PAID_OUT"],
  // Disputes sit here: the job has stopped and is with support, not in flight.
  cancelled: ["REJECTED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_WORKER", "NO_SHOW", "DISPUTED"],
};

export function bookingTab(status: BookingStatus): BookingTab {
  if (BOOKING_TAB_STATUSES.completed.includes(status)) return "completed";
  if (BOOKING_TAB_STATUSES.cancelled.includes(status)) return "cancelled";
  return "active";
}

/** Green only when the worker is on site or the job is signed off. */
export function bookingTone(status: BookingStatus) {
  if (
    status === "CHECKED_IN" ||
    status === "IN_PROGRESS" ||
    status === "APPROVED" ||
    status === "PAID_OUT"
  ) {
    return "trust" as const;
  }
  if (status === "REQUESTED" || status === "COMPLETED") return "warning" as const;
  if (bookingTab(status) === "cancelled") return "danger" as const;
  return "neutral" as const;
}
