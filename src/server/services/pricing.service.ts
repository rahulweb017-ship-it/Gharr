import {
  assertWithinMoneyRange,
  lineTotalPaise,
  percentOfPaise,
  prorate,
  taxOnExclusivePaise,
} from "@/shared/money";

/**
 * Cart and order pricing.
 *
 * This is the highest-risk logic in the materials flow, so it is a pure module:
 * no Prisma, no Request, no React. Everything it needs is passed in, which makes
 * every rule directly unit-testable and keeps it usable from the React Native
 * app later.
 *
 * Order of operations, fixed and deliberate:
 *   1. line subtotals (tax-exclusive)
 *   2. per-vendor delivery fee
 *   3. coupon discount, computed on the goods subtotal only
 *   4. discount prorated across vendor groups, then across lines
 *   5. GST on the discounted line value
 *   6. totals
 *
 * Discount before tax matters: taxing the undiscounted amount overcharges GST,
 * which is a compliance problem rather than a rounding preference.
 */

export interface PricingLine {
  variantId: string;
  vendorId: string;
  quantity: number;
  unitPricePaise: number;
  mrpPaise: number;
  taxRatePercent: number;
}

export interface VendorDeliveryRules {
  vendorId: string;
  baseDeliveryFeePaise: number;
  perKmFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
  /** Distance to the delivery address; omit until a maps provider is wired in. */
  distanceKm?: number;
}

export interface CouponRules {
  code: string;
  type: "PERCENT" | "FLAT";
  percentValue: number | null;
  flatPaise: number | null;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  scope: "ALL" | "CATEGORY" | "VENDOR" | "LABOUR";
  vendorIds: string[];
  /** Line-to-category mapping, needed only for CATEGORY-scoped coupons. */
  categoryIds: string[];
}

export interface PricedLine extends PricingLine {
  lineSubtotalPaise: number;
  lineDiscountPaise: number;
  lineTaxPaise: number;
  lineTotalPaise: number;
}

export interface PricedVendorGroup {
  vendorId: string;
  lines: PricedLine[];
  itemsSubtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  /** Set when the group is below the vendor's minimum order value. */
  belowMinimum: { minOrderPaise: number; shortfallPaise: number } | null;
  freeDeliveryApplied: boolean;
}

export interface PricedCart {
  groups: PricedVendorGroup[];
  itemsSubtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  totalSavingsPaise: number;
  couponCode: string | null;
  couponError: string | null;
}

/**
 * Delivery fee for one vendor group.
 *
 * Heavy materials are shipped by the vendor's own vehicle, so the fee is a
 * per-vendor base plus distance. A group that clears the vendor's free-delivery
 * threshold pays nothing.
 */
export function deliveryFeeFor(
  rules: VendorDeliveryRules,
  groupSubtotalPaise: number,
): { feePaise: number; free: boolean } {
  if (
    rules.freeDeliveryAbovePaise != null &&
    groupSubtotalPaise >= rules.freeDeliveryAbovePaise
  ) {
    return { feePaise: 0, free: true };
  }

  const distanceFee =
    rules.distanceKm != null
      ? Math.round(rules.perKmFeePaise * rules.distanceKm)
      : 0;

  return { feePaise: rules.baseDeliveryFeePaise + distanceFee, free: false };
}

/**
 * Discount for a coupon against an eligible subtotal.
 * Returns zero with a reason when the coupon does not apply, so the UI can say
 * why rather than silently ignoring it.
 */
export function couponDiscountFor(
  coupon: CouponRules,
  eligibleSubtotalPaise: number,
  totalSubtotalPaise: number,
): { discountPaise: number; error: string | null } {
  if (eligibleSubtotalPaise <= 0) {
    return {
      discountPaise: 0,
      error: "This code does not apply to the items in your cart",
    };
  }

  // The minimum is judged on the whole cart, matching customer expectation:
  // "spend ₹10,000" means the order, not the discounted subset.
  if (totalSubtotalPaise < coupon.minOrderPaise) {
    return {
      discountPaise: 0,
      error: `Add items worth ₹${Math.ceil(
        (coupon.minOrderPaise - totalSubtotalPaise) / 100,
      )} more to use this code`,
    };
  }

  let discount =
    coupon.type === "PERCENT"
      ? percentOfPaise(eligibleSubtotalPaise, coupon.percentValue ?? 0)
      : (coupon.flatPaise ?? 0);

  if (coupon.maxDiscountPaise != null) {
    discount = Math.min(discount, coupon.maxDiscountPaise);
  }

  // A coupon must never exceed the value it is discounting.
  discount = Math.min(discount, eligibleSubtotalPaise);

  return { discountPaise: discount, error: null };
}

/** Which lines a coupon applies to, given its scope. */
function eligibleLineIndexes(
  lines: PricingLine[],
  coupon: CouponRules | null,
  categoryByVariant: Map<string, string>,
): Set<number> {
  const all = new Set(lines.map((_, index) => index));
  if (!coupon) return all;

  switch (coupon.scope) {
    case "VENDOR": {
      const vendors = new Set(coupon.vendorIds);
      return new Set(
        lines.flatMap((line, index) => (vendors.has(line.vendorId) ? [index] : [])),
      );
    }
    case "CATEGORY": {
      const categories = new Set(coupon.categoryIds);
      return new Set(
        lines.flatMap((line, index) =>
          categories.has(categoryByVariant.get(line.variantId) ?? "") ? [index] : [],
        ),
      );
    }
    case "LABOUR":
      // Labour coupons never apply to a materials cart.
      return new Set<number>();
    default:
      return all;
  }
}

export interface PriceCartInput {
  lines: PricingLine[];
  vendorRules: Map<string, VendorDeliveryRules>;
  coupon?: CouponRules | null;
  /** variantId -> categoryId. Only consulted for CATEGORY-scoped coupons. */
  categoryByVariant?: Map<string, string>;
  maxOrderPaise: number;
}

/**
 * Prices a whole cart, grouped by vendor.
 *
 * Grouping is not cosmetic: each vendor group becomes its own Order at checkout,
 * because vendors fulfil and ship independently.
 */
export function priceCart(input: PriceCartInput): PricedCart {
  const {
    lines,
    vendorRules,
    coupon = null,
    categoryByVariant = new Map(),
    maxOrderPaise,
  } = input;

  if (lines.length === 0) {
    return {
      groups: [],
      itemsSubtotalPaise: 0,
      deliveryFeePaise: 0,
      discountPaise: 0,
      taxPaise: 0,
      totalPaise: 0,
      totalSavingsPaise: 0,
      couponCode: null,
      couponError: null,
    };
  }

  // 1. Line subtotals.
  const subtotals = lines.map((line) =>
    lineTotalPaise(line.unitPricePaise, line.quantity),
  );
  const itemsSubtotalPaise = subtotals.reduce((a, b) => a + b, 0);

  // 2. Coupon discount over eligible lines.
  const eligible = eligibleLineIndexes(lines, coupon, categoryByVariant);
  const eligibleSubtotal = subtotals.reduce(
    (sum, value, index) => (eligible.has(index) ? sum + value : sum),
    0,
  );

  let discountTotal = 0;
  let couponError: string | null = null;

  if (coupon) {
    const result = couponDiscountFor(
      coupon,
      eligibleSubtotal,
      itemsSubtotalPaise,
    );
    discountTotal = result.discountPaise;
    couponError = result.error;
  }

  // 3. Spread the discount across eligible lines by value, so the parts sum
  //    exactly to the whole.
  const eligibleWeights = subtotals.map((value, index) =>
    eligible.has(index) ? value : 0,
  );
  const lineDiscounts = prorate(discountTotal, eligibleWeights);

  // 4. Tax on the discounted line value.
  const pricedLines: PricedLine[] = lines.map((line, index) => {
    const lineSubtotal = subtotals[index];
    const lineDiscount = lineDiscounts[index];
    const taxable = lineSubtotal - lineDiscount;
    const lineTax = taxOnExclusivePaise(taxable, line.taxRatePercent);

    return {
      ...line,
      lineSubtotalPaise: lineSubtotal,
      lineDiscountPaise: lineDiscount,
      lineTaxPaise: lineTax,
      lineTotalPaise: taxable + lineTax,
    };
  });

  // 5. Group by vendor and apply delivery.
  const byVendor = new Map<string, PricedLine[]>();
  for (const line of pricedLines) {
    const existing = byVendor.get(line.vendorId);
    if (existing) existing.push(line);
    else byVendor.set(line.vendorId, [line]);
  }

  const groups: PricedVendorGroup[] = [];

  for (const [vendorId, groupLines] of byVendor) {
    const groupSubtotal = groupLines.reduce(
      (sum, line) => sum + line.lineSubtotalPaise,
      0,
    );
    const groupDiscount = groupLines.reduce(
      (sum, line) => sum + line.lineDiscountPaise,
      0,
    );
    const groupTax = groupLines.reduce((sum, line) => sum + line.lineTaxPaise, 0);

    const rules = vendorRules.get(vendorId);
    const delivery = rules
      ? deliveryFeeFor(rules, groupSubtotal)
      : { feePaise: 0, free: false };

    const belowMinimum =
      rules && groupSubtotal < rules.minOrderPaise
        ? {
            minOrderPaise: rules.minOrderPaise,
            shortfallPaise: rules.minOrderPaise - groupSubtotal,
          }
        : null;

    const groupTotal =
      groupSubtotal - groupDiscount + groupTax + delivery.feePaise;

    assertWithinMoneyRange(groupTotal, maxOrderPaise);

    groups.push({
      vendorId,
      lines: groupLines,
      itemsSubtotalPaise: groupSubtotal,
      deliveryFeePaise: delivery.feePaise,
      discountPaise: groupDiscount,
      taxPaise: groupTax,
      totalPaise: groupTotal,
      belowMinimum,
      freeDeliveryApplied: delivery.free,
    });
  }

  const deliveryFeePaise = groups.reduce((sum, g) => sum + g.deliveryFeePaise, 0);
  const taxPaise = groups.reduce((sum, g) => sum + g.taxPaise, 0);
  const totalPaise = groups.reduce((sum, g) => sum + g.totalPaise, 0);

  // "You saved" covers both the MRP gap and the coupon.
  const mrpSavings = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(0, lineTotalPaise(line.mrpPaise - line.unitPricePaise, line.quantity)),
    0,
  );

  return {
    groups,
    itemsSubtotalPaise,
    deliveryFeePaise,
    discountPaise: discountTotal,
    taxPaise,
    totalPaise,
    totalSavingsPaise: mrpSavings + discountTotal,
    couponCode: discountTotal > 0 ? (coupon?.code ?? null) : null,
    couponError,
  };
}

// Labour booking pricing lives in shared/ because the booking form renders the
// same estimate in the browser; re-exported here so server callers have one
// pricing entry point.
export { priceBooking } from "@/shared/booking-pricing";
export type {
  BookingPricing,
  BookingPricingInput,
} from "@/shared/booking-pricing";
