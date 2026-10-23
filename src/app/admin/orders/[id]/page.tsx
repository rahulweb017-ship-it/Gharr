import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getAdminOrder } from "@/server/services/admin/orders-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel } from "@/components/admin/Stat";
import { ActionButton } from "@/components/admin/ActionButton";
import { EventHistory } from "@/components/admin/orders/EventHistory";
import { RefundsTable } from "@/components/admin/orders/RefundsTable";
import { OrderStatusChip, PaymentStatusChip } from "@/components/admin/orders/StatusChips";
import { Money, MoneyRow } from "@/components/ui/Money";
import { formatDateTime, humanize } from "@/lib/admin-format";
import { formatINR } from "@/shared/money";
import { formatPhone } from "@/shared/phone";
import { formatMinute } from "@/shared/time";
import { formatQuantity, type Unit } from "@/shared/units";

export const metadata = { title: "Order" };

interface AddressSnapshot {
  contactName?: string;
  contactPhone?: string;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
}

/** Slot dates are Postgres `date` columns (UTC midnight). */
const slotDay = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = (await getPageActor())!;

  let order: Awaited<ReturnType<typeof getAdminOrder>>;
  try {
    order = await getAdminOrder(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const address = order.deliveryAddress as unknown as AddressSnapshot;
  const payment = order.payment;
  const prepaidCaptured = !!payment && ["CAPTURED", "PARTIALLY_REFUNDED"].includes(payment.status);
  const canRefund = order.canWrite && prepaidCaptured && !!payment?.refundSupported && order.refundablePaise > 0;

  const actions = order.availableActions.map((t) => {
    const destructive = t.to === "CANCELLED" || t.to === "DELIVERY_FAILED";
    const autoRefund =
      (t.to === "CANCELLED" || t.to === "REFUNDED") && prepaidCaptured && payment?.refundSupported && order.refunds.length === 0;
    return (
      <ActionButton
        key={t.to}
        label={t.label}
        path={`/admin/orders/${order.id}/transition`}
        body={{ to: t.to }}
        variant={destructive ? "danger" : "outline"}
        confirm={{
          title: `${t.label} — ${order.orderNumber}`,
          message: [
            `Moves the order from ${humanize(order.status)} to ${humanize(t.to)}. The customer is notified.`,
            t.to === "CANCELLED" ? "Reserved stock goes back to the vendor's inventory." : "",
            autoRefund ? `The prepaid ${formatINR(order.totalPaise)} is refunded to the customer automatically.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          reasonField: "reason",
          reasonLabel: t.reasonRequired ? "Reason" : "Note (optional)",
          reasonRequired: t.reasonRequired,
          confirmLabel: t.label,
        }}
      />
    );
  });

  return (
    <>
      <AdminPageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={<OrderStatusChip status={order.status} />}
      />

      {order.canWrite ? (
        actions.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-ink-100 bg-white p-3">
            <span className="mr-1 text-xs font-bold tracking-wide text-ink-400 uppercase">Actions</span>
            {actions}
          </div>
        )
      ) : (
        <p className="mb-6 rounded-xl bg-ink-100 px-4 py-2.5 text-sm text-ink-600">
          Read-only: support staff can view orders; an administrator makes changes and refunds.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Items">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="border-b border-ink-100 text-xs font-bold tracking-wide text-ink-400 uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-2 text-left">Product</th>
                    <th scope="col" className="px-3 py-2 text-right">Qty</th>
                    <th scope="col" className="px-3 py-2 text-right">Unit price</th>
                    <th scope="col" className="px-5 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-2.5">
                        <span className="block font-medium text-ink-900">{item.productName}</span>
                        <span className="text-xs text-ink-500">{item.variantLabel}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{formatQuantity(item.quantity, item.unit as Unit)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Money paise={item.unitPricePaise} />
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold">
                        <Money paise={item.lineTotalPaise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 ml-auto max-w-sm border-t border-ink-100 pt-3">
              <MoneyRow label="Items subtotal" paise={order.itemsSubtotalPaise} />
              {order.discountPaise > 0 && <MoneyRow label="Discount" paise={-order.discountPaise} />}
              <MoneyRow label="Delivery" paise={order.deliveryFeePaise} free={order.deliveryFeePaise === 0} />
              {order.taxPaise > 0 && <MoneyRow label="GST" paise={order.taxPaise} />}
              <MoneyRow label="Order total" paise={order.totalPaise} emphasis />
              {order.commissionPaise > 0 && <MoneyRow label="Platform commission" paise={order.commissionPaise} />}
            </div>
          </Panel>

          <Panel title="Status history">
            <EventHistory events={order.events} />
            {order.cancelReason && (
              <p className="mt-4 text-sm text-ink-600">
                <span className="font-semibold text-ink-900">Cancellation reason:</span> {order.cancelReason}
              </p>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Customer & vendor">
            <DetailList
              items={[
                { label: "Customer", value: order.user.name ?? "—" },
                { label: "Phone", value: formatPhone(order.user.phoneE164) },
                { label: "Vendor", value: order.vendor.businessName },
                { label: "Vendor phone", value: formatPhone(order.vendor.phoneE164) },
              ]}
            />
          </Panel>

          <Panel title="Delivery">
            <DetailList
              items={[
                { label: "Mode", value: humanize(order.deliveryMode) },
                {
                  label: "Slot",
                  value: order.deliverySlotDate
                    ? `${slotDay(order.deliverySlotDate)}${
                        order.deliverySlotStartMinute != null && order.deliverySlotEndMinute != null
                          ? `, ${formatMinute(order.deliverySlotStartMinute)} – ${formatMinute(order.deliverySlotEndMinute)}`
                          : ""
                      }`
                    : "Standard delivery",
                },
                {
                  label: "Address",
                  value: (
                    <span className="block">
                      {address.contactName && <span className="block font-semibold">{address.contactName}</span>}
                      {address.contactPhone && <span className="block text-ink-600">{formatPhone(address.contactPhone)}</span>}
                      <span className="block font-normal text-ink-700">
                        {[address.line1, address.line2, address.landmark, address.city].filter(Boolean).join(", ")}
                        {address.pincode ? ` – ${address.pincode}` : ""}
                      </span>
                    </span>
                  ),
                },
                { label: "Delivered", value: order.deliveredAt ? formatDateTime(order.deliveredAt) : "—" },
                ...(order.customerNote ? [{ label: "Customer note", value: order.customerNote }] : []),
              ]}
            />
          </Panel>

          <Panel
            title="Payment & refunds"
            actions={
              canRefund ? (
                <ActionButton
                  label="Refund"
                  path={`/admin/orders/${order.id}/refund`}
                  confirm={{
                    title: `Refund ${order.orderNumber}`,
                    message: "Money goes back to the customer's original payment method. Partial refunds are allowed.",
                    amountField: {
                      name: "amountPaise",
                      label: "Amount (₹)",
                      defaultRupees: order.refundablePaise / 100,
                      maxRupees: order.refundablePaise / 100,
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
                    { label: "Method", value: payment.method === "COD" ? "Cash on delivery" : humanize(payment.method) },
                    { label: "Provider", value: payment.provider },
                    { label: "Status", value: <PaymentStatusChip status={payment.status} /> },
                    {
                      label: "Amount",
                      value: (
                        <>
                          <Money paise={payment.amountPaise} showPaise />
                          {payment.sharedWithOrders > 1 && (
                            <span className="ml-1 text-xs font-normal text-ink-500">
                              (covers {payment.sharedWithOrders} orders in this checkout)
                            </span>
                          )}
                        </>
                      ),
                    },
                    { label: "Captured", value: payment.capturedAt ? formatDateTime(payment.capturedAt) : "—" },
                    ...(payment.providerPaymentId
                      ? [{ label: "Provider ref", value: <span className="font-mono text-xs">{payment.providerPaymentId}</span> }]
                      : []),
                    ...(prepaidCaptured ? [{ label: "Refundable", value: <Money paise={order.refundablePaise} showPaise /> }] : []),
                  ]}
                />
                {prepaidCaptured && !payment.refundSupported && (
                  <p className="mt-3 text-xs text-ink-500">Collected as cash — refunds for this order are settled offline.</p>
                )}
                <h3 className="mt-5 mb-2 text-sm font-bold text-ink-900">Refunds</h3>
                <RefundsTable refunds={order.refunds} canWrite={order.canWrite} />
              </>
            ) : (
              <p className="text-sm text-ink-500">No payment is recorded for this order.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
