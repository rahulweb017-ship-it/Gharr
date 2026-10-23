import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** The wizard's numbered step header: ①—②—③—④ with labels underneath. */
export function ProgressSteps({
  steps,
  current,
  className,
}: {
  steps: readonly string[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
}) {
  return (
    <ol
      aria-label="Progress"
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="relative flex flex-col items-center gap-1.5">
            {/* Connector to the next step, drawn from this circle's centre. */}
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2",
                  done ? "bg-ink-900" : "bg-ink-100",
                )}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full text-sm font-bold",
                (done || active) && "bg-ink-900 text-white",
                active && "ring-4 ring-ink-100",
                !done && !active && "bg-ink-100 text-ink-400",
              )}
            >
              {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                "text-center text-[11px] font-semibold",
                active ? "text-ink-900" : "text-ink-400",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
