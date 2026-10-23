"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CalendarClock,
  CreditCard,
  Landmark,
  Lock,
  Smartphone,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddressPicker } from "@/components/account/AddressPicker";
import type { SavedAddress } from "@/components/account/AddressForm";
import { Button } from "@/components/ui/Button";
import { MoneyRow } from "@/components/ui/Money";
import { Card, StickyBar } from "@/components/ui/Surface";
import { apiPost } from "@/lib/api-client";
import { formatINR } from "@/shared/money";
import type { CartView as CartData } from "@/server/services/cart.service";
import { deliveryEta } from "./delivery";

interface SlotDay {
  date: string;
  label: string;
  windows: Array<{ startMinute: number; endMinute: number; label: string }>;
}

interface CheckoutResponse {
  checkoutGroupId: string;
  orders: Array<{ id: string; orderNumber: string }>;
  paymentMethod: string;
  clientPayload: { redirectUrl?: string };
}

export type PaymentKey = "UPI" | "CARD" | "NETBANKING" | "COD";

/** A payment method and whether the configured provider can take it today. */
export interface PaymentOption {
  key: PaymentKey;
  enabled: boolean;
}

const PAYMENT_META: Record<PaymentKey, { label: string; description: string; icon: LucideIcon }> = {
  UPI: { label: "UPI", description: "Google Pay, PhonePe, Paytm and other UPI apps", icon: Smartphone },
  CARD: { label: "Credit / Debit card", description: "Visa, Mastercard, RuPay", icon: CreditCard },
  NETBANKING: { label: "Net banking", description: "All major Indian banks", icon: Landmark },
  COD: { label: "Cash on delivery", description: "Pay the delivery agent when your order arrives", icon: Banknote },
};

/**
 * One-page checkout: ① address ② schedule ③ payment, with the bill beside it.
 *
 * The request sent to /cart/checkout is unchanged from the earlier single-list
 * version; only the presentation moved into numbered sections. Addresses come
 * from AddressPicker, which lets a first-time customer add one in a sheet
 * without leaving checkout.
 */
export function CheckoutView({
  cart,
  addresses,
  addressDefaults,
  slots,
  needsSlot,
  leadTimeDays,
  paymentOptions,
}: {
  cart: CartData;
  addresses: SavedAddress[];
  addressDefaults?: { contactName?: string; contactPhone?: string; city?: string };
  slots: SlotDay[];
  needsSlot: boolean;
  leadTimeDays: number;
  paymentOptions: PaymentOption[];
}) {
  const router = useRouter();

  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [method, setMethod] = useState<PaymentKey>(
    paymentOptions.find((o) => o.key === "COD" && o.enabled)?.key ??
      paymentOptions.find((o) => o.enabled)?.key ??
      "COD",
  );
  const [slotDate, setSlotDate] = useState(slots[0]?.date);
  const [slotIndex, setSlotIndex] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generated once per mount so a double-tap on "Place order" cannot create two
  // payments — the server treats a repeat of this key as the same checkout.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const { pricing } = cart;
  const selectedDay = slots.find((day) => day.date === slotDate) ?? slots[0];
  const selectedWindow = selectedDay?.windows[slotIndex];
  const anyPrepaid = paymentOptions.some((o) => o.key !== "COD" && o.enabled);

  async function placeOrder() {
    if (!addressId) {
      setError("Add a delivery address to continue");
      return;
    }

    setBusy(true);
    setError(null);

    const result = await apiPost<CheckoutResponse>("/cart/checkout", {
      addressId,
      paymentMethod: method,
      ...(needsSlot && selectedDay && selectedWindow
        ? {
            deliverySlotDate: selectedDay.date,
            deliverySlotStartMinute: selectedWindow.startMinute,
            deliverySlotEndMinute: selectedWindow.endMinute,
          }
        : {}),
      ...(note ? { customerNote: note } : {}),
      idempotencyKey,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    // A prepaid order goes to the gateway; COD is already confirmed.
    const redirect = result.data.clientPayload?.redirectUrl;
    if (redirect) {
      router.push(redirect);
      return;
    }

    router.push(`/orders/${result.data.orders[0].id}?placed=1`);
  }

  return (
    <div className="pb-48 md:pb-8">
      <PageHeader title="Checkout" backHref="/cart" />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <div className="space-y-3 px-4 pt-3 md:px-0 md:pt-0">
          {/* ① Delivery address */}
          <StepCard step={1} title="Delivery Address">
            <AddressPicker
              addresses={addresses}
              selectedId={addressId}
              onSelect={(id) => {
                setAddressId(id);
                setError(null);
              }}
              defaults={addressDefaults}
            />
          </StepCard>

          {/* ② Delivery schedule */}
          <StepCard step={2} title="Delivery Schedule">
            {needsSlot && selectedDay ? (
              <>
                <p className="mb-3 flex items-start gap-2 text-xs text-ink-500">
                  <CalendarClock aria-hidden className="mt-px size-4 shrink-0 text-ink-400" />
                  Your order includes heavy materials delivered by truck. Pick a day and window.
                </p>

                <div
                  role="radiogroup"
                  aria-label="Delivery day"
                  className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
                >
                  {slots.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      role="radio"
                      aria-checked={day.date === slotDate}
                      onClick={() => setSlotDate(day.date)}
                      className={cn(
                        "h-11 shrink-0 rounded-xl border px-3.5 text-xs font-semibold",
                        day.date === slotDate
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-ink-200 text-ink-600 hover:border-ink-300",
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                <div role="radiogroup" aria-label="Delivery window" className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedDay.windows.map((window, index) => (
                    <button
                      key={window.label}
                      type="button"
                      role="radio"
                      aria-checked={index === slotIndex}
                      onClick={() => setSlotIndex(index)}
                      className={cn(
                        "min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold",
                        index === slotIndex
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-ink-200 text-ink-600 hover:border-ink-300",
                      )}
                    >
                      {window.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-xl bg-ink-50 p-3">
                <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-500" />
                <div className="text-sm">
                  <p className="font-semibold text-ink-900">Standard delivery</p>
                  <p className="text-xs text-ink-500">
                    {deliveryEta(leadTimeDays)}
                    {pricing.groups.length > 1 ? " · each seller delivers separately" : ""}
                  </p>
                </div>
              </div>
            )}

            <label htmlFor="note" className="mt-4 block text-[13px] font-semibold text-ink-800">
              Delivery instructions <span className="font-medium text-ink-400">(optional)</span>
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="e.g. Call before arriving, unload at the site gate"
              className="mt-1.5 w-full resize-none rounded-xl border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </StepCard>

          {/* ③ Payment */}
          <StepCard step={3} title="Payment Method">
            <div role="radiogroup" aria-label="Payment method" className="space-y-2">
              {paymentOptions.map((option) => {
                const meta = PAYMENT_META[option.key];
                const selected = method === option.key;
                const Icon = meta.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!option.enabled}
                    onClick={() => setMethod(option.key)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      selected ? "border-brand-600 bg-brand-50/50" : "border-ink-100 hover:border-ink-200",
                      "disabled:cursor-not-allowed disabled:bg-ink-50/60 disabled:hover:border-ink-100",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        selected ? "border-brand-600" : "border-ink-300",
                        !option.enabled && "border-ink-200",
                      )}
                    >
                      {selected && <span className="size-2.5 rounded-full bg-brand-600" />}
                    </span>
                    <Icon
                      aria-hidden
                      className={cn(
                        "size-5 shrink-0",
                        selected ? "text-brand-600" : option.enabled ? "text-ink-500" : "text-ink-300",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          option.enabled ? "text-ink-900" : "text-ink-400",
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="block text-xs text-ink-400">
                        {option.enabled ? meta.description : "Not available yet"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {anyPrepaid && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                <Lock aria-hidden className="size-3.5 text-trust-600" />
                Online payments are completed on the secure payment page.
              </p>
            )}
          </StepCard>
        </div>

        {/* Order summary */}
        <div className="mt-3 px-4 md:px-0 lg:sticky lg:top-24 lg:mt-0">
          <Card className="p-4">
            <h2 className="mb-2 text-[15px] font-bold text-ink-900">
              Order summary
              {pricing.groups.length > 1 && (
                <span className="ml-1.5 text-xs font-medium text-ink-400">
                  · {pricing.groups.length} sellers, {pricing.groups.length} deliveries
                </span>
              )}
            </h2>

            <div className="space-y-1.5">
              {pricing.groups.map((group) => {
                const vendor = cart.vendors.find((v) => v.id === group.vendorId);
                return (
                  <div key={group.vendorId} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
                    <Store aria-hidden className="size-3.5 shrink-0 text-ink-400" />
                    <span className="flex-1 truncate text-xs font-semibold text-ink-700">
                      {vendor?.businessName}
                    </span>
                    <span className="text-xs font-bold text-ink-900 tabular">
                      {formatINR(group.totalPaise)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 border-t border-ink-100 pt-1">
              <MoneyRow label="Items total" paise={pricing.itemsSubtotalPaise} />
              <MoneyRow
                label="Delivery charges"
                paise={pricing.deliveryFeePaise}
                free={pricing.deliveryFeePaise === 0}
              />
              {pricing.discountPaise > 0 && (
                <MoneyRow label="Coupon discount" paise={-pricing.discountPaise} />
              )}
              <MoneyRow label="GST" paise={pricing.taxPaise} />
              <div className="mt-1 border-t border-ink-100 pt-1.5">
                <MoneyRow label="Total Amount" paise={pricing.totalPaise} emphasis />
              </div>
            </div>

            <StickyBar className="md:mt-4">
              {error && (
                <p role="alert" className="mb-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-3">
                <div className="shrink-0 md:hidden">
                  <p className="text-[11px] text-ink-400">
                    {method === "COD" ? "Pay on delivery" : "To pay"}
                  </p>
                  <p className="text-lg leading-tight font-bold text-ink-900 tabular">
                    {formatINR(pricing.totalPaise)}
                  </p>
                </div>
                <Button onClick={placeOrder} loading={busy} disabled={!addressId} size="lg" fullWidth>
                  {!addressId ? "Add an address" : method === "COD" ? "Place Order" : "Place Order & Pay"}
                </Button>
              </div>
              <p className="mt-2 text-center text-[11px] text-ink-400">
                By placing the order, you agree to our{" "}
                <Link href="/terms" className="font-semibold text-brand-700 underline underline-offset-2">
                  Terms &amp; Conditions
                </Link>
              </p>
            </StickyBar>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** A checkout section with the navy numbered circle from the UI boards. */
function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold text-ink-900">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[13px] font-bold text-white"
        >
          {step}
        </span>
        <span>
          <span className="sr-only">Step {step}: </span>
          {title}
        </span>
      </h2>
      {children}
    </Card>
  );
}
