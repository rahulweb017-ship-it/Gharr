"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { SORTS, listingHref, type ListingState, type SortKey } from "./listing-params";

/**
 * Sort control for the listing page.
 *
 * A native <select> styled as the "Sort: Popular" pill from the UI boards: the
 * OS picker is the best menu on a phone and costs nothing to make accessible.
 * The choice is written to the URL, so the listing itself stays server-rendered.
 */
export function SortSelect({
  basePath,
  state,
  className,
}: {
  basePath: string;
  state: ListingState;
  className?: string;
}) {
  const router = useRouter();
  const current = SORTS.find((s) => s.value === state.sort) ?? SORTS[0];

  return (
    <label
      className={cn(
        "relative flex h-11 min-w-0 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-800 focus-within:border-brand-600",
        className,
      )}
    >
      <ArrowUpDown aria-hidden className="size-4 shrink-0 text-ink-400" />
      <span className="truncate">
        <span className="font-medium text-ink-500">Sort: </span>
        {current.label}
      </span>
      <select
        aria-label="Sort products"
        value={state.sort}
        onChange={(e) => router.push(listingHref(basePath, state, { sort: e.target.value as SortKey }))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </label>
  );
}
