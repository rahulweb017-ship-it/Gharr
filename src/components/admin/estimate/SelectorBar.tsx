import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * GET-form selector for a rule or price set. Unlike FilterBar there is no "All"
 * option — each table is exactly one mode/scope/tier or one city/tier.
 */
export function SelectorBar({
  action,
  hidden,
  selects,
}: {
  action: string;
  hidden?: Record<string, string>;
  selects: Array<{ name: string; label: string; value: string; options: ReadonlyArray<{ value: string; label: string }> }>;
}) {
  const field = cn(inputClass, "h-10 w-auto min-w-40 pr-8 text-sm");
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-(--radius-card) border border-ink-100 bg-white p-3">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {selects.map((s) => (
        <label key={s.name} className="flex flex-col gap-1 text-xs font-semibold text-ink-500">
          {s.label}
          <select name={s.name} defaultValue={s.value} className={field}>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800">
        Show
      </button>
    </form>
  );
}
