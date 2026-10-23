"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { inputClass } from "@/components/ui/Field";
import { formatINR } from "@/shared/money";
import { DELIVERY_MODE_LABELS, type DeliveryMode } from "./delivery";
import { activeFilterCount, listingHref, type ListingState } from "./listing-params";

/**
 * Listing search, filter sheet (phones) and filter sidebar (md+).
 *
 * Facets come from `getFilterFacets` for the current category, so a brand only
 * appears if it actually has products here. The form edits a local draft and
 * writes it to the URL on Apply — one navigation instead of one per checkbox.
 */

export interface ListingFacets {
  brands: Array<{ slug: string; name: string }>;
  minPricePaise: number;
  maxPricePaise: number;
}

/** Search box scoped to the current listing, unlike the global SearchBox. */
export function ListingSearch({
  basePath,
  state,
  placeholder,
}: {
  basePath: string;
  state: ListingState;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(state.q);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(listingHref(basePath, state, { q: value.trim() }));
      }}
    >
      <div className="flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 focus-within:border-brand-600">
        <Search aria-hidden className="size-[18px] shrink-0 text-ink-400" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              if (state.q) router.push(listingHref(basePath, state, { q: "" }));
            }}
            aria-label="Clear search"
            className="-mr-2 flex size-9 shrink-0 items-center justify-center text-ink-300 hover:text-ink-600"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}

/** "Filters" pill that opens the bottom sheet. Hidden from md up. */
export function FiltersButton({
  basePath,
  state,
  facets,
  className,
}: {
  basePath: string;
  state: ListingState;
  facets: ListingFacets;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(state);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold",
          count ? "border-ink-900 text-ink-900" : "border-ink-200 text-ink-800",
          className,
        )}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        Filters
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-ink-900 text-[11px] text-white tabular">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filters">
        <FilterForm basePath={basePath} state={state} facets={facets} onApplied={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/** Always-visible filter column for tablets and desktops. */
export function FilterSidebar({
  basePath,
  state,
  facets,
}: {
  basePath: string;
  state: ListingState;
  facets: ListingFacets;
}) {
  return (
    <aside
      aria-label="Filters"
      className="rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)"
    >
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-ink-900">
        <SlidersHorizontal aria-hidden className="size-4 text-ink-400" />
        Filters
      </h2>
      {/* Keyed on the URL state so the draft resets after each navigation. */}
      <FilterForm key={listingHref(basePath, state)} basePath={basePath} state={state} facets={facets} />
    </aside>
  );
}

function FilterForm({
  basePath,
  state,
  facets,
  onApplied,
}: {
  basePath: string;
  state: ListingState;
  facets: ListingFacets;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const [brands, setBrands] = useState(state.brands);
  const [delivery, setDelivery] = useState<DeliveryMode[]>(state.delivery);
  const [min, setMin] = useState(state.min != null ? String(state.min) : "");
  const [max, setMax] = useState(state.max != null ? String(state.max) : "");
  const [inStock, setInStock] = useState(state.inStock);

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const toRupees = (v: string) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  function apply(event: React.FormEvent) {
    event.preventDefault();
    let lo = toRupees(min);
    let hi = toRupees(max);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    router.push(listingHref(basePath, state, { brands, delivery, min: lo, max: hi, inStock }));
    onApplied?.();
  }

  function clear() {
    router.push(
      listingHref(basePath, state, { brands: [], delivery: [], min: null, max: null, inStock: false }),
    );
    onApplied?.();
  }

  const hasPriceRange = facets.maxPricePaise > 0;

  return (
    <form onSubmit={apply} className="flex flex-col gap-5">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-800">In stock only</span>
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
          className="size-5 accent-brand-600"
        />
      </label>

      {hasPriceRange && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink-900">Price (₹)</legend>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              placeholder={`Min ${formatINR(facets.minPricePaise)}`}
              aria-label="Minimum price in rupees"
              className={cn(inputClass, "h-11 min-w-0 text-sm")}
            />
            <span aria-hidden className="text-ink-300">–</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              placeholder={`Max ${formatINR(facets.maxPricePaise)}`}
              aria-label="Maximum price in rupees"
              className={cn(inputClass, "h-11 min-w-0 text-sm")}
            />
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-bold text-ink-900">Delivery</legend>
        {(Object.keys(DELIVERY_MODE_LABELS) as DeliveryMode[]).map((mode) => (
          <CheckRow
            key={mode}
            label={DELIVERY_MODE_LABELS[mode]}
            checked={delivery.includes(mode)}
            onChange={() => setDelivery((d) => toggle(d, mode))}
          />
        ))}
      </fieldset>

      {facets.brands.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-bold text-ink-900">Brand</legend>
          <div className="max-h-64 overflow-y-auto">
            {facets.brands.map((brand) => (
              <CheckRow
                key={brand.slug}
                label={brand.name}
                checked={brands.includes(brand.slug)}
                onChange={() => setBrands((b) => toggle(b, brand.slug))}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={clear} className="flex-1">
          Clear
        </Button>
        <Button type="submit" className="flex-1">
          Apply
        </Button>
      </div>
    </form>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-[18px] shrink-0 accent-brand-600" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </label>
  );
}
