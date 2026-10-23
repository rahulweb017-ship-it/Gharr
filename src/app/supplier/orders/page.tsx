import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { ChevronRight, ClipboardList, MapPin } from "lucide-react";
import { requirePageVendor } from "@/server/auth/supplier-page";
import { listVendorOrders } from "@/server/services/order.service";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { OPEN_STATUSES } from "@/server/services/vendor/earnings.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { TabLinks } from "@/components/ui/Segmented";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Surface";
import { OrderActions } from "@/components/shop/OrderActions";
import { formatDateTime } from "@/lib/admin-format";
import { formatINR } from "@/shared/money";

export const metadata = { title: "Orders" };

const VIEWS: Record<string, { label: string; statuses?: OrderStatus[] }> = {
  open: { label: "To fulfil", statuses: OPEN_STATUSES },
  delivered: { label: "Delivered", statuses: ["DELIVERED"] },
  cancelled: { label: "Cancelled & returns", statuses: ["CANCELLED", "DELIVERY_FAILED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"] },
  all: { label: "All" },
};

interface AddressSnapshot {
  contactName: string;
  line1: string;
  city: string;
  pincode: string;
}

function statusTone(status: OrderStatus) {
  if (status === "DELIVERED") return "trust" as const;
  if (status === "CANCELLED" || status === "DELIVERY_FAILED") return "danger" as const;
  if (status === "CONFIRMED") return "brand" as const;
  return "info" as const;
}

export default async function SupplierOrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const { actor } = await requirePageVendor("/supplier/orders");
  const { view: rawView, q } = await searchParams;
  const view = rawView && rawView in VIEWS ? rawView : "open";
  const orders = await listVendorOrders(actor, undefined, { statuses: VIEWS[view].statuses, q, take: 100 });

  return (
    <>
      <AdminPageHeader title="Orders" description="Accept, pack and dispatch. Customers see every step on their tracking page." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TabLinks tabs={Object.entries(VIEWS).map(([key, v]) => ({ href: `/supplier/orders?view=${key}`, label: v.label, active: key === view }))} />
        <form role="search" className="flex gap-2">
          <input type="hidden" name="view" value={view} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Order number"
            aria-label="Search by order number"
            className="h-10 w-44 rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList aria-hidden className="size-7" />}
          title={view === "open" ? "Nothing to fulfil" : "No orders here"}
          description="New orders for your listings show up here as soon as they are placed."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {orders.map((order) => {
            const address = order.deliveryAddress as unknown as AddressSnapshot;
            return (
              <li key={order.id} className="rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)">
                <Link href={`/supplier/orders/${order.id}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-ink-400">{order.orderNumber}</p>
                    <p className="text-sm font-bold text-ink-900">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"} · {formatINR(order.totalPaise)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatDateTime(order.placedAt)} · {order.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1">
                    <Chip tone={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Chip>
                    <ChevronRight aria-hidden className="size-4 text-ink-300" />
                  </span>
                </Link>
                <p className="mt-2 flex items-start gap-1 text-xs text-ink-500">
                  <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                  {address.contactName}, {address.line1}, {address.city} {address.pincode}
                </p>
                {order.availableActions.length > 0 && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <OrderActions orderId={order.id} actions={order.availableActions.map((a) => ({ to: a.to, label: a.label }))} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
