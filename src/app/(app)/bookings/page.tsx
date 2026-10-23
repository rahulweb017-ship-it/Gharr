import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, HardHat } from "lucide-react";
import { listBookings } from "@/server/services/booking.service";
import { requirePageActor } from "@/server/auth/page-session";
import { BOOKING_STATUS_LABELS } from "@/server/services/booking-state";
import { EmptyState } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { TabLinks } from "@/components/ui/Segmented";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkerAvatar } from "@/components/labour/WorkerCard";
import {
  bookingTab,
  bookingTone,
  type BookingTab,
} from "@/components/labour/booking-status";
import { formatMinute } from "@/shared/time";
import { TRADE_LABELS } from "@/shared/trades";

export const metadata = { title: "Your bookings" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const TABS: Array<{ key: BookingTab; label: string; empty: string }> = [
  { key: "active", label: "Active", empty: "No upcoming or ongoing jobs." },
  { key: "completed", label: "Completed", empty: "Finished jobs will appear here." },
  { key: "cancelled", label: "Cancelled", empty: "Nothing cancelled — good news." },
];

/**
 * Labour tracking: every booking the customer has made, split into
 * Active / Completed / Cancelled.
 */
export default async function BookingsPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const actor = await requirePageActor("/bookings");
  // One page of 50 covers any realistic household; tabs split it on the server.
  const bookings = await listBookings(actor.userId, 1, 50);

  if (bookings.items.length === 0) {
    return (
      <div>
        <PageHeader title="Labour Tracking" subtitle="Your booked workers" />
        <EmptyState
          icon={<HardHat aria-hidden className="size-7" />}
          title="No bookings yet"
          description="Hire a verified mason, electrician, plumber or painter — and track the job here."
          action={<ButtonLink href="/labour">Find a worker</ButtonLink>}
        />
      </div>
    );
  }

  const tab: BookingTab = TABS.some((t) => t.key === tabParam)
    ? (tabParam as BookingTab)
    : "active";
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, bookings.items.filter((b) => bookingTab(b.status) === t.key).length]),
  ) as Record<BookingTab, number>;
  const visible = bookings.items.filter((booking) => bookingTab(booking.status) === tab);

  return (
    <div className="pb-8">
      <PageHeader title="Labour Tracking" subtitle="Your booked workers">
        <TabLinks
          tabs={TABS.map((t) => ({
            label: counts[t.key] > 0 ? `${t.label} (${counts[t.key]})` : t.label,
            href: t.key === "active" ? "/bookings" : `/bookings?tab=${t.key}`,
            active: t.key === tab,
          }))}
        />
      </PageHeader>

      {visible.length === 0 ? (
        <EmptyState
          icon={<HardHat aria-hidden className="size-7" />}
          title={TABS.find((t) => t.key === tab)!.empty}
          action={
            tab === "active" ? (
              <ButtonLink href="/labour" variant="outline">
                Book a worker
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 p-4 md:grid-cols-2 md:p-0 lg:grid-cols-3">
          {visible.map((booking) => {
            const finalKnown = booking.finalTotalPaise != null;
            return (
              <li key={booking.id}>
                <article className="flex h-full flex-col rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)">
                  <div className="flex items-start gap-3">
                    <WorkerAvatar photoUrl={booking.worker.photoUrl} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink-900">
                        {booking.worker.displayName}
                      </p>
                      <p className="text-xs text-ink-500">{TRADE_LABELS[booking.trade]}</p>
                      <p className="font-mono text-[10px] text-ink-400">
                        {booking.bookingNumber}
                      </p>
                    </div>
                    <Chip tone={bookingTone(booking.status)} className="shrink-0">
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </Chip>
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-700">
                    <p className="flex items-center gap-2">
                      <CalendarDays aria-hidden className="size-4 text-ink-400" />
                      {new Date(booking.scheduledDate).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock aria-hidden className="size-4 text-ink-400" />
                      {formatMinute(booking.startMinute)} –{" "}
                      {formatMinute(booking.startMinute + booking.durationMinutes)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-[13px]">
                    <span className="text-ink-600">
                      {finalKnown ? "Final amount" : "Estimate"}
                    </span>
                    <Money
                      paise={booking.finalTotalPaise ?? booking.estimatedTotalPaise}
                      className="font-bold text-ink-900"
                    />
                  </div>

                  <div className="mt-auto pt-3">
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-ink-200 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                    >
                      View details
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
