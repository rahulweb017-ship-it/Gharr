import Link from "next/link";
import { cn } from "@/lib/cn";

/** KPI tile and labelled detail rows used across admin screens. */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-(--radius-card) border bg-white p-4 shadow-(--shadow-card)",
        tone === "attention" ? "border-brand-200" : "border-ink-100",
        href && "transition-shadow hover:shadow-(--shadow-raised)",
      )}
    >
      <p className="text-xs font-bold tracking-wide text-ink-400 uppercase">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-extrabold tabular", tone === "attention" ? "text-brand-700" : "text-ink-900")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function DetailList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-2.5 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-500">{item.label}</dt>
          <dd className="font-medium text-ink-900">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-(--radius-card) border border-ink-100 bg-white p-5 shadow-(--shadow-card)", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold text-ink-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
