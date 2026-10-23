/**
 * Units of measure for construction materials.
 *
 * Indian building supply does not sell in tidy integers: sand goes by the tonne,
 * flooring by the square foot, tiles by the box, cement by the 50 kg bag. MOQ and
 * step quantity therefore have to be fractional and unit-aware everywhere.
 */

export type Unit =
  | "BAG"
  | "KG"
  | "TONNE"
  | "PIECE"
  | "BOX"
  | "SQFT"
  | "LITRE"
  | "BUNDLE"
  | "BUCKET"
  | "CAN"
  | "PACK";

interface UnitMeta {
  /** Short form shown next to a price: "₹385/bag". */
  short: string;
  singular: string;
  plural: string;
  /** Whether fractional quantities make sense. You cannot buy 2.5 bags. */
  allowsFraction: boolean;
  /** Sensible default step when a variant does not specify one. */
  defaultStep: number;
}

export const UNIT_META: Record<Unit, UnitMeta> = {
  BAG: { short: "bag", singular: "Bag", plural: "Bags", allowsFraction: false, defaultStep: 1 },
  KG: { short: "kg", singular: "Kilogram", plural: "Kilograms", allowsFraction: true, defaultStep: 0.5 },
  TONNE: { short: "tonne", singular: "Tonne", plural: "Tonnes", allowsFraction: true, defaultStep: 0.5 },
  PIECE: { short: "pc", singular: "Piece", plural: "Pieces", allowsFraction: false, defaultStep: 1 },
  BOX: { short: "box", singular: "Box", plural: "Boxes", allowsFraction: false, defaultStep: 1 },
  SQFT: { short: "sq.ft", singular: "Square foot", plural: "Square feet", allowsFraction: true, defaultStep: 1 },
  LITRE: { short: "L", singular: "Litre", plural: "Litres", allowsFraction: true, defaultStep: 0.5 },
  BUNDLE: { short: "bundle", singular: "Bundle", plural: "Bundles", allowsFraction: false, defaultStep: 1 },
  // Containers sold whole. Pricing per litre on a 20 L bucket overstated the
  // per-litre price twentyfold, so the unit is the container itself.
  BUCKET: { short: "bucket", singular: "Bucket", plural: "Buckets", allowsFraction: false, defaultStep: 1 },
  CAN: { short: "can", singular: "Can", plural: "Cans", allowsFraction: false, defaultStep: 1 },
  PACK: { short: "pack", singular: "Pack", plural: "Packs", allowsFraction: false, defaultStep: 1 },
};

/** "5 bags", "2.5 tonnes", "1 box". */
export function formatQuantity(quantity: number, unit: Unit): string {
  const meta = UNIT_META[unit];
  const value = meta.allowsFraction
    ? String(Number(quantity.toFixed(3)))
    : String(Math.round(quantity));
  return `${value} ${meta.short}`;
}

/** Price suffix for listing and detail pages: "/bag", "/sq.ft". */
export function perUnitLabel(unit: Unit): string {
  return `/${UNIT_META[unit].short}`;
}

export interface QuantityRules {
  moq: number;
  step: number;
  max?: number | null;
  unit: Unit;
}

export type QuantityValidation =
  | { ok: true; quantity: number }
  | { ok: false; reason: string; suggestion: number };

/**
 * Validates a requested quantity against a variant's MOQ, step and ceiling.
 *
 * Always returns a usable `suggestion` so the UI can offer a corrected value
 * rather than only rejecting — "minimum 10 bags, set to 10" beats an error toast.
 */
export function validateQuantity(
  requested: number,
  rules: QuantityRules,
): QuantityValidation {
  const meta = UNIT_META[rules.unit];

  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: false, reason: "Enter a quantity greater than zero", suggestion: rules.moq };
  }

  if (!meta.allowsFraction && !Number.isInteger(requested)) {
    return {
      ok: false,
      reason: `${meta.plural} cannot be split — use a whole number`,
      suggestion: Math.max(rules.moq, Math.ceil(requested)),
    };
  }

  if (requested < rules.moq) {
    return {
      ok: false,
      reason: `Minimum order is ${formatQuantity(rules.moq, rules.unit)}`,
      suggestion: rules.moq,
    };
  }

  if (rules.max != null && requested > rules.max) {
    return {
      ok: false,
      reason: `Maximum order is ${formatQuantity(rules.max, rules.unit)}`,
      suggestion: rules.max,
    };
  }

  // Step is measured from the MOQ, not from zero: a variant with MOQ 10 and
  // step 5 allows 10, 15, 20 — not 5.
  const stepsFromMoq = (requested - rules.moq) / rules.step;
  if (Math.abs(stepsFromMoq - Math.round(stepsFromMoq)) > 1e-6) {
    const snapped = rules.moq + Math.ceil(stepsFromMoq) * rules.step;
    return {
      ok: false,
      reason: `Sold in steps of ${formatQuantity(rules.step, rules.unit)}`,
      suggestion: rules.max != null ? Math.min(snapped, rules.max) : snapped,
    };
  }

  return { ok: true, quantity: requested };
}

/** Rounds any input up to the nearest permissible quantity. */
export function snapQuantity(requested: number, rules: QuantityRules): number {
  const result = validateQuantity(requested, rules);
  return result.ok ? result.quantity : result.suggestion;
}

/**
 * Total weight of a line, used by the freight rules for heavy materials.
 * Returns null when the variant has no weight recorded.
 */
export function lineWeightKg(
  quantity: number,
  weightKgPerUnit: number | null | undefined,
): number | null {
  if (weightKgPerUnit == null) return null;
  return Number((quantity * weightKgPerUnit).toFixed(3));
}
