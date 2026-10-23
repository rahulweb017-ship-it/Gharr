import { lineTotalPaise, percentOfPaise } from "@/shared/money";

/**
 * Labour booking pricing.
 *
 * Always the tuple (rateType, amount, quantity):
 *   HOURLY -> quantity is hours
 *   DAILY  -> quantity is days
 *   FIXED  -> quantity is 1, amount is the agreed job price
 *
 * The FIXED branch is implemented and tested now even though no UI exposes it,
 * so enabling fixed-price jobs in V2 is a UI change rather than a pricing rewrite.
 */
export interface BookingPricingInput {
  rateType: "HOURLY" | "DAILY" | "FIXED";
  rateAmountPaise: number;
  /** Hours, days, or 1 for a fixed job. */
  quantity: number;
  /** The worker's minimum billable units — most charge a 2-hour minimum. */
  minUnits: number;
  extras?: Array<{ description: string; quantity: number; unitAmountPaise: number }>;
  platformFeePercent: number;
  discountPaise?: number;
}

export interface BookingPricing {
  billableQuantity: number;
  labourSubtotalPaise: number;
  extrasPaise: number;
  platformFeePaise: number;
  discountPaise: number;
  estimatedTotalPaise: number;
  /** True when the minimum charge exceeded the requested duration. */
  minimumApplied: boolean;
}

export function priceBooking(input: BookingPricingInput): BookingPricing {
  const {
    rateType,
    rateAmountPaise,
    quantity,
    minUnits,
    extras = [],
    platformFeePercent,
    discountPaise = 0,
  } = input;

  // A fixed-price job is a single agreed amount; minimums do not apply.
  const billableQuantity =
    rateType === "FIXED" ? 1 : Math.max(quantity, minUnits);
  const minimumApplied = rateType !== "FIXED" && billableQuantity > quantity;

  const labourSubtotalPaise = lineTotalPaise(rateAmountPaise, billableQuantity);

  const extrasPaise = extras.reduce(
    (sum, extra) => sum + lineTotalPaise(extra.unitAmountPaise, extra.quantity),
    0,
  );

  const platformFeePaise = percentOfPaise(
    labourSubtotalPaise + extrasPaise,
    platformFeePercent,
  );

  const cappedDiscount = Math.min(
    discountPaise,
    labourSubtotalPaise + extrasPaise,
  );

  return {
    billableQuantity,
    labourSubtotalPaise,
    extrasPaise,
    platformFeePaise,
    discountPaise: cappedDiscount,
    estimatedTotalPaise:
      labourSubtotalPaise + extrasPaise + platformFeePaise - cappedDiscount,
    minimumApplied,
  };
}
