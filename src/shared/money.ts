/**
 * Money handling for Gharr.
 *
 * Every monetary value in the system is an integer number of paise. Rupee floats
 * are never stored, never summed and never passed between layers — 0.1 + 0.2
 * problems in a marketplace ledger are unfixable after the fact.
 *
 * This module is imported by the API, the web UI and (later) the React Native
 * app, so it must stay free of platform-specific APIs.
 */

export const PAISE_PER_RUPEE = 100;

/** Rupees (a display concept) to paise (the storage concept). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** Paise to rupees as a float. For DISPLAY ONLY — never feed this back into maths. */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * Formats paise as Indian currency with lakh/crore digit grouping:
 * 38500 -> "₹385", 125000000 -> "₹12,50,000".
 *
 * Whole rupees drop the decimals, because "₹385.00" for a cement bag reads like
 * a spreadsheet rather than a price tag.
 */
export function formatINR(
  paise: number,
  options: { showPaise?: boolean; showSymbol?: boolean } = {},
): string {
  const { showPaise = false, showSymbol = true } = options;
  const negative = paise < 0;
  const absolute = Math.abs(paise);

  const rupees = Math.floor(absolute / PAISE_PER_RUPEE);
  const remainder = absolute % PAISE_PER_RUPEE;
  const needsPaise = showPaise || remainder !== 0;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: needsPaise ? 2 : 0,
    maximumFractionDigits: needsPaise ? 2 : 0,
  }).format(needsPaise ? absolute / PAISE_PER_RUPEE : rupees);

  return `${negative ? "-" : ""}${showSymbol ? "₹" : ""}${formatted}`;
}

/**
 * Compact form for dense UI such as listing cards: ₹1.2L, ₹3.4Cr.
 * Falls back to the full format below one lakh, where abbreviating helps nobody.
 */
export function formatINRCompact(paise: number): string {
  const rupees = Math.abs(paise) / PAISE_PER_RUPEE;
  const sign = paise < 0 ? "-" : "";

  if (rupees >= 1_00_00_000) {
    return `${sign}₹${trimZero(rupees / 1_00_00_000)}Cr`;
  }
  if (rupees >= 1_00_000) {
    return `${sign}₹${trimZero(rupees / 1_00_000)}L`;
  }
  return formatINR(paise);
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * Multiplies a unit price by a fractional quantity (2.5 boxes of tiles) and
 * rounds to whole paise. Rounding happens once, here, at the line level — never
 * repeatedly down a chain of derived values.
 */
export function lineTotalPaise(
  unitPricePaise: number,
  quantity: number,
): number {
  return Math.round(unitPricePaise * quantity);
}

/** Percentage of an amount, rounded to whole paise. Used for tax and commission. */
export function percentOfPaise(paise: number, percent: number): number {
  return Math.round((paise * percent) / 100);
}

/**
 * Extracts the tax component from a tax-EXCLUSIVE amount.
 * Catalogue prices are stored exclusive of GST and displayed inclusive.
 */
export function taxOnExclusivePaise(
  exclusivePaise: number,
  taxRatePercent: number,
): number {
  return percentOfPaise(exclusivePaise, taxRatePercent);
}

/** Inverse of the above, for the rare case of a tax-inclusive input. */
export function taxFromInclusivePaise(
  inclusivePaise: number,
  taxRatePercent: number,
): number {
  return Math.round(
    inclusivePaise - inclusivePaise / (1 + taxRatePercent / 100),
  );
}

/**
 * Distributes a group-level discount across lines in proportion to their value,
 * guaranteeing the parts sum exactly to the whole.
 *
 * Naive per-line rounding loses or invents paise, which later shows up as a
 * refund that does not reconcile. The remainder is handed to the largest lines
 * first (largest-remainder method), so the discrepancy lands where it is least
 * visible.
 */
export function prorate(totalPaise: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0 || totalPaise === 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((w) => (totalPaise * w) / weightSum);
  const floored = exact.map(Math.floor);
  let remainder = totalPaise - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] += 1;
    remainder -= 1;
  }

  return result;
}

/** Guard used at checkout so no single order can overflow its Int paise column. */
export function assertWithinMoneyRange(paise: number, maxPaise: number): void {
  if (!Number.isSafeInteger(paise)) {
    throw new Error(`Money value is not an integer: ${paise}`);
  }
  if (paise < 0) {
    throw new Error(`Money value cannot be negative: ${paise}`);
  }
  if (paise > maxPaise) {
    throw new Error(
      `Amount ${formatINR(paise)} exceeds the maximum of ${formatINR(maxPaise)}`,
    );
  }
}
