"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Search input.
 *
 * Submits on enter rather than searching per keystroke: the trigram query hits
 * the database, and on a patchy site connection a request per character is both
 * slow and wasteful. The result is a plain URL, so results are shareable.
 */
export function SearchBox({
  initialQuery,
  autoFocus,
  placeholder = "Search cement, tiles, paint...",
  className,
}: {
  initialQuery: string;
  /** Defaults to focusing when the box is empty, as on the search page. */
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <form onSubmit={submit} className={className ?? "flex-1"} role="search">
      <div className="flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 focus-within:border-brand-600">
        <Search aria-hidden className="size-[18px] shrink-0 text-ink-400" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Search products"
          autoFocus={autoFocus ?? !initialQuery}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              router.push("/search");
            }}
            aria-label="Clear search"
            className="shrink-0 text-ink-300 hover:text-ink-600"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}
