import Link from "next/link";
import { ChevronRight, LifeBuoy, Mail, MessageSquareText, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { ComplaintForm } from "@/components/support/ComplaintForm";
import { TICKET_STATUS_LABELS, ticketTone } from "@/components/support/ticket-status";
import { requirePageActor } from "@/server/auth/page-session";
import { listLinkableRecords, listMyTickets } from "@/server/services/support.service";
import { TICKET_CATEGORY_LABELS, type TicketCategory } from "@/shared/contracts/support";

export const metadata = { title: "Help and support" };
export const dynamic = "force-dynamic";

const day = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const slot = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const trade = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");

/**
 * Help & support: raise a complaint (optionally about an order or booking —
 * the order and booking pages link here with the id pre-filled), follow your
 * tickets, or reach us directly.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; bookingId?: string }>;
}) {
  const { orderId, bookingId } = await searchParams;
  const actor = await requirePageActor("/account/support");
  const [tickets, linkable] = await Promise.all([listMyTickets(actor.userId), listLinkableRecords(actor.userId)]);

  return (
    <div className="pb-6 md:mx-auto md:max-w-2xl">
      <PageHeader title="Help & support" backHref="/account" />

      <div className="flex flex-col gap-4 px-4 pt-3 md:px-0 md:pt-0">
        <section aria-labelledby="raise-heading" className="rounded-(--radius-card) border border-ink-100 bg-white p-4">
          <h2 id="raise-heading" className="text-[15px] font-bold text-ink-900">
            Raise a complaint
          </h2>
          <p className="mt-1 mb-4 text-[13px] leading-relaxed text-ink-500">
            Tell us what went wrong. Our team replies here, usually within one working day.
          </p>
          <ComplaintForm
            initialOrderId={orderId}
            initialBookingId={bookingId}
            orders={linkable.orders.map((o) => ({ value: o.id, label: `Order #${o.orderNumber} · ${day(o.placedAt)}` }))}
            bookings={linkable.bookings.map((b) => ({
              value: b.id,
              label: `${trade(b.trade)} #${b.bookingNumber} · ${slot(b.scheduledDate)}`,
            }))}
          />
        </section>

        <section aria-labelledby="tickets-heading">
          <h2 id="tickets-heading" className="mb-2 text-[15px] font-bold text-ink-900">
            Your tickets
          </h2>
          {tickets.length === 0 ? (
            <p className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white px-4 py-6 text-center text-[13px] text-ink-500">
              No complaints yet. Anything you raise shows up here.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/account/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
                    <MessageSquareText aria-hidden className="size-5 shrink-0 text-ink-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink-900">{t.subject}</p>
                      <p className="text-xs text-ink-500">
                        {TICKET_CATEGORY_LABELS[t.category as TicketCategory] ?? t.category} · {day(t.createdAt)}
                        {t.hasStaffReply && " · Support replied"}
                      </p>
                    </div>
                    <Chip tone={ticketTone(t.status)}>{TICKET_STATUS_LABELS[t.status]}</Chip>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="rounded-(--radius-card) border border-ink-100 bg-white p-4">
          <LifeBuoy aria-hidden className="size-7 text-brand-600" />
          <h2 className="mt-2 text-[15px] font-bold text-ink-900">
            We&apos;re here to help
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            Questions about an order, a delivery or a worker booking? Reach us
            between 9 AM and 8 PM, seven days a week.
          </p>

          <div className="mt-4 space-y-2">
            <a
              href="tel:+914000000000"
              className="flex items-center gap-3 rounded-xl border border-ink-100 px-3.5 py-3"
            >
              <Phone aria-hidden className="size-[18px] text-ink-400" />
              <span className="text-[14px] font-semibold text-ink-800">
                +91 40 0000 0000
              </span>
            </a>
            <a
              href="mailto:support@gharr.si"
              className="flex items-center gap-3 rounded-xl border border-ink-100 px-3.5 py-3"
            >
              <Mail aria-hidden className="size-[18px] text-ink-400" />
              <span className="text-[14px] font-semibold text-ink-800">
                support@gharr.si
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
