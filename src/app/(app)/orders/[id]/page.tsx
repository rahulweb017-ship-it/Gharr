import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Store,
  UserRound,
} from "lucide-react";
import { getOrder } from "@/server/services/order.service";
import { requirePageActor } from "@/server/auth/page-session";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { Money, MoneyRow } from "@/components/ui/Money";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Surface";
import { PageHeader } from "@/components/layout/PageHeader";
import { CancelOrderButton } from "@/components/shop/CancelOrderButton";
import { Timeline, type TimelineItem } from "@/components/orders/Timeline";
import { orderTone } from "@/components/orders/order-status";
import { formatINR } from "@/shared/money";
import { formatPhone } from "@/shared/phone";
import { formatMinute } from "@/shared/time";
import { formatQuantity, type Unit } from "@/shared/units";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}

interface AddressSnapshot {
  contactName: string;
  contactPhone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
}

const STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
};

const stamp = (date: Date | string | null | undefined) =>
  date ? new Date(date).toLocaleString("en-IN", STAMP) : null;

/** Delivery slot dates are Postgres `date` columns (UTC midnight). */
const slotDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** The full forward path; the tracker collapses it into five customer steps. */
const HAPPY_PATH: OrderStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "ACCEPTED",
  "PACKED",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/** Customer-facing steps from the Order Tracking board. */
const STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "DISPATCHED", label: "Dispatched" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

/**
 * Order tracking.
 *
 * The timeline is derived from the recorded OrderEvents first; a step with no
 * event of its own (e.g. a vendor that dispatched without marking "packed")
 * still reads as complete once a later step has happened, but only shows a
 * timestamp when one was actually recorded.
 */
export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { placed } = await searchParams;
  const actor = await requirePageActor(`/orders/${id}`);

  let order;
  try {
    order = await getOrder(id, actor);
  } catch {
    notFound();
  }

  const address = order.deliveryAddress as unknown as AddressSnapshot;
  const canCancel = order.availableActions.some((a) => a.to === "CANCELLED");
  const eventAt = (status: OrderStatus) =>
    [...order.events].reverse().find((e) => e.toStatus === status)?.createdAt;
  const reached = new Set(order.events.map((event) => event.toStatus));

  // How far along the forward path the order got, from its status or history.
  const statusIndex = HAPPY_PATH.indexOf(order.status);
  const historyIndex = Math.max(
    0,
    ...order.events.map((e) => HAPPY_PATH.indexOf(e.toStatus)),
  );
  const progress = ["RETURN_REQUESTED", "RETURNED", "REFUNDED"].includes(order.status)
    ? HAPPY_PATH.indexOf("DELIVERED")
    : Math.max(statusIndex, historyIndex);

  const isCancelled = order.status === "CANCELLED";
  const deliveryFailed = order.status === "DELIVERY_FAILED";

  const expectation =
    order.deliveryMode === "PICKUP"
      ? "Ready for pickup from the seller"
      : order.deliverySlotDate
        ? `Expected ${slotDate(order.deliverySlotDate)}`
        : null;

  // Build the timeline.
  const timeline: TimelineItem[] = [
    { key: "PLACED", label: "Order placed", state: "done", detail: stamp(order.placedAt) },
  ];
  let currentAssigned = false;

  for (const step of STEPS) {
    const stepIndex = HAPPY_PATH.indexOf(step.status);
    const done = reached.has(step.status) || progress >= stepIndex;

    if (!done && isCancelled) break;

    // Delivery failed sits between "Out for delivery" and "Delivered".
    if (step.status === "DELIVERED" && deliveryFailed) {
      timeline.push({
        key: "DELIVERY_FAILED",
        label: ORDER_STATUS_LABELS.DELIVERY_FAILED,
        state: "failed",
        current: true,
        detail: stamp(eventAt("DELIVERY_FAILED")),
      });
      currentAssigned = true;
    }

    let detail = done
      ? stamp(eventAt(step.status) ?? (step.status === "DELIVERED" ? order.deliveredAt : null))
      : null;

    if (!done && !currentAssigned) {
      currentAssigned = true;
      if (step.status === "CONFIRMED" && order.status === "PENDING_PAYMENT") {
        detail = ORDER_STATUS_LABELS.PENDING_PAYMENT;
      } else if (step.status === "DISPATCHED" && (order.status === "ACCEPTED" || order.status === "PACKED")) {
        // Seller-side progress before dispatch.
        const at = stamp(eventAt(order.status));
        detail = at ? `${ORDER_STATUS_LABELS[order.status]} · ${at}` : ORDER_STATUS_LABELS[order.status];
      } else if (step.status === "DELIVERED") {
        detail = expectation;
      }
      timeline.push({ key: step.status, label: step.label, state: "pending", current: true, detail });
      continue;
    }

    if (!done && step.status === "DELIVERED") detail = expectation;
    timeline.push({ key: step.status, label: step.label, state: done ? "done" : "pending", detail });
  }

  if (isCancelled) {
    timeline.push({
      key: "CANCELLED",
      label: ORDER_STATUS_LABELS.CANCELLED,
      state: "failed",
      current: true,
      detail: stamp(order.cancelledAt ?? eventAt("CANCELLED")),
    });
  }

  // Returns are layered on after delivery.
  for (const status of ["RETURN_REQUESTED", "RETURNED", "REFUNDED"] as const) {
    if (reached.has(status) || order.status === status) {
      timeline.push({
        key: status,
        label: ORDER_STATUS_LABELS[status],
        state: "done",
        current: order.status === status,
        detail: stamp(eventAt(status)),
      });
    }
  }
  if (order.status === "RETURN_REQUESTED" || order.status === "RETURNED") {
    const next = order.status === "RETURN_REQUESTED" ? "RETURNED" : "REFUNDED";
    timeline.push({ key: next, label: ORDER_STATUS_LABELS[next], state: "pending" });
  }

  const first = order.items[0];

  return (
    <div className="pb-8">
      <PageHeader title="Order Tracking" subtitle={`#${order.orderNumber}`} backHref="/orders" />

      {placed === "1" && (
        <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-(--radius-card) border border-trust-100 bg-trust-50 p-3.5 md:mx-0 md:mt-0 md:mb-4">
          <CheckCircle2 aria-hidden className="size-5 shrink-0 text-trust-600" />
          <div>
            <p className="text-[13px] font-bold text-trust-700">Order placed</p>
            <p className="text-xs text-ink-600">
              {order.paymentMethod === "COD"
                ? "Pay the delivery agent when your order arrives."
                : "Payment received."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pt-3 md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6 md:px-0 md:pt-0">
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card className="flex items-center gap-3 p-4">
            <span className="relative flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50 text-ink-300">
              {first?.imageUrl ? (
                <Image src={first.imageUrl} alt="" fill sizes="72px" className="object-cover" />
              ) : (
                <Package aria-hidden className="size-7" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink-900">Order #{order.orderNumber}</p>
              {first && (
                <p className="truncate text-[13px] text-ink-600">
                  {first.productName} ({formatQuantity(first.quantity, first.unit as Unit)})
                  {order.items.length > 1 && (
                    <span className="text-ink-400"> +{order.items.length - 1} more</span>
                  )}
                </p>
              )}
              <p className="text-xs text-ink-400">
                Placed on{" "}
                {new Date(order.placedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Asia/Kolkata",
                })}
              </p>
            </div>
            <Chip tone={orderTone(order.status)} className="hidden shrink-0 sm:inline-flex">
              {ORDER_STATUS_LABELS[order.status]}
            </Chip>
          </Card>

          {/* Timeline */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-ink-900">Order status</h2>
              <Chip tone={orderTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Chip>
            </div>
            <Timeline items={timeline} />

            {isCancelled && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-800">
                {order.cancelReason ? `Reason: ${order.cancelReason}.` : "This order was cancelled."}
                {order.paymentMethod !== "COD" &&
                  " Any amount paid will be refunded within 5-7 working days."}
              </p>
            )}
            {deliveryFailed && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                The delivery partner could not complete the drop. The seller will
                retry — keep your phone reachable.
              </p>
            )}
          </Card>

          {/* Delivery details */}
          <Card className="p-4">
            <h2 className="mb-3 text-[15px] font-bold text-ink-900">Delivery details</h2>
            <ul className="flex flex-col gap-3 text-[13px]">
              <li className="flex gap-3">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span className="min-w-0 leading-relaxed text-ink-600">
                  <span className="block font-semibold text-ink-900">
                    {address.city}, {address.state}
                  </span>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  {address.landmark ? `, ${address.landmark}` : ""}, {address.city} –{" "}
                  {address.pincode}
                </span>
              </li>
              <li className="flex gap-3">
                <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span className="min-w-0 text-ink-600">
                  <span className="block font-semibold text-ink-900">{address.contactName}</span>
                  {address.contactPhone && formatPhone(address.contactPhone)}
                </span>
              </li>
              <li className="flex gap-3">
                <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span className="min-w-0 text-ink-600">
                  <span className="block font-semibold text-ink-900">
                    {order.deliveryMode === "PICKUP"
                      ? "Pickup from seller"
                      : order.deliveryMode === "SCHEDULED"
                        ? "Scheduled delivery"
                        : "Standard delivery"}
                  </span>
                  {order.status === "DELIVERED" && order.deliveredAt
                    ? `Delivered ${stamp(order.deliveredAt)}`
                    : order.deliverySlotDate
                      ? `${slotDate(order.deliverySlotDate)}${
                          order.deliverySlotStartMinute != null &&
                          order.deliverySlotEndMinute != null
                            ? `, ${formatMinute(order.deliverySlotStartMinute)} – ${formatMinute(order.deliverySlotEndMinute)}`
                            : ""
                        }`
                      : "Delivery date confirmed on dispatch"}
                </span>
              </li>
            </ul>
            {order.customerNote && (
              <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                Note: {order.customerNote}
              </p>
            )}
          </Card>

          {/* Seller */}
          <Card className="flex items-center gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500">
              <Store aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500">Sold by</p>
              <p className="truncate text-sm font-semibold text-ink-900">
                {order.vendor.businessName}
              </p>
            </div>
            <a
              href={`tel:${order.vendor.phoneE164}`}
              aria-label={`Call ${order.vendor.businessName}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              <Phone aria-hidden className="size-4" />
            </a>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 md:sticky md:top-24">
          {/* Items */}
          <Card className="overflow-hidden">
            <h2 className="border-b border-ink-100 px-4 py-3 text-[15px] font-bold text-ink-900">
              {order.items.length} {order.items.length === 1 ? "item" : "items"}
            </h2>
            <ul className="divide-y divide-ink-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 p-4">
                  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50 text-ink-300">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <Package aria-hidden className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-semibold text-ink-900">
                      {item.productName}
                    </p>
                    <p className="text-xs text-ink-400">{item.variantLabel}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatQuantity(item.quantity, item.unit as Unit)} ×{" "}
                      {formatINR(item.unitPricePaise)}
                    </p>
                  </div>
                  <Money paise={item.lineTotalPaise} className="text-[13px] font-bold text-ink-900" />
                </li>
              ))}
            </ul>
          </Card>

          {/* Bill */}
          <Card className="p-4">
            <h2 className="mb-1 text-[15px] font-bold text-ink-900">Price details</h2>
            <MoneyRow label="Items total" paise={order.itemsSubtotalPaise} />
            {order.discountPaise > 0 && <MoneyRow label="Discount" paise={-order.discountPaise} />}
            <MoneyRow
              label="Delivery"
              paise={order.deliveryFeePaise}
              free={order.deliveryFeePaise === 0}
            />
            <MoneyRow label="GST" paise={order.taxPaise} />
            <div className="mt-1 border-t border-ink-100 pt-1">
              <MoneyRow
                label={order.paymentMethod === "COD" ? "Pay on delivery" : "Paid"}
                paise={order.totalPaise}
                emphasis
              />
            </div>
          </Card>

          {canCancel && <CancelOrderButton orderId={order.id} />}

          <Link
            href={`/account/support?orderId=${order.id}`}
            className="text-center text-[13px] font-semibold text-brand-700 hover:text-brand-800"
          >
            Report a problem with this order
          </Link>
        </aside>
      </div>
    </div>
  );
}
