"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRange, type DayAvailability } from "@/shared/time";

/**
 * Month view of a worker's bookable days.
 *
 * The days come straight from `getAvailability` (template − leave − existing
 * jobs), so a green day here is a day the booking API will accept. Dates are
 * handled as YYYY-MM-DD keys with UTC arithmetic only, so the grid cannot drift
 * a day for viewers outside IST.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month: month - 1, day };
}

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function AvailabilityCalendar({
  workerId,
  days,
}: {
  workerId: string;
  days: DayAvailability[];
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  // Months the availability window touches — navigation stays inside it.
  const months = useMemo(() => {
    const seen: Array<{ year: number; month: number }> = [];
    for (const day of days) {
      const { year, month } = parseKey(day.date);
      if (!seen.some((m) => m.year === year && m.month === month)) {
        seen.push({ year, month });
      }
    }
    return seen;
  }, [days]);

  const firstFree = days.find((d) => d.ranges.length > 0)?.date ?? null;
  const [selected, setSelected] = useState<string | null>(firstFree);
  const [monthIndex, setMonthIndex] = useState(() => {
    if (!firstFree) return 0;
    const { year, month } = parseKey(firstFree);
    return Math.max(0, months.findIndex((m) => m.year === year && m.month === month));
  });

  if (months.length === 0) return null;

  const { year, month } = months[monthIndex];
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const selectedDay = selected ? byDate.get(selected) : undefined;
  const selectedLabel = selected
    ? new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "";

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-800">{monthLabel}</p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={monthIndex === 0}
            onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
            className="flex size-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 disabled:text-ink-200 disabled:hover:bg-transparent"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={monthIndex === months.length - 1}
            onClick={() => setMonthIndex((i) => Math.min(months.length - 1, i + 1))}
            className="flex size-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 disabled:text-ink-200 disabled:hover:bg-transparent"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>

      <div aria-label={`Availability for ${monthLabel}`} role="group" className="mt-1">
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((name) => (
            <span
              key={name}
             
              className="py-1 text-[11px] font-semibold text-ink-400"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {Array.from({ length: leading }, (_, i) => (
            <span key={`pad-${i}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dayNumber = i + 1;
            const key = toKey(year, month, dayNumber);
            const info = byDate.get(key);
            const free = !!info && info.ranges.length > 0;
            const isSelected = key === selected;

            return (
              <span key={key} className="flex justify-center">
                <button
                  type="button"
                  disabled={!free}
                  aria-pressed={isSelected}
                  aria-label={`${dayNumber} ${monthLabel}: ${
                    !info ? "outside booking window" : free ? "available" : info.isOnLeave ? "on leave" : "not available"
                  }`}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "relative flex size-10 flex-col items-center justify-center rounded-full text-sm font-semibold tabular transition-colors",
                    isSelected
                      ? "bg-ink-900 text-white"
                      : free
                        ? "bg-trust-50 text-trust-700 hover:bg-trust-100"
                        : info
                          ? "text-ink-300"
                          : "text-ink-200",
                  )}
                >
                  {dayNumber}
                  {free && !isSelected && (
                    <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-trust-500" />
                  )}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-trust-500" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-ink-200" />
          Not available
        </span>
      </div>

      {selectedDay && selectedDay.ranges.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5 text-[13px] text-ink-700">
            <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
            <span>
              <span className="font-semibold text-ink-900">{selectedLabel}</span>
              {" · "}
              {selectedDay.ranges.map(formatRange).join(", ")}
            </span>
          </p>
          <Link
            href={`/labour/${workerId}/book?date=${selected}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Book this day <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      ) : (
        !firstFree && (
          <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2.5 text-[13px] text-ink-500">
            Fully booked for the next 30 days.
          </p>
        )
      )}
    </div>
  );
}
