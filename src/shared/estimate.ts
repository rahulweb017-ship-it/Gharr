import { lineTotalPaise, percentOfPaise, PAISE_PER_RUPEE } from "./money";
import type { Unit } from "./units";

/**
 * Estimate Engine — the pure calculation.
 *
 * Given validated inputs, the quantity norms for the chosen mode/scope/tier and
 * the local price table, produce an itemised estimate where every figure is
 * `quantity × unit price` and can be checked by hand. There is deliberately no
 * model, no fudge factor and no hidden adjustment: the build plan's first risk
 * is trust, and a number the customer cannot audit is a number they will not
 * believe.
 *
 * No Prisma and no I/O, so the React Native app runs exactly the same maths.
 */

export type EstimateMode = "NEW_BUILD" | "RENOVATION";
export type EstimateScope = "WHOLE_HOUSE" | "BATHROOM" | "KITCHEN" | "FLOORING" | "PAINTING";
export type QualityTier = "BASIC" | "STANDARD" | "PREMIUM";
export type EstimateBucket = "MATERIALS" | "LABOUR" | "OTHER";
export type QuantityBasis =
  | "BUILTUP_SQFT"
  | "FLOOR_SQFT"
  | "WALL_SQFT"
  | "PER_ROOM"
  | "PER_BATHROOM"
  | "PER_FLOOR"
  | "FIXED"
  | "PERCENT_OF_SUBTOTAL";

/**
 * Paintable wall area per sq ft of floor, for a typical Indian residence with
 * ~10 ft floor-to-ceiling height, both faces of internal walls, and door and
 * window openings deducted. The commonly quoted thumb rule is 2.5–3.5×; 2.8 is
 * the midpoint used by most contractor BOQs.
 */
export const WALL_FACTOR = 2.8;

export const TIER_LABELS: Record<QualityTier, string> = {
  BASIC: "Basic",
  STANDARD: "Standard",
  PREMIUM: "Premium",
};

export const SCOPE_LABELS: Record<EstimateScope, string> = {
  WHOLE_HOUSE: "New home construction",
  BATHROOM: "Bathroom renovation",
  KITCHEN: "Kitchen renovation",
  FLOORING: "Flooring",
  PAINTING: "Painting",
};

export const BUCKET_LABELS: Record<EstimateBucket, string> = {
  MATERIALS: "Materials",
  LABOUR: "Labour",
  OTHER: "Other costs",
};

export const ESTIMATE_DISCLAIMER =
  "Indicative estimate, pending professional verification. Actual costs vary with site conditions, design and material choices.";

/** The physical quantities a rule can be based on. */
export interface EstimateMeasures {
  builtUpSqft: number;
  floorSqft: number;
  wallSqft: number;
  rooms: number;
  bathrooms: number;
  floors: number;
}

export interface EstimateRuleInput {
  itemKey: string;
  label: string;
  bucket: EstimateBucket;
  basis: QuantityBasis;
  quantityPerBasis: number;
  unit: Unit | null;
  wastagePercent: number;
  sortOrder: number;
}

export interface EstimatePriceInput {
  itemKey: string;
  unitPricePaise: number;
  productId: string | null;
  packCoverage: number;
}

export interface ComputedLine {
  itemKey: string;
  label: string;
  bucket: EstimateBucket;
  basis: QuantityBasis;
  /** Rule units for normal lines; the percentage for PERCENT_OF_SUBTOTAL. */
  quantity: number;
  unit: Unit | null;
  /** Per rule unit; for percentage lines, the subtotal the percentage applies to. */
  unitPricePaise: number;
  amountPaise: number;
  productId: string | null;
  packCoverage: number;
  sortOrder: number;
}

export interface ComputedEstimate {
  lines: ComputedLine[];
  materialsPaise: number;
  labourPaise: number;
  otherPaise: number;
  totalPaise: number;
}

export class MissingPriceError extends Error {
  readonly itemKeys: string[];
  constructor(itemKeys: string[]) {
    super(`No local price for: ${itemKeys.join(", ")}`);
    this.name = "MissingPriceError";
    this.itemKeys = itemKeys;
  }
}

/**
 * Decimal places a quantity is rounded UP to. Bags, pieces and boxes are whole;
 * sand is ordered to the tenth of a tonne. Rounding is always upwards — a short
 * estimate is worse than a slightly generous one.
 */
const UNIT_DECIMALS: Record<Unit, number> = {
  BAG: 0,
  PIECE: 0,
  BOX: 0,
  BUNDLE: 0,
  BUCKET: 0,
  CAN: 0,
  PACK: 0,
  KG: 0,
  SQFT: 0,
  TONNE: 1,
  LITRE: 1,
};

/**
 * Estimate lines are quoted in whole rupees, as contractor BOQs are: "₹21,058"
 * rather than "₹21,058.38". Rounding happens once per line, so the total is the
 * exact sum of the figures the customer can see.
 */
export function toWholeRupees(paise: number): number {
  return Math.round(paise / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

export function roundUpQuantity(value: number, unit: Unit | null): number {
  const decimals = unit ? UNIT_DECIMALS[unit] : 2;
  const factor = 10 ** decimals;
  // The epsilon stops 12.000000001 (a float artefact) becoming 13.
  return Math.ceil(value * factor - 1e-9) / factor;
}

export function basisValue(basis: QuantityBasis, m: EstimateMeasures): number {
  switch (basis) {
    case "BUILTUP_SQFT":
      return m.builtUpSqft;
    case "FLOOR_SQFT":
      return m.floorSqft;
    case "WALL_SQFT":
      return m.wallSqft;
    case "PER_ROOM":
      return m.rooms;
    case "PER_BATHROOM":
      return m.bathrooms;
    case "PER_FLOOR":
      return m.floors;
    case "FIXED":
      return 1;
    case "PERCENT_OF_SUBTOTAL":
      return 0;
  }
}

export function computeEstimate(
  measures: EstimateMeasures,
  rules: EstimateRuleInput[],
  prices: EstimatePriceInput[],
): ComputedEstimate {
  const priceByKey = new Map(prices.map((p) => [p.itemKey, p]));
  const ordered = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);

  const quantityRules = ordered.filter((r) => r.basis !== "PERCENT_OF_SUBTOTAL");
  const percentRules = ordered.filter((r) => r.basis === "PERCENT_OF_SUBTOTAL");

  const missing = quantityRules
    .filter((r) => !priceByKey.has(r.itemKey))
    .map((r) => r.itemKey);
  if (missing.length) throw new MissingPriceError(missing);

  const lines: ComputedLine[] = [];

  for (const rule of quantityRules) {
    const price = priceByKey.get(rule.itemKey)!;
    const raw =
      basisValue(rule.basis, measures) *
      rule.quantityPerBasis *
      (1 + rule.wastagePercent / 100);
    const quantity = roundUpQuantity(raw, rule.unit);

    // A room count of zero legitimately removes a line (no bathrooms, no WC).
    if (quantity <= 0) continue;

    lines.push({
      itemKey: rule.itemKey,
      label: rule.label,
      bucket: rule.bucket,
      basis: rule.basis,
      quantity,
      unit: rule.unit,
      unitPricePaise: price.unitPricePaise,
      amountPaise: toWholeRupees(lineTotalPaise(price.unitPricePaise, quantity)),
      productId: price.productId,
      packCoverage: price.packCoverage,
      sortOrder: rule.sortOrder,
    });
  }

  // Percentages (design fees, contingency, sundries) apply to the itemised
  // subtotal only — never to each other, so the order they are listed in cannot
  // change the total.
  const subtotal = lines.reduce((sum, l) => sum + l.amountPaise, 0);

  for (const rule of percentRules) {
    const amount = toWholeRupees(percentOfPaise(subtotal, rule.quantityPerBasis));
    if (amount <= 0) continue;
    lines.push({
      itemKey: rule.itemKey,
      label: rule.label,
      bucket: rule.bucket,
      basis: rule.basis,
      quantity: rule.quantityPerBasis,
      unit: null,
      unitPricePaise: subtotal,
      amountPaise: amount,
      productId: null,
      packCoverage: 1,
      sortOrder: rule.sortOrder,
    });
  }

  lines.sort((a, b) => a.sortOrder - b.sortOrder);

  const sumBucket = (bucket: EstimateBucket) =>
    lines.filter((l) => l.bucket === bucket).reduce((sum, l) => sum + l.amountPaise, 0);

  const materialsPaise = sumBucket("MATERIALS");
  const labourPaise = sumBucket("LABOUR");
  const otherPaise = sumBucket("OTHER");

  return {
    lines,
    materialsPaise,
    labourPaise,
    otherPaise,
    totalPaise: materialsPaise + labourPaise + otherPaise,
  };
}

/**
 * Number of purchasable packs needed to cover an estimated quantity: 420 sq ft
 * of tile in 16 sq ft boxes is 27 boxes, not 26.25.
 */
export function packsForQuantity(quantity: number, packCoverage: number): number {
  if (packCoverage <= 0) return Math.ceil(quantity);
  return Math.ceil(quantity / packCoverage - 1e-9);
}

/** Share of the total, as a whole-number percentage for the breakdown rows. */
export function shareOfTotal(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Price of ONE rule unit derived from a catalogue pack: a ₹640 box covering
 * 16 sq ft prices tile at ₹40 per sq ft. Shared by the seed and the admin
 * "sync from shop" action so the two can never disagree on the rounding.
 *
 * A non-positive coverage is a data error (it would divide by zero or flip the
 * sign), so it throws rather than guessing. A positive pack price never rounds
 * down to a free unit — a zero-priced line would silently vanish from totals.
 */
export function deriveUnitPricePaise(packPricePaise: number, packCoverage: number): number {
  if (!Number.isFinite(packCoverage) || packCoverage <= 0) {
    throw new RangeError(`packCoverage must be positive, got ${packCoverage}`);
  }
  if (!Number.isFinite(packPricePaise) || packPricePaise < 0) {
    throw new RangeError(`packPricePaise must be a non-negative number, got ${packPricePaise}`);
  }
  const unit = Math.round(packPricePaise / packCoverage);
  return packPricePaise > 0 ? Math.max(1, unit) : 0;
}
