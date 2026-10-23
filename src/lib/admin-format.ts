/** Display helpers shared by admin screens. */

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "OUT_FOR_DELIVERY" → "Out for delivery". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD into an inclusive Prisma date range. */
export function dateRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const f = valid(from);
  const t = valid(to);
  if (!f && !t) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (f) range.gte = new Date(`${f}T00:00:00+05:30`);
  if (t) {
    const end = new Date(`${t}T00:00:00+05:30`);
    end.setDate(end.getDate() + 1);
    range.lt = end;
  }
  return range;
}
