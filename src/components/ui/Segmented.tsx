"use client";

import { cn } from "@/lib/cn";

/**
 * Segmented control — quality tier (Basic / Standard / Premium), Login / Sign up,
 * All / Near you / Top rated. The selected segment is navy, per the UI boards.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1 rounded-xl bg-ink-50 p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-lg px-3 font-semibold transition-colors",
              size === "sm" ? "h-9 text-xs" : "min-h-11 py-1.5 text-sm",
              selected ? "bg-ink-900 text-white shadow-sm" : "text-ink-600 hover:bg-white",
            )}
          >
            {option.label}
            {option.hint && (
              <span className={cn("text-[11px] font-medium", selected ? "text-ink-200" : "text-ink-400")}>
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Link-based tab row for server-rendered filters (All / Near you / Top rated). */
export function TabLinks({
  tabs,
  className,
}: {
  tabs: ReadonlyArray<{ href: string; label: string; active: boolean }>;
  className?: string;
}) {
  return (
    <nav className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}>
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            tab.active ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100",
          )}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
