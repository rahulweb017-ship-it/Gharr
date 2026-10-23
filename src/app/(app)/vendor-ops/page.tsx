import Link from "next/link";
import { MapPin, Phone, Store } from "lucide-react";
import { listVendorOrders } from "@/server/services/order.service";
import { requirePageRole } from "@/server/auth/page-session";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { OrderActions } from "@/components/shop/OrderActions";
import { EmptyState } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { formatINR } from "@/shared/money";

export const metadata = { title: "Vendor operations" };
export const dynamic = "force-dynamic";

interface AddressSnapshot {
  contactName: string;
  line1: string;
  city: string;
  pincode: string;
}

/**
 * Vendor fulfilment console.
 *
 * The full vendor module (catalogue, inventory, payouts) is out of scope for
 * this phase, but nothing can move an order from "confirmed" to "delivered"
 * without an actor. This is the fulfilment slice only — enough to demonstrate
 * order tracking end to end, and the specification for the full console later.
 */
export default async function VendorOpsPage() {
  const actor = await requirePageRole(["VENDOR", "ADMIN"], "/vendor-ops");
  const orders = await listVendorOrders(actor);

  const open = orders.filter(
    (order) => !["DELIVERED", "CANCELLED", "REFUNDED", "RETURNED"].includes(order.status),
  );
  const closed = orders.filter((order) =>
    ["DELIVERED", "CANCELLED", "REFUNDED", "RETURNED"].includes(order.status),
  );

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-ink-900 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-white">
          <Store aria-hidden className="size-5 text-brand-400" />
          Vendor operations
        </h1>
        <p className="text-[11px] text-ink-400">
          {open.length} open · {closed.length} closed
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Store aria-hidden className="size-7" />}
          title="No orders"
          description="Customer orders for your store will appear here."
        />
      ) : (
        <div className="space-y-6 p-4">
          {[
            { title: "Needs action", items: open },
            { title: "Completed", items: closed },
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
                  {group.items.map((order) => {
                    const address = order.deliveryAddress as unknown as AddressSnapshot;

                    return (
                      <li
                        key={order.id}
                        className="rounded-(--radius-card) border border-ink-100 bg-white p-3.5 shadow-(--shadow-card)"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-mono text-[10px] font-semibold text-ink-400"
                            >
                              {order.orderNumber}
                            </Link>
                            <p className="truncate text-[13px] font-bold text-ink-900">
                              {order.vendor.businessName}
                            </p>
                            <p className="text-[11px] text-ink-500">
                              {order.itemCount}{" "}
                              {order.itemCount === 1 ? "item" : "items"} ·{" "}
                              {order.paymentMethod === "COD"
                                ? "Cash on delivery"
                                : "Prepaid"}
                            </p>
                          </div>
                          <Chip
                            tone={
                              order.status === "DELIVERED"
                                ? "brand"
                                : order.status === "CANCELLED"
                                  ? "danger"
                                  : "info"
                            }
                          >
                            {ORDER_STATUS_LABELS[order.status]}
                          </Chip>
                        </div>

                        <p className="mt-2 flex items-start gap-1 text-[11px] text-ink-500">
                          <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                          {address.contactName} — {address.line1}, {address.city}{" "}
                          {address.pincode}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
                          <a
                            href={`tel:${order.user.phoneE164}`}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700"
                          >
                            <Phone aria-hidden className="size-3" />
                            {order.user.name ?? "Customer"}
                          </a>
                          <span className="text-[15px] font-bold text-ink-900 tabular">
                            {formatINR(order.totalPaise)}
                          </span>
                        </div>

                        {order.availableActions.length > 0 && (
                          <div className="mt-3">
                            <OrderActions
                              orderId={order.id}
                              actions={order.availableActions.map((action) => ({
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
