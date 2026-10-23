/**
 * Wall-clock time helpers, shared by the availability service and every client
 * component that renders a slot.
 *
 * Times are minutes-of-day in IST. Keeping them as integers rather than Date
 * objects is what makes booking slots immune to timezone drift.
 */

export interface TimeRange {
  startMinute: number;
  endMinute: number;
}

export interface DayAvailability {
  date: string;
  label: string;
  dayOfWeek: number;
  /** Bookable windows after leave and existing jobs are removed. */
  ranges: TimeRange[];
  isFullyBooked: boolean;
  isOnLeave: boolean;
}

/** 540 -> "9:00 AM". */
export function formatMinute(minute: number): string {
  const hour24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** "9:00 AM – 1:00 PM" */
export function formatRange(range: TimeRange): string {
  return `${formatMinute(range.startMinute)} – ${formatMinute(range.endMinute)}`;
}
