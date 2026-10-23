import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { requirePageVendor } from "@/server/auth/supplier-page";
import { getDashboard } from "@/server/services/vendor/earnings.service";
import { listVendorOrders } from "@/server/services/order.service";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { OPEN_STATUSES } from "@/server/services/vendor/earnings.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel, StatTile } from "@/components/admin/Stat";
import { Chip } from "@/components/ui/Chip";
import { ButtonLink } from "@/components/ui/Button";
import { VerificationBanner } from "@/components/supplier/VerificationBanner";
import { formatINR } from "@/shared/money";

export const metadata = { title: "Dashboard" };

export default async function SupplierDashboardPage() {
  const { actor, vendor } = await requirePageVendor("/supplier");
  const verified = vendor.status === "VERIFIED" && vendor.isActive;
  const [stats, orders] = await Promise.all([
    getDashboard(actor),
    listVendorOrders(actor, undefined, { statuses: OPEN_STATUSES, take: 5 }),
  ]);

  return (
    <>
      <AdminPageHeader
        title={`Hello, ${vendor.businessName}`}
        description="Your shop on Gharr at a glance."
        actions={verified ? <ButtonLink href="/supplier/listings/new" size="sm">Add a product</ButtonLink> : undefined}
      />
      <VerificationBanner vendor={vendor} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open orders" value={stats.openOrders} href="/supplier/orders" tone={stats.openOrders > 0 ? "attention" : "default"} />
        <StatTile label="Sales this month" value={formatINR(stats.monthSalesPaise)} hint={`${stats.monthDelivered} delivered`} href="/supplier/earnings" />
        <StatTile label="Active listings" value={stats.activeListings} hint={stats.pendingProducts ? `${stats.pendingProducts} awaiting approval` : undefined} href="/supplier/listings" />
        <StatTile label="Low stock" value={stats.lowStock} href="/supplier/listings?lowStock=1" tone={stats.lowStock > 0 ? "attention" : "default"} />
      </div>

      <Panel
        title="Orders to fulfil"
        className="mt-6"
        actions={
          <Link href="/supplier/orders" className="text-sm font-semibold text-brand-700">
            View all
          </Link>
        }
      >
        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">No open orders right now.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {orders.map((o) => {
              const address = o.deliveryAddress as { city?: string; pincode?: string };
              return (
                <li key={o.id}>
                  <Link href={`/supplier/orders/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-ink-50">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-ink-400">{o.orderNumber}</p>
                      <p className="text-sm font-semibold text-ink-900">
                        {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {formatINR(o.totalPaise)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        <MapPin aria-hidden className="size-3" /> {address.city} {address.pincode}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <Chip tone="info">{ORDER_STATUS_LABELS[o.status]}</Chip>
                      <ChevronRight aria-hidden className="size-4 text-ink-300" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
