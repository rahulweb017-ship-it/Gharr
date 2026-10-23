/**
 * Pure date-bucketing and ratio helpers for the admin dashboard.
 *
 * Kept free of Prisma and env so they are unit-testable. Days are IST calendar
 * days: an order placed at 00:30 IST belongs to that IST date, not the UTC one.
 */

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export function parseRange(value: string | undefined): DashboardRange {
  const n = Number(value);
  return (DASHBOARD_RANGES as readonly number[]).includes(n) ? (n as DashboardRange) : 30;
}

/** "YYYY-MM-DD" of the IST calendar day containing `date`. */
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** IST midnight that opens a range of `days` days ending today (inclusive). */
export function rangeStart(days: number, now: Date): Date {
  const todayMidnight = new Date(`${istDayKey(now)}T00:00:00+05:30`);
  return new Date(todayMidnight.getTime() - (days - 1) * DAY_MS);
}

/** Every IST day key from `start` for `days` days, oldest first. */
export function dayKeys(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) => istDayKey(new Date(start.getTime() + i * DAY_MS)));
}

export interface DailyPoint {
  day: string;
  orders: number;
  gmvPaise: number;
}

/** Zero-fills sparse per-day rows onto the full list of days. */
export function fillDaily(
  keys: string[],
  orders: Array<{ day: string; n: number }>,
  gmv: Array<{ day: string; paise: number }>,
): DailyPoint[] {
  const o = new Map(orders.map((r) => [r.day, r.n]));
  const g = new Map(gmv.map((r) => [r.day, r.paise]));
  return keys.map((day) => ({ day, orders: o.get(day) ?? 0, gmvPaise: g.get(day) ?? 0 }));
}

/** Null (rendered "—") when the denominator is zero, rather than a fake 0%. */
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/** Integer-paise average; null when nothing was delivered. */
export function averagePaise(totalPaise: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round(totalPaise / count);
}
