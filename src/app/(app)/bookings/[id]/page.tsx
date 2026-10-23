import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  NotebookPen,
  Phone,
} from "lucide-react";
import { getBooking } from "@/server/services/booking.service";
import { requirePageActor } from "@/server/auth/page-session";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_TIMELINE,
} from "@/server/services/booking-state";
import { MoneyRow } from "@/components/ui/Money";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Surface";
import { RatingStars } from "@/components/ui/RatingStars";
import { PageHeader } from "@/components/layout/PageHeader";
import { BookingActions } from "@/components/labour/BookingActions";
import { WorkerAvatar } from "@/components/labour/WorkerCard";
import { bookingTab, bookingTone } from "@/components/labour/booking-status";
import { formatINR } from "@/shared/money";
import { formatPhone } from "@/shared/phone";
import { formatMinute } from "@/shared/time";
import { TRADE_LABELS } from "@/shared/trades";
import { Timeline } from "@/components/orders/Timeline";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}

interface AddressSnapshot {
  contactName: string;
  contactPhone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
}

const EVENT_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
};

/**
 * Booking detail.
 *
 * Serves both parties: the customer sees the worker and their own approval
 * action, the worker sees the customer and the job actions. Which buttons appear
 * comes from the state machine's `availableActions` rather than from a role
 * check written here, so the page can never offer a move the server would reject.
 */
export default async function BookingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { placed } = await searchParams;
  const actor = await requirePageActor(`/bookings/${id}`);

  let booking;
  try {
    booking = await getBooking(id, actor);
  } catch {
    notFound();
  }

  const address = booking.addressSnapshot as unknown as AddressSnapshot;
  const reached = new Set(booking.events.map((event) => event.toStatus));
  const isDead = bookingTab(booking.status) === "cancelled";
  const isWorkerView = booking.viewerRole === "WORKER";
  const deadEvent = [...booking.events].reverse().find((e) => e.toStatus === booking.status);
  const rateLabel =
    booking.rateType === "HOURLY" ? "Hourly" : booking.rateType === "DAILY" ? "Daily" : "Fixed price";

  return (
    <div className="pb-8">
      <PageHeader
        title={booking.bookingNumber}
        subtitle={`${TRADE_LABELS[booking.trade]} · ${rateLabel}`}
        backHref={isWorkerView ? "/worker" : "/bookings"}
        actions={
          <Chip tone={bookingTone(booking.status)} className="hidden sm:inline-flex">
            {BOOKING_STATUS_LABELS[booking.status]}
          </Chip>
        }
      />

      {placed === "1" && (
        <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-(--radius-card) border border-trust-100 bg-trust-50 p-3.5 md:mx-0 md:mt-0 md:mb-4">
          <CheckCircle2 aria-hidden className="size-5 shrink-0 text-trust-600" />
          <div>
            <p className="text-[13px] font-bold text-trust-700">Request sent</p>
            <p className="text-xs text-ink-600">
              {booking.worker.displayName} will confirm shortly.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pt-3 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-6 md:px-0 md:pt-0">
        <div className="flex flex-col gap-4">
          {/* Counterparty */}
          <Card className="flex items-center gap-3 p-4">
            {isWorkerView ? (
              <>
                <span className="flex size-13 shrink-0 items-center justify-center rounded-full bg-ink-100 text-base font-bold text-ink-500">
                  {(booking.user.name ?? "C").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-ink-900">
                    {booking.user.name ?? "Customer"}
                  </p>
                  <p className="text-xs text-ink-500">Customer</p>
                </div>
                <a
                  href={`tel:${booking.user.phoneE164}`}
                  aria-label={`Call ${booking.user.name ?? "customer"}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
                >
                  <Phone aria-hidden className="size-4" />
                </a>
              </>
            ) : (
              <>
                <Link href={`/labour/${booking.worker.id}`} aria-label={booking.worker.displayName}>
                  <WorkerAvatar photoUrl={booking.worker.photoUrl} size={52} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/labour/${booking.worker.id}`}
                    className="block truncate text-[15px] font-bold text-ink-900 hover:text-brand-700"
                  >
                    {booking.worker.displayName}
                  </Link>
                  <p className="text-xs text-ink-500">{TRADE_LABELS[booking.trade]}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                    <RatingStars rating={booking.worker.ratingAvg} />
                    <span>{booking.worker.completedJobs} jobs</span>
                  </p>
                </div>
                {/* The worker's number is released once the job is confirmed. */}
                {["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(
                  booking.status,
                ) && (
                  <a
                    href={`tel:${booking.worker.user.phoneE164}`}
                    aria-label="Call worker"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
                  >
                    <Phone aria-hidden className="size-4" />
                  </a>
                )}
              </>
            )}
          </Card>

          {/* Schedule */}
          <Card className="grid grid-cols-2 gap-3 p-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <CalendarDays aria-hidden className="size-3.5" />
                Date
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink-900">
                {new Date(booking.scheduledDate).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Clock aria-hidden className="size-3.5" />
                Time
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink-900">
                {formatMinute(booking.startMinute)} –{" "}
                {formatMinute(booking.startMinute + booking.durationMinutes)}
              </p>
              <p className="text-xs text-ink-400">{booking.durationMinutes / 60} hours</p>
            </div>
          </Card>

          {/* Status timeline */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-ink-900">Job status</h2>
              <Chip tone={bookingTone(booking.status)}>
                {BOOKING_STATUS_LABELS[booking.status]}
              </Chip>
            </div>

            <Timeline
              items={[
                ...BOOKING_TIMELINE.filter(
                  // A dead booking stops the line at the last step it reached.
                  (status) => !isDead || reached.has(status),
                ).map((status) => {
                  const event = booking.events.find((e) => e.toStatus === status);
                  return {
                    key: status,
                    label: BOOKING_STATUS_LABELS[status],
                    state: reached.has(status) ? ("done" as const) : ("pending" as const),
                    current: booking.status === status,
                    detail: event
                      ? new Date(event.createdAt).toLocaleString("en-IN", EVENT_TIME)
                      : null,
                  };
                }),
                ...(isDead
                  ? [
                      {
                        key: booking.status,
                        label: BOOKING_STATUS_LABELS[booking.status],
                        state: "failed" as const,
                        current: true,
                        detail: deadEvent
                          ? new Date(deadEvent.createdAt).toLocaleString("en-IN", EVENT_TIME)
                          : null,
                      },
                    ]
                  : []),
              ]}
            />

            {isDead && (booking.cancelReason || booking.cancellationFeePaise > 0) && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-800">
                {booking.cancelReason && <>Reason: {booking.cancelReason}. </>}
                {booking.cancellationFeePaise > 0 &&
                  `A cancellation fee of ${formatINR(booking.cancellationFeePaise)} applies.`}
              </p>
            )}
          </Card>

          {/* Work description */}
          <Card className="p-4">
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-ink-900">
              <NotebookPen aria-hidden className="size-4 text-ink-400" />
              Work requested
            </h2>
            <p className="text-sm leading-relaxed text-ink-600">{booking.workDescription}</p>
          </Card>

          {/* Site address */}
          <Card className="p-4">
            <h2 className="mb-1.5 flex items-center gap-2 text-[15px] font-bold text-ink-900">
              <MapPin aria-hidden className="size-4 text-ink-400" />
              Site address
            </h2>
            <p className="text-sm font-semibold text-ink-900">{address.contactName}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              {address.landmark ? `, ${address.landmark}` : ""}, {address.city},{" "}
              {address.state} {address.pincode}
            </p>
            {address.contactPhone && (
              <p className="mt-0.5 text-xs text-ink-400">{formatPhone(address.contactPhone)}</p>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4 md:sticky md:top-24">
          {/* Charges */}
          <Card className="p-4">
            <h2 className="mb-1 text-[15px] font-bold text-ink-900">Charges</h2>
            <MoneyRow
              label={`Labour (${booking.quantity} ${booking.rateType === "HOURLY" ? "hours" : booking.rateType === "DAILY" ? "days" : "job"} × ${formatINR(booking.rateAmountPaise)})`}
              paise={booking.labourSubtotalPaise}
            />
            {booking.extrasPaise > 0 && <MoneyRow label="Extras" paise={booking.extrasPaise} />}
            <MoneyRow label="Platform fee" paise={booking.platformFeePaise} />
            {booking.discountPaise > 0 && (
              <MoneyRow label="Discount" paise={-booking.discountPaise} />
            )}
            <div className="mt-1 border-t border-ink-100 pt-1">
              <MoneyRow
                label={booking.finalTotalPaise != null ? "Final total" : "Estimated total"}
                paise={booking.finalTotalPaise ?? booking.estimatedTotalPaise}
                emphasis
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-400">
              Materials are not included. Pay the worker directly on completion.
            </p>
          </Card>

          {booking.availableActions.length > 0 && (
            <BookingActions
              bookingId={booking.id}
              actions={booking.availableActions.map((action) => ({
                to: action.to,
                label: action.label,
              }))}
            />
          )}

          <Link
            href={`/account/support?bookingId=${booking.id}`}
            className="text-center text-[13px] font-semibold text-brand-700 hover:text-brand-800"
          >
            Report a problem with this booking
          </Link>
        </aside>
      </div>
    </div>
  );
}

