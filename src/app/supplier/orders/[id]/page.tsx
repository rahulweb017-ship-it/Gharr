import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { requirePageVendor } from "@/server/auth/supplier-page";
import { getVendorOrder } from "@/server/services/vendor/orders.service";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { isAppError } from "@/server/http/errors";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel } from "@/components/admin/Stat";
import { Chip } from "@/components/ui/Chip";
import { OrderActions } from "@/components/shop/OrderActions";
import { formatDateTime, formatDay } from "@/lib/admin-format";
import { formatINR } from "@/shared/money";
import { formatPhone } from "@/shared/phone";
import { formatQuantity, type Unit } from "@/shared/units";

export const metadata = { title: "Order" };

interface AddressSnapshot {
  contactName: string;
  contactPhone?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state?: string;
  pincode: string;
}

function minutes(m: number | null) {
  if (m == null) return "";
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export default async function SupplierOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requirePageVendor(`/supplier/orders/${id}`);
  const order = await getVendorOrder(actor, id).catch((error) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });
  const address = order.deliveryAddress as unknown as AddressSnapshot;

  return (
    <>
      <AdminPageHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        back={{ href: "/supplier/orders", label: "Orders" }}
        actions={<Chip tone="info">{ORDER_STATUS_LABELS[order.status]}</Chip>}
      />

      {order.availableActions.length > 0 && (
        <Panel title="Next step" className="mb-6">
          <OrderActions orderId={order.id} actions={order.availableActions.map((a) => ({ to: a.to, label: a.label }))} />
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Items to pack">
          <ul className="divide-y divide-ink-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-ink-900">{item.productName}</p>
                  <p className="text-ink-500">
                    {item.variantLabel} · {formatQuantity(item.quantity, item.unit as Unit)} × {formatINR(item.unitPricePaise)}
                  </p>
                </div>
                <span className="font-semibold tabular">{formatINR(item.lineTotalPaise)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-ink-100 pt-3">
            <DetailList
              items={[
                { label: "Items", value: formatINR(order.itemsSubtotalPaise) },
                ...(order.discountPaise ? [{ label: "Discount", value: `− ${formatINR(order.discountPaise)}` }] : []),
                { label: "Delivery", value: formatINR(order.deliveryFeePaise) },
                { label: "GST", value: formatINR(order.taxPaise) },
                { label: "Total", value: <strong>{formatINR(order.totalPaise)}</strong> },
                { label: "Payment", value: order.paymentMethod === "COD" ? "Collect cash on delivery" : `Prepaid (${order.payment?.status.toLowerCase() ?? "pending"})` },
              ]}
            />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Deliver to">
            <p className="text-sm font-semibold text-ink-900">{address.contactName}</p>
            <p className="mt-1 text-sm text-ink-600">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              {address.landmark ? ` (near ${address.landmark})` : ""}
              <br />
              {address.city} {address.pincode}
            </p>
            {order.deliverySlotDate && (
              <p className="mt-2 text-sm text-ink-600">
                Slot: {formatDay(order.deliverySlotDate)} {minutes(order.deliverySlotStartMinute)}–{minutes(order.deliverySlotEndMinute)}
              </p>
            )}
            {order.customerNote && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Note: {order.customerNote}</p>}
            <a
              href={`tel:${address.contactPhone ?? order.user.phoneE164}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"
            >
              <Phone aria-hidden className="size-4" />
              Call {formatPhone(address.contactPhone ?? order.user.phoneE164)}
            </a>
          </Panel>

          <Panel title="History">
            <ol className="space-y-2 text-sm">
              {order.events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium text-ink-900">{ORDER_STATUS_LABELS[e.toStatus]}</p>
                  <p className="text-xs text-ink-400">
                    {formatDateTime(e.createdAt)}
                    {e.reason ? ` · ${e.reason}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
