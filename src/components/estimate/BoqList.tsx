"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Package, ShoppingCart } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Card, StickyBar } from "@/components/ui/Surface";
import { Stepper } from "@/components/ui/Stepper";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatINR } from "@/shared/money";
import { formatQuantity } from "@/shared/units";
import type { getBoq } from "@/server/services/estimate.service";

/**
 * The material list (BOQ): each estimated material mapped to the cheapest live
 * offer, with pack counts pre-filled from the estimate.
 *
 * Totals here are a preview (price × packs); the cart reprices everything
 * server-side, and "Buy Complete List" only ever sends line ids and pack counts.
 */

type Boq = Awaited<ReturnType<typeof getBoq>>;
type BoqItem = Boq["items"][number];
type AvailableItem = Extract<BoqItem, { available: true }>;

interface CartResult {
  added: string[];
  failed: Array<{ lineId: string; label: string; reason: string }>;
}

/** Past this gap between live and estimated cost, the customer should be told. */
const PRICE_DRIFT_PERCENT = 10;

export function BoqList({ boq }: { boq: Boq }) {
  const router = useRouter();
  const available = useMemo(
    () => boq.items.filter((i): i is AvailableItem => i.available),
    [boq.items],
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(available.map((i) => i.lineId)));
  const [packs, setPacks] = useState<Record<string, number>>(() =>
    Object.fromEntries(available.map((i) => [i.lineId, i.packs])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CartResult | null>(null);

  const allSelected = available.length > 0 && selected.size === available.length;
  const chosen = available.filter((i) => selected.has(i.lineId));
  const totalPaise = chosen.reduce(
    (sum, i) => sum + Math.round(i.offer.pricePaise * packs[i.lineId]),
    0,
  );

  function toggle(lineId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  async function buy() {
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const response = await apiPost<CartResult>(`/estimates/${boq.estimateId}/cart`, {
      items: chosen.map((i) => ({ lineId: i.lineId, quantity: packs[i.lineId] })),
    });

    if (!response.ok) {
      setBusy(false);
      if (response.error.code === "UNAUTHENTICATED") {
        router.push(`/login?next=${encodeURIComponent(`/estimate/${boq.estimateId}/boq`)}`);
        return;
      }
      setError(response.error.message);
      return;
    }

    if (response.data.failed.length === 0) {
      router.push("/cart");
      router.refresh();
      return;
    }

    // Partial success: keep the customer here so they can see what didn't make it.
    setBusy(false);
    setResult(response.data);
    router.refresh();
  }

  return (
    <div className="pb-44 md:pb-0">
      <div className="px-4 md:px-0">
        {available.length > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm font-semibold text-ink-900">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selected.size > 0 && !allSelected;
              }}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(available.map((i) => i.lineId)))
              }
              className="size-5 accent-brand-600"
            />
            Select all
            <span className="font-medium text-ink-400">
              ({available.length} {available.length === 1 ? "item" : "items"})
            </span>
          </label>
        )}

        <Card className="mt-2 overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {boq.items.map((item) =>
              item.available ? (
                <AvailableRow
                  key={item.lineId}
                  item={item}
                  checked={selected.has(item.lineId)}
                  onToggle={() => toggle(item.lineId)}
                  packs={packs[item.lineId]}
                  onPacks={(v) => setPacks((p) => ({ ...p, [item.lineId]: v }))}
                />
              ) : (
                <li key={item.lineId} className="flex items-center gap-3 p-3.5 opacity-60">
                  <input type="checkbox" disabled aria-label={`${item.label} unavailable`} className="size-5" />
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-300">
                    <Package aria-hidden className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{item.label}</p>
                    <p className="text-xs text-ink-500">
                      Needed: {item.unit ? formatQuantity(item.estimatedQuantity, item.unit) : item.estimatedQuantity}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-red-600">Currently out of stock</p>
                  </div>
                </li>
              ),
            )}
          </ul>
        </Card>

        {result && (
          <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle aria-hidden className="size-4 text-amber-600" />
              {result.added.length > 0
                ? `${result.added.length} added to cart — ${result.failed.length} couldn't be added`
                : "None of the selected items could be added"}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {result.failed.map((f) => (
                <li key={f.lineId}>
                  <span className="font-semibold">{f.label}:</span> {f.reason}
                </li>
              ))}
            </ul>
            {result.added.length > 0 && (
              <ButtonLink href="/cart" variant="secondary" size="sm" className="mt-3">
                Go to cart
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <StickyBar className="md:mt-6">
          <div className="flex items-center gap-4 md:justify-end">
            <div className="min-w-0 flex-1 md:flex-none md:text-right">
              <p className="text-xs text-ink-500">
                {chosen.length} of {available.length} selected
              </p>
              <Money paise={totalPaise} className="text-lg font-bold text-ink-900" />
            </div>
            <Button
              size="lg"
              onClick={buy}
              loading={busy}
              disabled={chosen.length === 0}
              className="shrink-0 md:min-w-64"
            >
              <ShoppingCart aria-hidden className="size-5" />
              Buy Complete List
            </Button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        </StickyBar>
      )}
    </div>
  );
}

function AvailableRow({
  item,
  checked,
  onToggle,
  packs,
  onPacks,
}: {
  item: AvailableItem;
  checked: boolean;
  onToggle: () => void;
  packs: number;
  onPacks: (value: number) => void;
}) {
  const { offer } = item;
  // Compare like with like: today's price for the packs the estimate needs.
  // Extra packs from MOQ rounding are a quantity change, not a price change,
  // and already have their own note below.
  const liveForNeeded = Math.round(item.offer.pricePaise * item.packsNeeded);
  const drift =
    item.estimatedPaise > 0 ? ((liveForNeeded - item.estimatedPaise) / item.estimatedPaise) * 100 : 0;

  return (
    <li className={cn("flex gap-3 p-3.5", !checked && "bg-ink-50/50")}>
      <label className="-m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center self-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Include ${offer.productName}`}
          className="size-5 accent-brand-600"
        />
      </label>

      <Link
        href={`/product/${offer.productSlug}`}
        className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-ink-50"
        tabIndex={-1}
        aria-hidden
      >
        {offer.imageUrl ? (
          <Image src={offer.imageUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <Package className="m-auto mt-5 size-6 text-ink-300" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{item.label}</p>
        <Link
          href={`/product/${offer.productSlug}`}
          className="line-clamp-2 text-sm font-bold text-ink-900 hover:text-brand-700"
        >
          {offer.productName}
        </Link>
        <p className="truncate text-xs text-ink-500">
          {offer.packLabel} · {offer.vendorName}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Stepper
            size="sm"
            value={packs}
            onChange={onPacks}
            min={offer.moq}
            step={offer.step}
            max={offer.max}
            disabled={!checked}
            label={`${offer.productName} quantity`}
            format={(v) => formatQuantity(v, offer.unit)}
          />
          <span className="text-right">
            <Money paise={Math.round(offer.pricePaise * packs)} className="block text-[15px] font-bold text-ink-900" />
            <span className="block text-[11px] text-ink-400">{formatINR(offer.pricePaise)} each</span>
          </span>
        </div>

        {item.roundedUp && (
          <p className="mt-1.5 flex gap-1.5 text-[11px] text-ink-500">
            <Info aria-hidden className="size-3.5 shrink-0" />
            Estimate needs {formatQuantity(item.packsNeeded, offer.unit)} — rounded up to the seller&apos;s
            minimum order of {formatQuantity(offer.moq, offer.unit)}
            {offer.step > 1 ? ` (sold in steps of ${formatQuantity(offer.step, offer.unit)})` : ""}.
          </p>
        )}
        {Math.abs(drift) >= PRICE_DRIFT_PERCENT && (
          <p className="mt-1 flex gap-1.5 text-[11px] text-amber-700">
            <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
            Today&apos;s price is {Math.round(Math.abs(drift))}% {drift > 0 ? "above" : "below"} the estimate (
            {formatINR(item.estimatedPaise)} estimated).
          </p>
        )}
      </div>
    </li>
  );
}
