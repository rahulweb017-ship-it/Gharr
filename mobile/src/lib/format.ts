import { formatMinute } from "@/shared/time";
import type { BookingStatus, OrderStatus } from "~/api/types";

type Tone = "neutral" | "brand" | "trust" | "danger";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "brand" },
  CONFIRMED: { label: "Confirmed", tone: "trust" },
  ACCEPTED: { label: "Accepted by seller", tone: "trust" },
  PACKED: { label: "Packed", tone: "trust" },
  DISPATCHED: { label: "Dispatched", tone: "trust" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "brand" },
  DELIVERED: { label: "Delivered", tone: "trust" },
  DELIVERY_FAILED: { label: "Delivery failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  RETURN_REQUESTED: { label: "Return requested", tone: "neutral" },
  RETURNED: { label: "Returned", tone: "neutral" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Requested", tone: "brand" },
  ACCEPTED: { label: "Accepted", tone: "trust" },
  REJECTED: { label: "Declined", tone: "danger" },
  CONFIRMED: { label: "Confirmed", tone: "trust" },
  CHECKED_IN: { label: "Worker arrived", tone: "trust" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "trust" },
  APPROVED: { label: "Approved", tone: "trust" },
  PAID_OUT: { label: "Paid", tone: "neutral" },
  CANCELLED_BY_CUSTOMER: { label: "Cancelled", tone: "danger" },
  CANCELLED_BY_WORKER: { label: "Cancelled by worker", tone: "danger" },
  NO_SHOW: { label: "No-show", tone: "danger" },
  DISPUTED: { label: "Disputed", tone: "danger" },
};

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** Booking slot, e.g. "3 Oct 2026 · 9:00 AM, 4 h". scheduledDate is a @db.Date (UTC midnight). */
export function formatSlot(scheduledDate: string, startMinute: number, durationMinutes: number): string {
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(scheduledDate),
  );
  const hours = durationMinutes / 60;
  return `${day} · ${formatMinute(startMinute)}, ${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}
