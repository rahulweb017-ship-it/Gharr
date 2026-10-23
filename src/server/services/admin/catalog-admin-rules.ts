/**
 * Pure rules for admin catalogue edits, kept apart from the service so they are
 * unit-tested without a database.
 */

/**
 * Cross-field rules for a variant edit, checked against the merged result so a
 * price-only change cannot slip under the existing MRP.
 */
export function variantEditErrors(merged: {
  pricePaise: number;
  mrpPaise: number;
  quantityAvailable: number;
  lowStockThreshold: number;
  /** False for count units (bags, pieces): stock must then be whole. */
  allowsFraction?: boolean;
}): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  if (!Number.isInteger(merged.pricePaise) || merged.pricePaise <= 0) {
    errors.push({ field: "pricePaise", message: "Price must be a positive whole number of paise" });
  }
  if (!Number.isInteger(merged.mrpPaise) || merged.mrpPaise <= 0) {
    errors.push({ field: "mrpPaise", message: "MRP must be a positive whole number of paise" });
  } else if (merged.mrpPaise < merged.pricePaise) {
    errors.push({ field: "mrpPaise", message: "MRP cannot be lower than the selling price" });
  }
  if (!Number.isFinite(merged.quantityAvailable) || merged.quantityAvailable < 0) {
    errors.push({ field: "quantityAvailable", message: "Stock cannot be negative" });
  } else if (merged.allowsFraction === false && !Number.isInteger(merged.quantityAvailable)) {
    errors.push({ field: "quantityAvailable", message: "Stock must be a whole number for this unit" });
  }
  if (!Number.isFinite(merged.lowStockThreshold) || merged.lowStockThreshold < 0) {
    errors.push({ field: "lowStockThreshold", message: "Low-stock threshold cannot be negative" });
  }
  return errors;
}

/** Only the keys whose value differs — the audit before/after pair. */
export function changedFields<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (after[key] !== undefined && after[key] !== before[key]) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}
