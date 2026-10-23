import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getAdminBooking } from "@/server/services/admin/bookings-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel } from "@/components/admin/Stat";
import { ActionButton } from "@/components/admin/ActionButton";
import { EventHistory } from "@/components/admin/orders/EventHistory";
import { RefundsTable } from "@/components/admin/orders/RefundsTable";
import { BookingStatusChip, PaymentStatusChip } from "@/components/admin/orders/StatusChips";
import { Chip } from "@/components/ui/Chip";
import { Money, MoneyRow } from "@/components/ui/Money";
import { formatDateTime, humanize } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";
import { formatMinute } from "@/shared/time";
import { TRADE_LABELS } from "@/shared/trades";

export const metadata = { title: "Booking" };

interface AddressSnapshot {
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  pincode?: string;
}

/** Booking dates are Postgres `date` columns (UTC midnight). */
const day = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const RATE_UNIT = { HOURLY: "hour", DAILY: "day", FIXED: "job" } as const;

/** Staff-facing wording for the two dispute outcomes. */
const RESOLVE_COPY: Record<string, { label: string; message: string }> = {
  APPROVED: {
    label: "Resolve for worker",
    message: "The work is approved as done: the worker is credited with the job and the platform commission is recorded.",
  },
  CANCELLED_BY_CUSTOMER: {
    label: "Resolve for customer",
    message: "The booking is cancelled in the customer's favour. If they paid online you can refund them next.",
  },
};

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = (await getPageActor())!;

  let booking: Awaited<ReturnType<typeof getAdminBooking>>;
  try {
    booking = await getAdminBooking(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const address = booking.addressSnapshot as unknown as AddressSnapshot;
  const disputed = booking.status === "DISPUTED";
  const payment = booking.payment;
  const canRefund = booking.canWrite && booking.refundablePaise > 0;

  const actionButton = (t: (typeof booking.availableActions)[number], resolve: boolean) => {
    const copy = resolve ? RESOLVE_COPY[t.to] : undefined;
    const label = copy?.label ?? t.label;
    const destructive = !resolve && ["REJECTED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_WORKER", "NO_SHOW"].includes(t.to);
    return (
      <ActionButton
        key={t.to}
        label={label}
        path={`/admin/bookings/${booking.id}/transition`}
        body={{ to: t.to }}
        variant={resolve ? (t.to === "APPROVED" ? "outline" : "primary") : destructive ? "danger" : "outline"}
        size={resolve ? "md" : "sm"}
        confirm={{
          title: `${label} — ${booking.bookingNumber}`,
          message: copy?.message ?? `Moves the booking from ${humanize(booking.status)} to ${humanize(t.to)}. Both parties are notified.`,
          reasonField: "reason",
          reasonLabel: resolve ? "Resolution note" : t.reasonRequired ? "Reason" : "Note (optional)",
          reasonRequired: t.reasonRequired,
          confirmLabel: label,
        }}
      />
    );
  };

  const otherActions = disputed ? [] : booking.availableActions.map((t) => actionButton(t, false));

  return (
    <>
      <AdminPageHeader
        title={`Booking ${booking.bookingNumber}`}
        description={`${TRADE_LABELS[booking.trade]} · booked ${formatDateTime(booking.createdAt)}`}
        back={{ href: "/admin/bookings", label: "Bookings" }}
        actions={<BookingStatusChip status={booking.status} />}
      />

      {!booking.canWrite && (
        <p className="mb-6 rounded-xl bg-ink-100 px-4 py-2.5 text-sm text-ink-600">
          Read-only: support staff can view bookings; an administrator resolves disputes and issues refunds.
        </p>
      )}

      {booking.canWrite && otherActions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-ink-100 bg-white p-3">
          <span className="mr-1 text-xs font-bold tracking-wide text-ink-400 uppercase">Actions</span>
          {otherActions}
        </div>
      )}

      {(disputed || booking.resolution) && (
        <Panel
          title={disputed ? "Open dispute" : "Dispute"}
          className={disputed ? "mb-6 border-brand-200" : "mb-6"}
          actions={
            booking.resolution ? (
              <Chip tone="neutral">Resolved for {booking.resolution.favour}</Chip>
            ) : (
              <Chip tone="warning">Waiting on admin</Chip>
            )
          }
        >
          <p className="text-xs font-bold tracking-wide text-ink-400 uppercase">
            Customer&apos;s complaint{booking.disputedAt ? ` · ${formatDateTime(booking.disputedAt)}` : ""}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-800">{booking.disputeReason ?? "No reason was given."}</p>

          {booking.resolution && (
            <>
              <p className="mt-4 text-xs font-bold tracking-wide text-ink-400 uppercase">
                Resolution · {formatDateTime(booking.resolution.at)}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-800">{booking.resolution.note ?? "—"}</p>
            </>
          )}

          {disputed && booking.canWrite && (
            <div className="mt-5 flex flex-wrap gap-3 border-t border-ink-100 pt-4">
              {booking.availableActions.map((t) => actionButton(t, true))}
            </div>
          )}
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Job">
            <DetailList
              items={[
                { label: "Trade", value: TRADE_LABELS[booking.trade] },
                {
                  label: "Scheduled",
                  value: `${day(booking.scheduledDate)}, ${formatMinute(booking.startMinute)} – ${formatMinute(
                    booking.startMinute + booking.durationMinutes,
                  )}`,
                },
                { label: "Work", value: <span className="font-normal whitespace-pre-line">{booking.workDescription}</span> },
                {
                  label: "Site",
                  value: (
                    <span className="font-normal">
                      {[address.line1, address.line2, address.landmark, address.city].filter(Boolean).join(", ")}
                      {address.pincode ? ` – ${address.pincode}` : ""}
                    </span>
                  ),
                },
                { label: "Checked in", value: formatDateTime(booking.checkedInAt) },
                { label: "Completed", value: formatDateTime(booking.completedAt) },
                ...(booking.cancelledAt
                  ? [
                      { label: "Cancelled", value: formatDateTime(booking.cancelledAt) },
                      { label: "Cancel reason", value: booking.cancelReason ?? "—" },
                    ]
                  : []),
              ]}
            />
          </Panel>

          <Panel title="Status history">
            <EventHistory events={booking.events} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Customer & worker">
            <DetailList
              items={[
                { label: "Customer", value: booking.user.name ?? "—" },
                { label: "Phone", value: formatPhone(booking.user.phoneE164) },
                { label: "Worker", value: booking.worker.displayName },
                { label: "Worker phone", value: formatPhone(booking.worker.user.phoneE164) },
                {
                  label: "Record",
                  value: `${booking.worker.completedJobs} jobs · ${booking.worker.ratingAvg.toFixed(1)}★ · ${humanize(booking.worker.idVerificationStatus)}`,
                },
              ]}
            />
          </Panel>

          <Panel title="Pricing">
            <MoneyRow
              label={`Labour (${booking.quantity} ${RATE_UNIT[booking.rateType]}${booking.quantity === 1 ? "" : "s"})`}
              paise={booking.labourSubtotalPaise}
            />
            {booking.lines
              .filter((l) => l.kind !== "LABOUR")
              .map((l) => (
                <MoneyRow key={l.id} label={l.description} paise={l.totalAmountPaise} />
              ))}
            {booking.extrasPaise > 0 && booking.lines.every((l) => l.kind === "LABOUR") && <MoneyRow label="Extras" paise={booking.extrasPaise} />}
            {booking.platformFeePaise > 0 && <MoneyRow label="Platform fee" paise={booking.platformFeePaise} />}
            {booking.discountPaise > 0 && <MoneyRow label="Discount" paise={-booking.discountPaise} />}
            <MoneyRow label="Estimated total" paise={booking.estimatedTotalPaise} emphasis />
            {booking.finalTotalPaise != null && <MoneyRow label="Final total" paise={booking.finalTotalPaise} emphasis />}
            {booking.cancellationFeePaise > 0 && <MoneyRow label="Cancellation fee" paise={booking.cancellationFeePaise} />}
            <p className="mt-2 text-xs text-ink-500">
              Rate <Money paise={booking.rateAmountPaise} /> per {RATE_UNIT[booking.rateType]}.
            </p>
          </Panel>

          <Panel
            title="Payment & refunds"
            actions={
              canRefund ? (
                <ActionButton
                  label="Refund"
                  path={`/admin/bookings/${booking.id}/refund`}
                  variant={booking.resolution?.favour === "customer" ? "primary" : "outline"}
                  confirm={{
                    title: `Refund ${booking.bookingNumber}`,
                    message: "Money goes back to the customer's original payment method. Partial refunds are allowed.",
                    amountField: {
                      name: "amountPaise",
                      label: "Amount (₹)",
                      defaultRupees: booking.refundablePaise / 100,
                      maxRupees: booking.refundablePaise / 100,
                    },
                    reasonField: "reason",
                    reasonRequired: true,
                    confirmLabel: "Issue refund",
                  }}
                />
              ) : undefined
            }
          >
            {payment ? (
              <>
                <DetailList
                  items={[
                    { label: "Method", value: humanize(payment.method) },
                    { label: "Provider", value: payment.provider },
                    { label: "Status", value: <PaymentStatusChip status={payment.status} /> },
                    { label: "Amount", value: <Money paise={payment.amountPaise} showPaise /> },
                    { label: "Refundable", value: <Money paise={booking.refundablePaise} showPaise /> },
                  ]}
                />
                <h3 className="mt-5 mb-2 text-sm font-bold text-ink-900">Refunds</h3>
                <RefundsTable refunds={booking.refunds} canWrite={booking.canWrite} />
              </>
            ) : (
              <p className="text-sm text-ink-500">
                No online payment on this booking — labour is currently settled directly between customer and worker, so there
                is nothing to refund here.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
