import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getTicket } from "@/server/services/support.service";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { BOOKING_STATUS_LABELS } from "@/server/services/booking-state";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel } from "@/components/admin/Stat";
import { TicketControls } from "@/components/admin/tickets/TicketControls";
import { Thread } from "@/components/support/Thread";
import { ReplyForm } from "@/components/support/ReplyForm";
import { Chip } from "@/components/ui/Chip";
import { TICKET_STATUS_LABELS, priorityTone, ticketTone } from "@/components/support/ticket-status";
import { formatDateTime, humanize } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";
import { ticketAge } from "@/shared/contracts/support";

export const dynamic = "force-dynamic";

/** One ticket: the thread with a staff reply box, and triage controls on the side. */
export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPageActor();

  let t: Awaited<ReturnType<typeof getTicket>>;
  try {
    t = await getTicket(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const customer = t.user.name ?? formatPhone(t.user.phoneE164);
  const thread = [
    { id: `${t.id}-opening`, body: t.message, isStaff: false, createdAt: t.createdAt, author: customer },
    ...t.messages.map((m) => ({
      id: m.id,
      body: m.body,
      isStaff: m.isStaff,
      createdAt: m.createdAt,
      author: m.isStaff ? `${m.author.name ?? "Staff"} · Staff` : customer,
    })),
  ];
  const waiting = t.status === "OPEN" || t.status === "IN_PROGRESS";

  return (
    <>
      <AdminPageHeader
        title={t.subject}
        description={`${humanize(t.category)} · raised ${formatDateTime(t.createdAt)}`}
        back={{ href: "/admin/tickets", label: "Tickets" }}
        actions={
          <>
            <Chip tone={priorityTone(t.priority)}>{humanize(t.priority)} priority</Chip>
            <Chip tone={ticketTone(t.status)}>{TICKET_STATUS_LABELS[t.status]}</Chip>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Panel title="Conversation">
          <Thread messages={thread} staffSide="right" />
          <div className="mt-5 border-t border-ink-100 pt-4">
            {t.status === "CLOSED" ? (
              <p className="text-sm text-ink-500">This ticket is closed. Change its status to reply.</p>
            ) : (
              <ReplyForm
                path={`/admin/tickets/${t.id}/messages`}
                placeholder={`Reply to ${customer}…`}
                hint="The customer sees this as “Gharr Support” and gets a notification."
              />
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Triage">
            <TicketControls
              ticketId={t.id}
              status={t.status}
              priority={t.priority}
              assignedToId={t.assignedToId}
              viewerId={t.viewer.id}
              staff={t.staffUsers}
            />
          </Panel>

          <Panel title="Details">
            <DetailList
              items={[
                {
                  label: "Customer",
                  value: (
                    <Link href={`/admin/users/${t.user.id}`} className="text-brand-700 hover:underline">
                      {customer}
                    </Link>
                  ),
                },
                { label: "Phone", value: formatPhone(t.user.phoneE164) },
                ...(t.order
                  ? [{
                      label: "Order",
                      value: (
                        <Link href={`/admin/orders/${t.order.id}`} className="text-brand-700 hover:underline">
                          #{t.order.orderNumber} · {ORDER_STATUS_LABELS[t.order.status]}
                        </Link>
                      ),
                    }]
                  : []),
                ...(t.booking
                  ? [{
                      label: "Booking",
                      value: (
                        <Link href={`/admin/bookings/${t.booking.id}`} className="text-brand-700 hover:underline">
                          #{t.booking.bookingNumber} · {BOOKING_STATUS_LABELS[t.booking.status]}
                        </Link>
                      ),
                    }]
                  : []),
                { label: "Waiting", value: waiting ? ticketAge(t.createdAt, new Date()).label : "—" },
                { label: "Resolved", value: formatDateTime(t.resolvedAt) },
                { label: "Updated", value: formatDateTime(t.updatedAt) },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
