import { Search } from "lucide-react";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * GET-form filter bar. Submitting rewrites the URL, so filters work with no
 * client JavaScript and every filtered view has a shareable link.
 */
export interface FilterSelect {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export function FilterBar({
  action,
  values,
  search,
  selects = [],
  dates = false,
  hidden = {},
}: {
  action: string;
  values: Record<string, string | undefined>;
  search?: { name?: string; placeholder: string };
  selects?: FilterSelect[];
  /** Adds from/to date inputs named `from` and `to`. */
  dates?: boolean;
  /** Parameters to carry through unchanged (e.g. the active tab). */
  hidden?: Record<string, string | undefined>;
}) {
  const field = cn(inputClass, "h-10 text-sm");
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-(--radius-card) border border-ink-100 bg-white p-3">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}

      {search && (
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            name={search.name ?? "q"}
            defaultValue={values[search.name ?? "q"] ?? ""}
            placeholder={search.placeholder}
            className={cn(field, "pl-9")}
          />
        </label>
      )}

      {selects.map((s) => (
        <label key={s.name} className="flex flex-col gap-1 text-xs font-semibold text-ink-500">
          {s.label}
          <select name={s.name} defaultValue={values[s.name] ?? ""} className={cn(field, "w-auto min-w-36 pr-8")}>
            <option value="">All</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {dates && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-500">
            From
            <input type="date" name="from" defaultValue={values.from ?? ""} className={cn(field, "w-auto")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-500">
            To
            <input type="date" name="to" defaultValue={values.to ?? ""} className={cn(field, "w-auto")} />
          </label>
        </>
      )}

      <button type="submit" className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800">
        Apply
      </button>
      <a href={action} className="h-10 content-center px-2 text-sm font-semibold text-ink-500 hover:text-ink-800">
        Reset
      </a>
    </form>
  );
}
