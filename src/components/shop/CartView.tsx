"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Store, Tag, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Money, MoneyRow, Price } from "@/components/ui/Money";
import { Card, StickyBar } from "@/components/ui/Surface";
import { Stepper } from "@/components/ui/Stepper";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { formatINR } from "@/shared/money";
import { formatQuantity, type Unit } from "@/shared/units";
import type { CartView as CartData } from "@/server/services/cart.service";

/**
 * Interactive cart.
 *
 * Every mutation goes through the REST API rather than a Server Action, so the
 * exact endpoints the Android app will call are the ones exercised here. The
 * server returns the fully repriced cart on every change, which means the
 * client never recomputes a total locally and the two can never disagree.
 *
 * Layout: vendor groups then the price summary on phones, with a fixed checkout
 * bar; from lg the summary is a sticky right column.
 */

type CartItem = CartData["items"][number];

export function CartView({ initialCart }: { initialCart: CartData }) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const { pricing } = cart;

  async function changeQuantity(itemId: string, quantity: number) {
    setBusyItem(itemId);
    const result = await apiPatch<CartData>(`/cart/items/${itemId}`, { quantity });
    setBusyItem(null);

    if (result.ok) {
      setCart(result.data);
      router.refresh();
    }
  }

  async function remove(itemId: string) {
    setBusyItem(itemId);
    const result = await apiDelete<CartData>(`/cart/items/${itemId}`);
    setBusyItem(null);

    if (result.ok) {
      setCart(result.data);
      router.refresh();
    }
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;

    setCouponBusy(true);
    setCouponError(null);
    const result = await apiPost<CartData>("/cart/coupon", { code: couponInput });
    setCouponBusy(false);

    if (result.ok) {
      setCart(result.data);
      setCouponInput("");
    } else {
      setCouponError(result.error.message);
    }
  }

  async function removeCoupon() {
    const result = await apiDelete<CartData>("/cart/coupon");
    if (result.ok) setCart(result.data);
  }

  const blocked = pricing.groups.some((g) => g.belowMinimum) || cart.items.some((i) => !i.isAvailable);

  // Pricing only groups sellers with at least one purchasable line, so items
  // whose whole seller dropped out would otherwise vanish while still blocking
  // checkout. They get their own block so they can be removed.
  const groupedVendorIds = new Set(pricing.groups.map((g) => g.vendorId));
  const orphaned = cart.items.filter((i) => !groupedVendorIds.has(i.vendor.id));

  const rowProps = { busyItem, onQuantity: changeQuantity, onRemove: remove };

  return (
    <div className="pb-44 md:pb-8">
      <PageHeader
        title="My Cart"
        subtitle={`${cart.items.length} ${cart.items.length === 1 ? "item" : "items"}`}
        backHref="/shop"
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <div className="space-y-3 px-4 pt-3 md:px-0 md:pt-0">
          {cart.issues.length > 0 && (
            <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle aria-hidden className="size-4 shrink-0 text-amber-600" />
              <ul className="space-y-0.5 text-xs text-amber-900">
                {cart.issues.map((issue, index) => (
                  <li key={`${issue.itemId}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* One block per vendor — each becomes its own order at checkout. */}
          {pricing.groups.map((group) => {
            const vendor = cart.vendors.find((v) => v.id === group.vendorId);
            const groupItems = cart.items.filter((i) => i.vendor.id === group.vendorId);

            return (
              <Card key={group.vendorId} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/70 px-4 py-2.5">
                  <Store aria-hidden className="size-4 text-ink-400" />
                  <span className="flex-1 truncate text-[13px] font-bold text-ink-800">
                    {vendor?.businessName}
                  </span>
                  {group.freeDeliveryApplied ? (
                    <span className="text-[11px] font-bold text-trust-700">Free delivery</span>
                  ) : (
                    <span className="text-[11px] text-ink-500">
                      +{formatINR(group.deliveryFeePaise)} delivery
                    </span>
                  )}
                </div>

                {group.belowMinimum && (
                  <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-800">
                    Add {formatINR(group.belowMinimum.shortfallPaise)} more to meet this
                    seller&apos;s {formatINR(group.belowMinimum.minOrderPaise)} minimum
                  </p>
                )}

                <ul className="divide-y divide-ink-100">
                  {groupItems.map((item) => (
                    <CartRow key={item.id} item={item} {...rowProps} />
                  ))}
                </ul>
              </Card>
            );
          })}

          {orphaned.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-ink-100 bg-ink-50/70 px-4 py-2.5 text-[13px] font-bold text-ink-800">
                Unavailable
              </div>
              <ul className="divide-y divide-ink-100">
                {orphaned.map((item) => (
                  <CartRow key={item.id} item={item} {...rowProps} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Summary column */}
        <div className="mt-3 space-y-3 px-4 md:px-0 lg:sticky lg:top-24 lg:mt-0">
          {/* Coupon */}
          <Card className="p-4">
            {pricing.couponCode ? (
              <div className="flex items-center gap-2">
                <Tag aria-hidden className="size-4 text-trust-600" />
                <span className="flex-1 text-[13px] font-semibold text-ink-900">
                  {pricing.couponCode} applied
                </span>
                <span className="text-[13px] font-bold text-trust-700">
                  − {formatINR(pricing.discountPaise)}
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  aria-label="Remove coupon"
                  className="flex size-9 items-center justify-center rounded-full text-ink-300 hover:bg-ink-50 hover:text-ink-600"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyCoupon();
                    }}
                    placeholder="Enter coupon code"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-ink-200 px-3 text-sm uppercase outline-none focus:border-brand-600"
                    aria-label="Coupon code"
                  />
                  <Button onClick={applyCoupon} loading={couponBusy} variant="outline">
                    Apply
                  </Button>
                </div>
                {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
                <p className="mt-2 text-[11px] text-ink-400">Try FIRST500, BUILD10 or CEMENT250</p>
              </>
            )}
          </Card>

          {/* Price details */}
          <Card className="p-4">
            <h2 className="mb-1 text-[15px] font-bold text-ink-900">Price Details</h2>
            <MoneyRow label="Items total" paise={pricing.itemsSubtotalPaise} />
            <MoneyRow
              label="Delivery charges"
              paise={pricing.deliveryFeePaise}
              free={pricing.deliveryFeePaise === 0}
              note={pricing.groups.length > 1 ? `(${pricing.groups.length} sellers)` : undefined}
            />
            {pricing.discountPaise > 0 && (
              <MoneyRow label="Coupon discount" paise={-pricing.discountPaise} />
            )}
            <MoneyRow label="GST" paise={pricing.taxPaise} />
            <div className="mt-1 border-t border-ink-100 pt-1.5">
              <MoneyRow label="Total Amount" paise={pricing.totalPaise} emphasis />
            </div>
            {pricing.totalSavingsPaise > 0 && (
              <p className="mt-2 rounded-lg bg-trust-50 px-3 py-2 text-center text-xs font-semibold text-trust-700">
                You save {formatINR(pricing.totalSavingsPaise)} on this order
              </p>
            )}

            <StickyBar className="md:mt-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 md:hidden">
                  <p className="text-[11px] text-ink-400">Total</p>
                  <p className="text-lg leading-tight font-bold text-ink-900 tabular">
                    {formatINR(pricing.totalPaise)}
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/checkout")}
                  disabled={blocked}
                  size="lg"
                  fullWidth
                >
                  {blocked ? "Resolve issues above" : "Proceed to Checkout"}
                </Button>
              </div>
            </StickyBar>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CartRow({
  item,
  busyItem,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  busyItem: string | null;
  onQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}) {
  const busy = busyItem === item.id;
  // Same ceiling the old +/- buttons used (stock), plus the seller's cap.
  const max = Math.min(item.maxOrderQuantity ?? Number.POSITIVE_INFINITY, item.stockQuantity);

  return (
    <li className="flex gap-3 p-4">
      <Link
        href={`/product/${item.product.slug}`}
        className="relative size-[76px] shrink-0 overflow-hidden rounded-xl bg-ink-50"
      >
        {item.product.images[0] && (
          <Image src={item.product.images[0]} alt="" fill sizes="76px" className="object-cover" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/product/${item.product.slug}`}
              className="line-clamp-2 text-sm leading-snug font-semibold text-ink-900 hover:text-ink-700"
            >
              {item.product.name}
            </Link>
            <p className="mt-0.5 text-xs text-ink-400">{item.variantLabel}</p>
            <Price pricePaise={item.pricePaise} unit={item.unit as Unit} size="sm" className="mt-1" />
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={busy}
            aria-label={`Remove ${item.product.name}`}
            className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 aria-hidden className="size-[18px]" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          {item.isAvailable ? (
            <Stepper
              value={item.quantity}
              onChange={(next) => onQuantity(item.id, next)}
              min={item.moqQuantity}
              step={item.stepQuantity}
              max={Number.isFinite(max) ? max : null}
              disabled={busy}
              label={`Quantity of ${item.product.name}`}
              format={(v) => formatQuantity(v, item.unit as Unit)}
            />
          ) : (
            <span className="text-xs font-semibold text-red-600">Unavailable</span>
          )}

          <Money
            paise={Math.round(item.pricePaise * item.quantity)}
            className="text-[15px] font-bold text-ink-900"
          />
        </div>
      </div>
    </li>
  );
}
