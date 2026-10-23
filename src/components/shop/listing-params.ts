import type { ProductFilters } from "@/server/services/catalog.service";
import type { DeliveryMode } from "./delivery";

/**
 * Listing state <-> URL.
 *
 * Filters and sort live in the query string so the listing stays a Server
 * Component and every filtered view is shareable and back-button friendly.
 * Prices in the URL are whole rupees (what a person types); the service takes
 * paise, so conversion happens only here.
 */

export const SORTS = [
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
] as const;

export type SortKey = (typeof SORTS)[number]["value"];

const DELIVERY_MODES: readonly DeliveryMode[] = ["STANDARD", "SCHEDULED", "PICKUP"];

export interface ListingState {
  q: string;
  sort: SortKey;
  brands: string[];
  /** Whole rupees. */
  min: number | null;
  max: number | null;
  delivery: DeliveryMode[];
  inStock: boolean;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  const raw = first(value);
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function rupees(value: string | string[] | undefined): number | null {
  const n = Number(first(value));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function parseListingParams(params: RawSearchParams): ListingState {
  const sort = first(params.sort);
  return {
    q: (first(params.q) ?? "").trim().slice(0, 80),
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortKey) : "popular",
    brands: list(params.brand),
    min: rupees(params.min),
    max: rupees(params.max),
    delivery: list(params.delivery).filter((m): m is DeliveryMode =>
      (DELIVERY_MODES as readonly string[]).includes(m),
    ),
    inStock: first(params.inStock) === "1",
    page: Math.max(1, Math.floor(Number(first(params.page)) || 1)),
  };
}

/** Maps URL state onto the catalogue service's filter shape. */
export function toProductFilters(state: ListingState): Omit<ProductFilters, "categorySlug" | "perPage"> {
  return {
    sort: state.sort,
    search: state.q || undefined,
    brandSlugs: state.brands.length ? state.brands : undefined,
    minPricePaise: state.min != null ? state.min * 100 : undefined,
    maxPricePaise: state.max != null ? state.max * 100 : undefined,
    deliveryModes: state.delivery.length ? state.delivery : undefined,
    inStockOnly: state.inStock || undefined,
    page: state.page,
  };
}

/** Any change other than paging sends the shopper back to page 1. */
export function listingHref(
  basePath: string,
  state: ListingState,
  patch: Partial<ListingState> = {},
): string {
  const next = { ...state, ...(("page" in patch) ? {} : { page: 1 }), ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.sort !== "popular") params.set("sort", next.sort);
  if (next.brands.length) params.set("brand", next.brands.join(","));
  if (next.min != null) params.set("min", String(next.min));
  if (next.max != null) params.set("max", String(next.max));
  if (next.delivery.length) params.set("delivery", next.delivery.join(","));
  if (next.inStock) params.set("inStock", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Number of active filters, for the badge on the Filters button. */
export function activeFilterCount(state: ListingState): number {
  return (
    state.brands.length +
    state.delivery.length +
    (state.min != null || state.max != null ? 1 : 0) +
    (state.inStock ? 1 : 0)
  );
}
