import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Server-rendered data table for the admin console.
 *
 * Tables are the admin's main tool, so they are plain semantic <table>s with no
 * client JS: filtering, sorting and paging are URL parameters, which makes any
 * view shareable and back-button safe. Below md each row stacks into a card.
 */

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** Hidden in the stacked mobile card. */
  hideOnMobile?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty = "Nothing to show.",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  empty?: React.ReactNode;
  caption?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-sm text-ink-500">
        {empty}
      </div>
    );
  }

  const align = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)">
      {/* md and up: a real table. */}
      <table className="hidden w-full text-sm md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-ink-50 text-xs font-bold tracking-wide text-ink-500 uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3 whitespace-nowrap", align(c.align), c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className={cn(rowHref && "cursor-pointer hover:bg-brand-50/40")}>
              {columns.map((c, i) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle text-ink-800", align(c.align), c.className)}>
                  {rowHref && i === 0 ? (
                    <Link href={rowHref(row)} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      {c.cell(row)}
                    </Link>
                  ) : (
                    c.cell(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Below md: stacked cards. */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {rows.map((row) => {
          const content = (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-4 text-sm">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-xs font-semibold text-ink-400">{c.header}</dt>
                    <dd className="text-right text-ink-800">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link href={rowHref(row)} className="block hover:bg-ink-50">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Page links that preserve every other URL parameter. */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  params,
}: {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous page">
          <ChevronLeft aria-hidden className="size-4" /> Prev
        </PageLink>
        <PageLink href={href(page + 1)} disabled={page >= pages} label="Next page">
          Next <ChevronRight aria-hidden className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 font-semibold";
  if (disabled) return <span aria-disabled className={cn(cls, "text-ink-300")}>{children}</span>;
  return (
    <Link href={href} aria-label={label} className={cn(cls, "text-ink-700 hover:bg-ink-50")}>
      {children}
    </Link>
  );
}
