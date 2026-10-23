import { cn } from "@/lib/cn";
import { formatINR } from "@/shared/money";
import { perUnitLabel } from "@/shared/units";
import type { Unit } from "@/shared/units";

/**
 * The only component that renders a price.
 *
 * Centralising this is what makes "transparent pricing" (blueprint section 11)
 * enforceable rather than aspirational: a struck-through MRP can never appear
 * without its discount, and every figure uses the same lakh/crore grouping and
 * tabular digits.
 */

interface MoneyProps {
  paise: number;
  className?: string;
  showPaise?: boolean;
}

export function Money({ paise, className, showPaise }: MoneyProps) {
  return (
    <span className={cn("tabular", className)}>
      {formatINR(paise, { showPaise })}
    </span>
  );
}

interface PriceProps {
  pricePaise: number;
  mrpPaise?: number;
  unit?: Unit;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const PRICE_SIZES = {
  sm: { price: "text-[15px]", mrp: "text-xs", unit: "text-xs" },
  md: { price: "text-lg", mrp: "text-sm", unit: "text-sm" },
  lg: { price: "text-2xl", mrp: "text-base", unit: "text-sm" },
} as const;

/**
 * Price with optional struck-through MRP and per-unit suffix.
 * The discount badge only renders when there is a genuine saving.
 */
export function Price({
  pricePaise,
  mrpPaise,
  unit,
  size = "md",
  className,
}: PriceProps) {
  const sizes = PRICE_SIZES[size];
  const hasDiscount = mrpPaise != null && mrpPaise > pricePaise;
  const percentOff = hasDiscount
    ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100)
    : 0;

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className={cn("font-bold text-ink-900 tabular", sizes.price)}>
        {formatINR(pricePaise)}
      </span>

      {unit && (
        <span className={cn("font-medium text-ink-500", sizes.unit)}>
          {perUnitLabel(unit)}
        </span>
      )}

      {hasDiscount && (
        <>
          <span className={cn("text-ink-400 line-through tabular", sizes.mrp)}>
            {formatINR(mrpPaise)}
          </span>
          {/* Only worth the visual noise once the saving is meaningful. */}
          {percentOff >= 3 && (
            <span className={cn("font-semibold text-trust-700", sizes.mrp)}>
              {percentOff}% off
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** A labelled row in a cart or invoice summary. */
export function MoneyRow({
  label,
  paise,
  emphasis = false,
  free = false,
  note,
}: {
  label: string;
  paise: number;
  emphasis?: boolean;
  free?: boolean;
  note?: string;
}) {
  const isDiscount = paise < 0;

  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span
        className={cn(
          "text-sm",
          emphasis ? "font-semibold text-ink-900" : "text-ink-600",
        )}
      >
        {label}
        {note && <span className="ml-1 text-xs text-ink-400">{note}</span>}
      </span>

      {free ? (
        <span className="text-sm font-semibold text-trust-700">FREE</span>
      ) : (
        <span
          className={cn(
            "tabular",
            emphasis ? "text-base font-bold text-ink-900" : "text-sm text-ink-800",
            isDiscount && "text-trust-700",
          )}
        >
          {isDiscount ? `− ${formatINR(Math.abs(paise))}` : formatINR(paise)}
        </span>
      )}
    </div>
  );
}
