"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Hourglass, MapPin, NotebookPen, Wrench } from "lucide-react";
import type { RateType, Trade } from "@prisma/client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Money, MoneyRow } from "@/components/ui/Money";
import { Card, StickyBar } from "@/components/ui/Surface";
import { inputClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddressPicker } from "@/components/account/AddressPicker";
import type { SavedAddress } from "@/components/account/AddressForm";
import { WorkerAvatar } from "@/components/labour/WorkerCard";
import { apiPost } from "@/lib/api-client";
import { formatINR } from "@/shared/money";
import { priceBooking } from "@/shared/booking-pricing";
import { TRADE_LABELS } from "@/shared/trades";
import { formatMinute, type DayAvailability } from "@/shared/time";

/**
 * Booking form.
 *
 * The estimate is computed with the same `priceBooking` the server uses, so the
 * figure on the button is the figure that gets charged — including the minimum
 * billable hours, which is the most common source of "why is it more than I
 * expected" complaints in hourly trades.
 */

interface WorkerSummary {
  id: string;
  displayName: string;
  photoUrl: string | null;
  skills: Trade[];
  rates: Array<{
    trade: Trade;
    rateType: RateType;
    amountPaise: number;
    minUnits: number;
  }>;
}

const DURATIONS = [
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 480, label: "Full day (8h)" },
];

/** Selected = navy, per the UI boards; used by every pill-style choice here. */
function pillClass(selected: boolean, disabled = false) {
  return cn(
    "min-h-10 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
    selected
      ? "border-ink-900 bg-ink-900 text-white"
      : disabled
        ? "border-ink-100 bg-ink-50 text-ink-300"
        : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
      <span className="text-ink-400">{icon}</span>
      {children}
    </h2>
  );
}

export function BookingForm({
  worker,
  availability,
  addresses,
  addressDefaults,
  initialDate,
  platformFeePercent,
}: {
  worker: WorkerSummary;
  availability: DayAvailability[];
  addresses: SavedAddress[];
  /** Prefill for a first address added from the picker. */
  addressDefaults?: { contactName?: string; contactPhone?: string; city?: string };
  /** YYYY-MM-DD deep link from the profile calendar; ignored if not bookable. */
  initialDate?: string;
  platformFeePercent: number;
}) {
  const router = useRouter();

  const [trade, setTrade] = useState<Trade>(worker.skills[0]);
  const rateTypesFor = (t: Trade) =>
    (["HOURLY", "DAILY"] as const).filter((option) =>
      worker.rates.some((r) => r.trade === t && r.rateType === option),
    );
  const [rateType, setRateType] = useState<RateType>(
    () => rateTypesFor(worker.skills[0])[0] ?? "HOURLY",
  );
  const [date, setDate] = useState(() => {
    const deepLinked = availability.find(
      (day) => day.date === initialDate && day.ranges.length > 0,
    );
    return (
      deepLinked?.date ??
      availability.find((day) => day.ranges.length > 0)?.date ??
      availability[0]?.date
    );
  });
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [duration, setDuration] = useState(180);
  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDay = availability.find((day) => day.date === date);

  const rate = worker.rates.find(
    (r) => r.trade === trade && r.rateType === rateType,
  );

  /**
   * Start times are offered on the hour within each free window, and only where
   * the whole job fits before the window ends — offering 5 PM for a 4-hour job
   * that must finish by 6 PM would just produce a rejection.
   */
  const startOptions = useMemo(() => {
    if (!selectedDay) return [];
    const options: number[] = [];

    for (const range of selectedDay.ranges) {
      const firstSlot = Math.ceil(range.startMinute / 60) * 60;
      for (let minute = firstSlot; minute + duration <= range.endMinute; minute += 60) {
        options.push(minute);
      }
    }

    return options;
  }, [selectedDay, duration]);

  const pricing = rate
    ? priceBooking({
        rateType,
        rateAmountPaise: rate.amountPaise,
        quantity:
          rateType === "HOURLY"
            ? duration / 60
            : Math.max(1, Math.ceil(duration / (8 * 60))),
        minUnits: rate.minUnits,
        platformFeePercent,
      })
    : null;

  const canSubmit =
    !!rate && startMinute != null && !!addressId && description.trim().length >= 10;

  // Tell the customer what is still missing instead of a silently dead button.
  const missing = !rate
    ? "Choose how you want to pay"
    : startMinute == null
      ? "Pick a start time"
      : !addressId
        ? "Add the job site address"
        : description.trim().length < 10
          ? "Describe the work"
          : null;

  async function submit() {
    if (!canSubmit || startMinute == null) return;

    setBusy(true);
    setError(null);

    const result = await apiPost<{ id: string; bookingNumber: string }>(
      "/bookings",
      {
        workerId: worker.id,
        trade,
        rateType,
        scheduledDate: date,
        startMinute,
        durationMinutes: duration,
        addressId,
        workDescription: description.trim(),
      },
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.push(`/bookings/${result.data.id}?placed=1`);
  }

  const rateOptions = rateTypesFor(trade);

  return (
    <div className="pb-44 md:pb-8">
      <PageHeader
        title={`Book ${worker.displayName}`}
        subtitle="Choose a time and describe the job"
        backHref={`/labour/${worker.id}`}
      />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-8">
        <div className="flex flex-col gap-4 px-4 pt-4 md:px-0 md:pt-0">
          {/* Worker summary */}
          <Card className="flex items-center gap-3 p-3.5">
            <WorkerAvatar photoUrl={worker.photoUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-ink-900">{worker.displayName}</p>
              <p className="truncate text-xs text-ink-500">
                {worker.skills.map((skill) => TRADE_LABELS[skill]).join(" · ")}
              </p>
            </div>
          </Card>

          {/* Trade + rate type */}
          <Card className="flex flex-col gap-3 p-4">
            <SectionTitle icon={<Wrench aria-hidden className="size-4" />}>
              Type of work
            </SectionTitle>

            {worker.skills.length > 1 && (
              <div role="radiogroup" aria-label="Trade" className="flex flex-wrap gap-2">
                {worker.skills.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={trade === option}
                    onClick={() => {
                      setTrade(option);
                      // Keep the pay option valid for the newly chosen trade.
                      const available = rateTypesFor(option);
                      if (!available.includes(rateType as "HOURLY" | "DAILY") && available[0]) {
                        setRateType(available[0]);
                      }
                    }}
                    className={pillClass(trade === option)}
                  >
                    {TRADE_LABELS[option]}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[13px] font-semibold text-ink-700">How do you want to pay?</p>
            {rateOptions.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                This worker has no hourly or daily rate for {TRADE_LABELS[trade]}.
              </p>
            ) : (
              <div role="radiogroup" aria-label="Rate type" className="grid grid-cols-2 gap-2">
                {rateOptions.map((option) => {
                  const optionRate = worker.rates.find(
                    (r) => r.trade === trade && r.rateType === option,
                  )!;
                  const selected = rateType === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRateType(option)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-brand-600 bg-brand-50/60"
                          : "border-ink-200 hover:border-ink-300",
                      )}
                    >
                      <span className="block text-[13px] font-bold text-ink-900">
                        {option === "HOURLY" ? "By the hour" : "Full day"}
                      </span>
                      <span className="block text-sm font-bold text-brand-700">
                        <Money paise={optionRate.amountPaise} />
                        <span className="text-xs font-medium text-ink-400">
                          {option === "HOURLY" ? "/hr" : "/day"}
                        </span>
                      </span>
                      {option === "HOURLY" && optionRate.minUnits > 1 && (
                        <span className="block text-[11px] text-ink-400">
                          minimum {optionRate.minUnits} hours
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Date, duration, start time */}
          <Card className="flex flex-col gap-4 py-4">
            <div>
              <div className="px-4">
                <SectionTitle icon={<CalendarDays aria-hidden className="size-4" />}>
                  Date
                </SectionTitle>
              </div>
              <div
                role="radiogroup"
                aria-label="Date"
                className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 pb-1"
              >
                {availability.map((day) => {
                  const unavailable = day.ranges.length === 0;
                  const selected = date === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={unavailable}
                      onClick={() => {
                        setDate(day.date);
                        setStartMinute(null);
                      }}
                      className={cn(
                        "min-h-14 min-w-[76px] shrink-0 rounded-xl border px-3 py-2 text-center transition-colors",
                        selected
                          ? "border-ink-900 bg-ink-900 text-white"
                          : unavailable
                            ? "border-ink-100 bg-ink-50 text-ink-300"
                            : "border-ink-200 text-ink-800 hover:border-ink-300",
                      )}
                    >
                      <span className="block text-xs font-semibold">{day.label}</span>
                      <span
                        className={cn(
                          "block text-[11px]",
                          selected ? "text-ink-200" : unavailable ? "" : "text-trust-700",
                        )}
                      >
                        {day.isOnLeave ? "On leave" : unavailable ? "Booked" : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4">
              <SectionTitle icon={<Hourglass aria-hidden className="size-4" />}>
                How long?
              </SectionTitle>
              <div role="radiogroup" aria-label="Duration" className="mt-2 flex flex-wrap gap-2">
                {DURATIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    role="radio"
                    aria-checked={duration === option.minutes}
                    onClick={() => {
                      setDuration(option.minutes);
                      setStartMinute(null);
                    }}
                    className={pillClass(duration === option.minutes)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4">
              <SectionTitle icon={<Clock aria-hidden className="size-4" />}>
                Start time
              </SectionTitle>

              {startOptions.length === 0 ? (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  No {duration / 60}-hour window free on this day. Try a shorter job or
                  another date.
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Start time"
                  className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4"
                >
                  {startOptions.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      role="radio"
                      aria-checked={startMinute === minute}
                      onClick={() => setStartMinute(minute)}
                      className={cn(
                        "min-h-11 rounded-xl border px-1 text-[13px] font-semibold transition-colors",
                        startMinute === minute
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-ink-200 text-ink-700 hover:border-ink-300",
                      )}
                    >
                      {formatMinute(minute)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Job site address — AddressPicker lets a first-time customer add one inline. */}
          <Card className="flex flex-col gap-3 p-4">
            <SectionTitle icon={<MapPin aria-hidden className="size-4" />}>
              Where is the work?
            </SectionTitle>
            <AddressPicker
              addresses={addresses}
              selectedId={addressId}
              onSelect={setAddressId}
              defaults={addressDefaults}
              label="Job site address"
            />
          </Card>

          {/* Description */}
          <Card className="flex flex-col gap-2 p-4">
            <label htmlFor="work" className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
              <NotebookPen aria-hidden className="size-4 text-ink-400" />
              What needs doing?
            </label>
            <textarea
              id="work"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="e.g. Install a new DB board and rewire two bedroom circuits. Materials already on site."
              className={cn(inputClass, "h-auto resize-none py-3")}
            />
            <p className="text-xs text-ink-400">
              {description.trim().length < 10
                ? "At least 10 characters — the worker needs to know what to bring."
                : `${description.length}/1000`}
            </p>
          </Card>
        </div>

        <aside className="mt-4 flex flex-col gap-4 px-4 md:sticky md:top-24 md:mt-0 md:px-0">
          {/* Estimate */}
          {pricing && rate && (
            <Card className="p-4">
              <h2 className="mb-1 text-[15px] font-bold text-ink-900">Estimate</h2>
              <MoneyRow
                label={
                  rateType === "HOURLY"
                    ? `Labour (${pricing.billableQuantity}h × ${formatINR(rate.amountPaise)})`
                    : `Labour (${pricing.billableQuantity} day${pricing.billableQuantity > 1 ? "s" : ""})`
                }
                paise={pricing.labourSubtotalPaise}
              />
              <MoneyRow label={`Platform fee (${platformFeePercent}%)`} paise={pricing.platformFeePaise} />
              <div className="mt-1 border-t border-ink-100 pt-1">
                <MoneyRow label="Estimated total" paise={pricing.estimatedTotalPaise} emphasis />
              </div>

              {pricing.minimumApplied && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This worker has a {rate.minUnits}-hour minimum, so the estimate covers{" "}
                  {pricing.billableQuantity} hours.
                </p>
              )}

              <p className="mt-2 text-xs leading-relaxed text-ink-400">
                Materials are not included. The final amount is confirmed after the work
                is completed and you approve it.
              </p>
            </Card>
          )}

          <StickyBar>
            {error && (
              <p role="alert" className="mb-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}
            <div className="flex items-center gap-3 md:flex-col md:items-stretch">
              <div className="shrink-0 md:hidden">
                <p className="text-xs text-ink-400">Estimate</p>
                <p className="text-lg leading-tight font-bold text-ink-900">
                  {pricing ? <Money paise={pricing.estimatedTotalPaise} /> : "—"}
                </p>
              </div>
              <Button onClick={submit} loading={busy} disabled={!canSubmit} size="lg" fullWidth className="flex-1 md:flex-none">
                Request Booking
              </Button>
            </div>
            {missing && !busy && (
              <p className="mt-1.5 text-center text-xs text-ink-400">{missing}</p>
            )}
          </StickyBar>
        </aside>
      </div>
    </div>
  );
}
