import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { listOrders } from "@/server/services/order.service";
import { requirePageActor } from "@/server/auth/page-session";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { EmptyState } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/layout/PageHeader";
import { orderTone } from "@/components/orders/order-status";
import { formatQuantity, type Unit } from "@/shared/units";

export const metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const actor = await requirePageActor("/orders");
  const orders = await listOrders(actor.userId);

  if (orders.items.length === 0) {
    return (
      <div>
        <PageHeader title="Your Orders" />
        <EmptyState
          icon={<Package aria-hidden className="size-7" />}
          title="No orders yet"
          description="Materials you order will appear here with live delivery tracking."
          action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Your Orders"
        subtitle={`${orders.total} ${orders.total === 1 ? "order" : "orders"}`}
      />

      <ul className="grid gap-3 p-4 md:grid-cols-2 md:p-0 lg:grid-cols-3">
        {orders.items.map((order) => {
          const first = order.items[0];
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex h-full flex-col rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-raised)"
              >
                <div className="flex items-start gap-3">
                  <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50 text-ink-300">
                    {first?.imageUrl ? (
                      <Image
                        src={first.imageUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <Package aria-hidden className="size-6" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-ink-900">
                      Order #{order.orderNumber}
                    </p>
                    <p className="truncate text-[13px] text-ink-600">
                      {first?.productName}
                      {first && (
                        <span className="text-ink-400">
                          {" "}
                          ({formatQuantity(first.quantity, first.unit as Unit)})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
                      {order.vendor.businessName}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex-1">
                  <Chip tone={orderTone(order.status)}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Chip>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <span className="text-xs text-ink-500">
                    {new Date(order.placedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    })}
                    {order.paymentMethod === "COD" && " · Cash on delivery"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Money paise={order.totalPaise} className="text-[15px] font-bold text-ink-900" />
                    <ChevronRight aria-hidden className="size-4 text-ink-300" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
