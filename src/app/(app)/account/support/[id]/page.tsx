import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { Thread } from "@/components/support/Thread";
import { ReplyForm } from "@/components/support/ReplyForm";
import { TICKET_STATUS_LABELS, ticketTone } from "@/components/support/ticket-status";
import { requirePageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getMyTicket } from "@/server/services/support.service";
import { TICKET_CATEGORY_LABELS, type TicketCategory } from "@/shared/contracts/support";

export const metadata = { title: "Support ticket" };
export const dynamic = "force-dynamic";

/** One complaint thread. Staff replies are signed "Gharr Support". */
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const actor = await requirePageActor(`/account/support/${id}`);

  let ticket: Awaited<ReturnType<typeof getMyTicket>>;
  try {
    ticket = await getMyTicket(actor.userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="pb-6 md:mx-auto md:max-w-2xl">
      <PageHeader title="Support ticket" backHref="/account/support" />

      <div className="flex flex-col gap-4 px-4 pt-3 md:px-0 md:pt-0">
        {isNew === "1" && (
          <div className="flex items-center gap-2.5 rounded-(--radius-card) border border-trust-100 bg-trust-50 p-3.5">
            <CheckCircle2 aria-hidden className="size-5 shrink-0 text-trust-600" />
            <p className="text-[13px] text-ink-700">
              <span className="font-bold text-trust-700">Complaint received.</span> We&apos;ll reply here.
            </p>
          </div>
        )}

        <div className="rounded-(--radius-card) border border-ink-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-bold text-ink-900">{ticket.subject}</h2>
            <Chip tone={ticketTone(ticket.status)}>{TICKET_STATUS_LABELS[ticket.status]}</Chip>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {TICKET_CATEGORY_LABELS[ticket.category as TicketCategory] ?? ticket.category}
            {ticket.order && (
              <>
                {" · "}
                <Link href={`/orders/${ticket.order.id}`} className="font-semibold text-brand-700 hover:underline">
                  Order #{ticket.order.orderNumber}
                </Link>
              </>
            )}
            {ticket.booking && (
              <>
                {" · "}
                <Link href={`/bookings/${ticket.booking.id}`} className="font-semibold text-brand-700 hover:underline">
                  Booking #{ticket.booking.bookingNumber}
                </Link>
              </>
            )}
          </p>

          <div className="mt-4">
            <Thread messages={ticket.thread} />
          </div>
        </div>

        <div className="rounded-(--radius-card) border border-ink-100 bg-white p-4">
          {ticket.status === "CLOSED" ? (
            <p className="text-[13px] text-ink-500">
              This ticket is closed.{" "}
              <Link href="/account/support" className="font-semibold text-brand-700 hover:underline">
                Raise a new complaint
              </Link>{" "}
              if you still need help.
            </p>
          ) : (
            <ReplyForm
              path={`/support/tickets/${ticket.id}/messages`}
              placeholder="Add more details or reply to support…"
              hint={ticket.status === "RESOLVED" ? "Replying reopens this ticket." : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
