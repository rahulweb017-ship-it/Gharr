import type { EstimateInput } from "@/shared/contracts/estimate";
import type { QualityTier } from "@/shared/estimate";

/**
 * Display helpers shared by the estimate screens. Kept free of JSX so both the
 * server pages and the client wizard can import them.
 */

export type RenovationScope = "BATHROOM" | "KITCHEN" | "FLOORING" | "PAINTING";

export const RENOVATION_SCOPES: ReadonlyArray<{
  value: RenovationScope;
  label: string;
  /** Helper under the area field — what "area" means for this job. */
  areaHint: string;
}> = [
  { value: "BATHROOM", label: "Bathroom", areaHint: "Floor area of the bathroom" },
  { value: "KITCHEN", label: "Kitchen", areaHint: "Floor area of the kitchen" },
  { value: "FLOORING", label: "Flooring", areaHint: "Total floor area to be re-tiled" },
  { value: "PAINTING", label: "Painting", areaHint: "Carpet area of the rooms to paint — walls are worked out for you" },
];

export const TIER_HINTS: Record<QualityTier, { short: string; line: string }> = {
  BASIC: { short: "Economy", line: "Reliable, value-for-money materials and standard finishes." },
  STANDARD: { short: "Popular", line: "Branded materials and good finishes — what most families choose." },
  PREMIUM: { short: "Top brands", line: "Premium brands, designer fittings and superior finishes." },
};

const sqft = (n: number) => `${new Intl.NumberFormat("en-IN").format(n)} sq ft`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Plot 1,200 sq ft | Built-up 1,800 sq ft · 2 floors · 3 rooms · 3 bathrooms". */
export function inputsSummary(input: EstimateInput): string {
  if (input.mode === "NEW_BUILD") {
    return [
      `Plot ${sqft(input.plotSqft)} | Built-up ${sqft(input.builtUpSqft)}`,
      plural(input.floors, "floor", "floors"),
      plural(input.rooms, "room", "rooms"),
      plural(input.bathrooms, "bathroom", "bathrooms"),
    ].join(" · ");
  }
  const scope = RENOVATION_SCOPES.find((s) => s.value === input.scope)?.label ?? input.scope;
  return `${scope} · ${sqft(input.areaSqft)}`;
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
