"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Store, Truck } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { StickyBar } from "@/components/ui/Surface";
import { DeliveryChip } from "@/components/ui/Chip";
import { Price } from "@/components/ui/Money";
import { RatingStars } from "@/components/ui/RatingStars";
import { Stepper } from "@/components/ui/Stepper";
import { apiPost } from "@/lib/api-client";
import { formatINR } from "@/shared/money";
import {
  formatQuantity,
  snapQuantity,
  validateQuantity,
  type Unit,
} from "@/shared/units";
import { deliveryEta, type DeliveryMode } from "./delivery";

/**
 * Price, trust signals, seller selection and the add-to-cart control.
 *
 * Everything below the product name follows the selected seller — price, pack,
 * delivery ETA, "Verified vendor" — because each vendor has its own offer; a
 * page-level price would be wrong the moment the shopper switches seller.
 *
 * The quantity stepper enforces the selected vendor's MOQ and step client-side
 * using the same `validateQuantity` the API uses, so the customer gets an
 * instant, identical answer rather than a round trip to be told 12 bags is not a
 * legal quantity. The server still re-validates — this is convenience, not trust.
 */

export interface BuyBoxVariant {
  id: string;
  label: string;
  unit: Unit;
  pricePaise: number;
  mrpPaise: number;
  moqQuantity: number;
  stepQuantity: number;
  maxOrderQuantity: number | null;
  stockQuantity: number;
  deliveryMode: string;
  leadTimeDays: number;
  vendorName: string;
  vendorRating: number;
  vendorRatingCount: number;
  vendorVerified: boolean;
  minOrderPaise: number;
  freeDeliveryAbovePaise: number | null;
}

export function BuyBox({
  productName,
  taxRatePercent,
  variants,
  ratingAvg = 0,
  ratingCount = 0,
}: {
  productName: string;
  taxRatePercent: number;
  variants: BuyBoxVariant[];
  ratingAvg?: number;
  ratingCount?: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [quantity, setQuantity] = useState(variants[0]?.moqQuantity ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  if (!selected) {
    return (
      <p className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-500">
        No sellers currently stock this product.
      </p>
    );
  }

  const rules = {
    moq: selected.moqQuantity,
    step: selected.stepQuantity,
    max: selected.maxOrderQuantity,
    unit: selected.unit,
  };

  const lineTotal = Math.round(selected.pricePaise * quantity);
  const outOfStock = selected.stockQuantity <= 0;
  // The stepper stops at whichever is lower: the seller's cap or what is on hand.
  const maxQuantity = Math.min(
    selected.maxOrderQuantity ?? Number.POSITIVE_INFINITY,
    selected.stockQuantity,
  );
  const atStockLimit =
    !outOfStock && quantity + selected.stepQuantity > selected.stockQuantity + 1e-9;

  function selectVariant(variant: BuyBoxVariant) {
    setSelectedId(variant.id);
    // Each vendor has its own MOQ, so the quantity is re-snapped on switch
    // rather than carried over into an illegal value.
    setQuantity(
      snapQuantity(Math.max(quantity, variant.moqQuantity), {
        moq: variant.moqQuantity,
        step: variant.stepQuantity,
        max: variant.maxOrderQuantity,
        unit: variant.unit,
      }),
    );
    setError(null);
    setAdded(false);
  }

  async function addToCart() {
    const validation = validateQuantity(quantity, rules);
    if (!validation.ok) {
      setError(validation.reason);
      setQuantity(validation.suggestion);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await apiPost("/cart/items", {
      variantId: selected.id,
      quantity: validation.quantity,
    });

    setBusy(false);

    if (!result.ok) {
      // A 401 means the session expired or the user was never signed in.
      if (result.error.code === "UNAUTHENTICATED") {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setError(result.error.message);
      return;
    }

    setAdded(true);
    router.refresh();
  }

  return (
    <>
      {/* Offer summary for the selected seller */}
      <p className="mt-1 text-sm text-ink-500">{selected.label}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Price
          pricePaise={selected.pricePaise}
          mrpPaise={selected.mrpPaise}
          unit={selected.unit}
          size="lg"
        />
        {ratingCount > 0 && (
          <RatingStars rating={ratingAvg} count={ratingCount} className="text-sm" />
        )}
      </div>
      <p className="mt-1 text-xs text-ink-400">
        Excludes {taxRatePercent}% GST, added at checkout
      </p>

      <ul className="mt-4 space-y-2.5 text-sm text-ink-700">
        <li className="flex items-center gap-2.5">
          <Truck aria-hidden className="size-[18px] shrink-0 text-ink-400" />
          <span className="flex-1">{deliveryEta(selected.leadTimeDays, selected.deliveryMode)}</span>
          <DeliveryChip mode={selected.deliveryMode as DeliveryMode} />
        </li>
        {selected.vendorVerified && (
          <li className="flex items-center gap-2.5">
            <BadgeCheck aria-hidden className="size-[18px] shrink-0 text-trust-600" />
            <span>Verified vendor</span>
          </li>
        )}
        {selected.freeDeliveryAbovePaise != null && (
          <li className="flex items-center gap-2.5 text-ink-600">
            <Store aria-hidden className="size-[18px] shrink-0 text-ink-400" />
            <span>
              Free delivery from this seller above {formatINR(selected.freeDeliveryAbovePaise)}
            </span>
          </li>
        )}
      </ul>

      {/* Seller selection — the selected card is the supplier information. */}
      <section className="mt-6">
        <h2 className="pb-2.5 text-[17px] font-bold text-ink-900">
          {variants.length === 1 ? "Supplier information" : `Choose a supplier · ${variants.length} sellers`}
        </h2>

        <div role={variants.length > 1 ? "radiogroup" : undefined} aria-label="Sellers" className="space-y-2">
          {variants.map((variant) => {
            const isSelected = variant.id === selected.id;
            const single = variants.length === 1;

            return (
              <button
                key={variant.id}
                type="button"
                role={single ? undefined : "radio"}
                aria-checked={single ? undefined : isSelected}
                onClick={() => selectVariant(variant)}
                disabled={single}
                className={cn(
                  "flex w-full items-start gap-3 rounded-(--radius-card) border p-3 text-left transition-colors disabled:cursor-default",
                  isSelected && !single
                    ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600"
                    : "border-ink-100 bg-white hover:border-ink-200",
                )}
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-700">
                  <Store aria-hidden className="size-5" />
                  {!single && isSelected && (
                    <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white">
                      <Check aria-hidden className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-bold text-ink-900">{variant.vendorName}</span>
                    {variant.vendorVerified && (
                      <BadgeCheck aria-label="Verified vendor" className="size-4 text-trust-600" />
                    )}
                  </span>

                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
                    {variant.vendorRatingCount > 0 && (
                      <RatingStars rating={variant.vendorRating} count={variant.vendorRatingCount} />
                    )}
                    <span>Min {formatQuantity(variant.moqQuantity, variant.unit)}</span>
                    {!single && <span>{deliveryEta(variant.leadTimeDays, variant.deliveryMode)}</span>}
                  </span>

                  {!single && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Price pricePaise={variant.pricePaise} mrpPaise={variant.mrpPaise} unit={variant.unit} size="sm" />
                      <span className="text-[11px] text-ink-400">{variant.label}</span>
                    </span>
                  )}

                  {variant.stockQuantity <= 0 && (
                    <span className="mt-1 block text-[11px] font-semibold text-red-600">Out of stock</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Buy bar: fixed above the bottom nav on phones, in-flow from md. */}
      <StickyBar className="md:mt-6 md:border-t md:border-ink-100 md:pt-5">
        {error && (
          <p role="alert" className="mb-2 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Stepper
            value={quantity}
            onChange={(next) => {
              setError(null);
              setQuantity(next);
            }}
            min={selected.moqQuantity}
            step={selected.stepQuantity}
            max={Number.isFinite(maxQuantity) ? maxQuantity : null}
            disabled={outOfStock}
            format={(v) => formatQuantity(v, selected.unit)}
          />

          <Button
            onClick={added ? () => router.push("/cart") : addToCart}
            loading={busy}
            disabled={outOfStock}
            size="lg"
            fullWidth
            variant={added ? "secondary" : "primary"}
          >
            {outOfStock ? "Out of stock" : added ? "Go to cart" : "Add to Cart"}
          </Button>
        </div>

        <p className="mt-1.5 truncate text-center text-[11px] text-ink-400 md:text-left">
          {atStockLimit
            ? `Only ${formatQuantity(selected.stockQuantity, selected.unit)} left · `
            : ""}
          {formatINR(lineTotal)} + {taxRatePercent}% GST · {productName}
        </p>
      </StickyBar>
    </>
  );
}
