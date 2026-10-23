"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The − qty + control used by cart rows, product detail and the material list.
 *
 * It only moves in whole steps from `min`, so it can never produce a quantity
 * that breaks MOQ/step rules; the server still re-validates every change.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  step = 1,
  max,
  disabled,
  size = "md",
  label = "Quantity",
  format = (v) => String(Number(v.toFixed(3))),
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  max?: number | null;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
  format?: (value: number) => string;
}) {
  const round = (v: number) => Number(v.toFixed(3));
  const canDecrease = !disabled && value - step >= min - 1e-9;
  const canIncrease = !disabled && (max == null || value + step <= max + 1e-9);

  const box = size === "sm" ? "size-8" : "size-10";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-xl border border-ink-200 bg-white",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => canDecrease && onChange(round(value - step))}
        disabled={!canDecrease}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className={cn(
          box,
          "flex items-center justify-center rounded-l-xl text-ink-700 hover:bg-ink-50 disabled:text-ink-300 disabled:hover:bg-transparent",
        )}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-10 px-1 text-center font-bold whitespace-nowrap text-ink-900 tabular",
          size === "sm" ? "text-sm" : "text-[15px]",
        )}
      >
        {format(value)}
      </span>
      <button
        type="button"
        onClick={() => canIncrease && onChange(round(value + step))}
        disabled={!canIncrease}
        aria-label={`Increase ${label.toLowerCase()}`}
        className={cn(
          box,
          "flex items-center justify-center rounded-r-xl text-brand-600 hover:bg-brand-50 disabled:text-ink-300 disabled:hover:bg-transparent",
        )}
      >
        <Plus aria-hidden className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
