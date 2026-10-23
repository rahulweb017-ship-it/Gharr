import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Vertical progress timeline for order and booking tracking.
 *
 * Completed steps are green check circles (green = done, per the design
 * tokens), pending steps are hollow, and a failed/cancelled step is red. The
 * caller decides each step's state from recorded events; this only draws it.
 */

export type TimelineState = "done" | "pending" | "failed";

export interface TimelineItem {
  key: string;
  label: string;
  state: TimelineState;
  /** Highlights the step the order/booking is currently at. */
  current?: boolean;
  /** Timestamp or expectation line under the label. */
  detail?: string | null;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={className}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        // The connector below a step is green only when the next step is done too.
        const nextDone = !last && items[index + 1].state === "done";

        return (
          <li
            key={item.key}
            className="flex gap-3"
            aria-current={item.current ? "step" : undefined}
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  item.state === "done" && "border-trust-600 bg-trust-600 text-white",
                  item.state === "failed" && "border-red-600 bg-red-600 text-white",
                  item.state === "pending" &&
                    (item.current ? "border-ink-900 bg-white" : "border-ink-300 bg-white"),
                )}
              >
                {item.state === "done" && (
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                )}
                {item.state === "failed" && (
                  <X aria-hidden className="size-3.5" strokeWidth={3} />
                )}
              </span>
              {!last && (
                <span
                  aria-hidden
                  className={cn("min-h-5 w-0.5 flex-1", nextDone ? "bg-trust-600" : "bg-ink-100")}
                />
              )}
            </div>

            <div className={cn("-mt-0.5 min-w-0", !last && "pb-4")}>
              <p
                className={cn(
                  "text-sm font-semibold",
                  item.state === "done" && "text-ink-900",
                  item.state === "pending" && (item.current ? "text-ink-900" : "text-ink-400"),
                  item.state === "failed" && "text-red-700",
                )}
              >
                {item.label}
              </p>
              {item.detail && <p className="text-xs text-ink-500">{item.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
