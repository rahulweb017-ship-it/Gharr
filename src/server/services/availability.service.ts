import { prisma } from "@/server/db/prisma";
import type { DayAvailability, TimeRange } from "@/shared/time";

// Time formatting and the availability shapes are shared with client components.
export { formatMinute, formatRange } from "@/shared/time";
export type { DayAvailability, TimeRange } from "@/shared/time";

/**
 * Worker availability.
 *
 * Composed from three layers, in order:
 *   1. the recurring weekly template (WorkerAvailability)
 *   2. date-specific overrides — leave or extra hours (WorkerAvailabilityException)
 *   3. bookings already confirmed for that date
 *
 * All times are IST wall-clock minutes-of-day. Nothing here constructs a
 * DateTime from a date plus a time, which is what makes the whole module immune
 * to the "booking moved by 5.5 hours" class of bug.
 */

/** Statuses that occupy a worker's calendar. Rejected/cancelled ones do not. */
const BLOCKING_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

/** Removes `busy` from `base`, splitting ranges where a booking sits in the middle. */
export function subtractRanges(base: TimeRange[], busy: TimeRange[]): TimeRange[] {
  let result = [...base];

  for (const block of busy) {
    const next: TimeRange[] = [];

    for (const range of result) {
      // No overlap — the range survives untouched.
      if (block.endMinute <= range.startMinute || block.startMinute >= range.endMinute) {
        next.push(range);
        continue;
      }

      // Free time before the booking.
      if (block.startMinute > range.startMinute) {
        next.push({ startMinute: range.startMinute, endMinute: block.startMinute });
      }

      // Free time after the booking.
      if (block.endMinute < range.endMinute) {
        next.push({ startMinute: block.endMinute, endMinute: range.endMinute });
      }
    }

    result = next;
  }

  // Windows too short to be worth offering are dropped — nobody books 20 minutes
  // of a mason's time.
  return result.filter((range) => range.endMinute - range.startMinute >= 60);
}

/**
 * Calendar key for a date built in LOCAL time.
 *
 * `toISOString()` cannot be used here: in IST (UTC+5:30) local midnight is
 * 18:30 UTC the previous day, so it would key "today" as yesterday and shift
 * every booking by one day.
 */
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calendar key for a date that came out of a Postgres `date` column.
 *
 * Prisma hands those back as UTC midnight, so the UTC getters are the correct
 * ones — using local getters here would introduce the mirror image of the bug
 * above.
 */
function dbDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC for a YYYY-MM-DD key, matching how `@db.Date` values are stored. */
export function dateKeyToUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * Availability for the next `days` days.
 *
 * Returns whole free ranges rather than fixed slots, because labour durations
 * vary — a 2-hour repair and a full-day job should both be expressible without
 * forcing the customer onto an arbitrary grid.
 */
export async function getAvailability(
  workerId: string,
  days = 14,
): Promise<DayAvailability[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + days);

  // `scheduledDate` and `date` are Postgres `date` columns, so a timestamp bound
  // is truncated to a day using the server's timezone. Passing local midnight
  // (18:30 UTC the previous day in IST) therefore shifts both bounds back a day
  // and silently drops the final day of the window. Querying on UTC midnight of
  // the intended calendar days keeps the comparison exact.
  const rangeStart = dateKeyToUtcDate(localDateKey(today));
  const rangeEnd = dateKeyToUtcDate(localDateKey(lastDay));

  const [template, exceptions, bookings] = await Promise.all([
    prisma.workerAvailability.findMany({
      where: { workerId },
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    }),
    prisma.workerAvailabilityException.findMany({
      where: { workerId, date: { gte: rangeStart, lt: rangeEnd } },
      select: { date: true, type: true, startMinute: true, endMinute: true },
    }),
    prisma.labourBooking.findMany({
      where: {
        workerId,
        scheduledDate: { gte: rangeStart, lt: rangeEnd },
        status: { in: [...BLOCKING_STATUSES] },
      },
      select: { scheduledDate: true, startMinute: true, durationMinutes: true },
    }),
  ]);

  const result: DayAvailability[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const key = localDateKey(date);
    const dayOfWeek = date.getDay();

    const dayExceptions = exceptions.filter((e) => dbDateKey(e.date) === key);
    const blocked = dayExceptions.filter((e) => e.type === "BLOCKED");

    // A BLOCKED exception with no times means the whole day is off.
    const fullDayLeave = blocked.some(
      (e) => e.startMinute == null && e.endMinute == null,
    );

    let ranges: TimeRange[] = fullDayLeave
      ? []
      : template
          .filter((slot) => slot.dayOfWeek === dayOfWeek)
          .map((slot) => ({
            startMinute: slot.startMinute,
            endMinute: slot.endMinute,
          }));

    // EXTRA exceptions add availability outside the usual week.
    for (const extra of dayExceptions) {
      if (
        extra.type === "EXTRA" &&
        extra.startMinute != null &&
        extra.endMinute != null
      ) {
        ranges.push({ startMinute: extra.startMinute, endMinute: extra.endMinute });
      }
    }

    const busy: TimeRange[] = [
      ...blocked
        .filter((e) => e.startMinute != null && e.endMinute != null)
        .map((e) => ({ startMinute: e.startMinute!, endMinute: e.endMinute! })),
      ...bookings
        .filter((b) => dbDateKey(b.scheduledDate) === key)
        .map((b) => ({
          startMinute: b.startMinute,
          endMinute: b.startMinute + b.durationMinutes,
        })),
    ];

    ranges = subtractRanges(ranges, busy);

    // Today's past hours are not bookable.
    if (offset === 0) {
      const nowMinute = new Date().getHours() * 60 + new Date().getMinutes();
      // One hour of notice — nobody can be on site in ten minutes.
      const earliest = nowMinute + 60;
      ranges = subtractRanges(ranges, [{ startMinute: 0, endMinute: earliest }]);
    }

    result.push({
      date: key,
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
      dayOfWeek,
      ranges,
      isFullyBooked: ranges.length === 0 && !fullDayLeave,
      isOnLeave: fullDayLeave,
    });
  }

  return result;
}

/**
 * Whether a specific window is free.
 *
 * Called inside the booking transaction as the final guard — two customers can
 * pass an availability check simultaneously, so the booking itself must re-check
 * against the database rather than trusting what the UI displayed.
 */
export async function isSlotAvailable(
  workerId: string,
  date: Date,
  startMinute: number,
  durationMinutes: number,
): Promise<boolean> {
  const endMinute = startMinute + durationMinutes;

  // A booking's end is startMinute + durationMinutes, which is not a stored
  // column, so the overlap test cannot be pushed entirely into SQL without a
  // generated column. Fetching one worker's bookings for one day is a handful of
  // rows on the (workerId, scheduledDate, startMinute) index, so the exact test
  // happens here instead.
  const sameDay = await prisma.labourBooking.findMany({
    where: {
      workerId,
      scheduledDate: date,
      status: { in: [...BLOCKING_STATUSES] },
      // Cheap prefilter: anything starting at or after our end cannot overlap.
      startMinute: { lt: endMinute },
    },
    select: { startMinute: true, durationMinutes: true },
  });

  // Two windows overlap when each starts before the other ends.
  return !sameDay.some(
    (booking) => booking.startMinute + booking.durationMinutes > startMinute,
  );
}

/** Does the requested window sit inside the worker's declared hours? */
export async function isWithinWorkingHours(
  workerId: string,
  date: Date,
  startMinute: number,
  durationMinutes: number,
): Promise<boolean> {
  const key = dbDateKey(date);
  const days = await getAvailability(workerId, 30);
  const day = days.find((d) => d.date === key);
  if (!day) return false;

  const endMinute = startMinute + durationMinutes;

  return day.ranges.some(
    (range) => range.startMinute <= startMinute && range.endMinute >= endMinute,
  );
}
