import Link from "next/link";
import { CalendarClock, HardHat, MapPin, Phone } from "lucide-react";
import { listWorkerBookings } from "@/server/services/booking.service";
import { requirePageActor } from "@/server/auth/page-session";
import { BOOKING_STATUS_LABELS } from "@/server/services/booking-state";
import { BookingActions } from "@/components/labour/BookingActions";
import { EmptyState } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { formatINR } from "@/shared/money";
import { formatMinute } from "@/shared/time";
import { TRADE_LABELS } from "@/shared/trades";

export const metadata = { title: "Worker console" };
export const dynamic = "force-dynamic";

interface AddressSnapshot {
  contactName: string;
  line1: string;
  city: string;
  pincode: string;
}

/**
 * Worker job console.
 *
 * The blueprint puts the worker app in a later phase, but the booking lifecycle
 * has six worker-driven transitions — without somewhere to perform them, a
 * booking can never progress past "requested" and milestone 2 cannot be
 * demonstrated. This is the minimum surface that makes the flow real, and it
 * doubles as the specification for the eventual React Native worker app.
 */
export default async function WorkerConsolePage() {
  const actor = await requirePageActor("/worker");
  const bookings = await listWorkerBookings(actor);

  const pending = bookings.filter((b) => b.status === "REQUESTED");
  const active = bookings.filter(
    (b) => !["REQUESTED", "APPROVED", "PAID_OUT", "REJECTED"].includes(b.status) &&
      !b.status.startsWith("CANCELLED"),
  );
  const done = bookings.filter((b) =>
    ["APPROVED", "PAID_OUT"].includes(b.status),
  );

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-ink-900 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-white">
          <HardHat aria-hidden className="size-5 text-brand-400" />
          Worker console
        </h1>
        <p className="text-[11px] text-ink-400">
          {pending.length} new {pending.length === 1 ? "request" : "requests"} ·{" "}
          {active.length} active
        </p>
      </header>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<HardHat aria-hidden className="size-7" />}
          title="No jobs yet"
          description="Job requests from customers will appear here for you to accept."
        />
      ) : (
        <div className="space-y-6 p-4">
          {[
            { title: "New requests", items: pending },
            { title: "Active jobs", items: active },
            { title: "Completed", items: done },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.title}>
                <h2 className="mb-2 text-[13px] font-bold text-ink-900">
                  {group.title}
                  <span className="ml-1.5 font-medium text-ink-400">
                    ({group.items.length})
                  </span>
                </h2>

                <ul className="space-y-3">
                  {group.items.map((booking) => {
                    const address = booking.addressSnapshot as unknown as AddressSnapshot;

                    return (
                      <li
                        key={booking.id}
                        className="rounded-(--radius-card) border border-ink-100 bg-white p-3.5 shadow-(--shadow-card)"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/bookings/${booking.id}`}
                              className="font-mono text-[10px] font-semibold text-ink-400"
                            >
                              {booking.bookingNumber}
                            </Link>
                            <p className="text-[14px] font-bold text-ink-900">
                              {TRADE_LABELS[booking.trade]} ·{" "}
                              {booking.durationMinutes / 60}h
                            </p>
                          </div>
                          <Chip
                            tone={booking.status === "REQUESTED" ? "warning" : "info"}
                          >
                            {BOOKING_STATUS_LABELS[booking.status]}
                          </Chip>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-500">
                          <CalendarClock aria-hidden className="size-3" />
                          {new Date(booking.scheduledDate).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          })}
                          {" · "}
                          {formatMinute(booking.startMinute)}
                        </p>

                        <p className="mt-1 flex items-start gap-1 text-[11px] text-ink-500">
                          <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                          {address.line1}, {address.city} {address.pincode}
                        </p>

                        <p className="mt-2 line-clamp-2 rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-600">
                          {booking.workDescription}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
                          <a
                            href={`tel:${booking.user.phoneE164}`}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700"
                          >
                            <Phone aria-hidden className="size-3" />
                            {booking.user.name ?? "Customer"}
                          </a>
                          <span className="text-[15px] font-bold text-ink-900 tabular">
                            {formatINR(booking.estimatedTotalPaise)}
                          </span>
                        </div>

                        {booking.availableActions.length > 0 && (
                          <div className="mt-3">
                            <BookingActions
                              bookingId={booking.id}
                              actions={booking.availableActions.map((action) => ({
                                to: action.to,
                                label: action.label,
                              }))}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
