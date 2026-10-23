import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import { AdminNav } from "./AdminNav";
import type { StaffLevel } from "@/server/services/admin/guard";

/**
 * Admin console frame: a navy sidebar (icon rail on tablets, full labels from
 * lg) and a light content area. Desktop-first by design — admins work at a desk
 * — but it stays usable down to tablet width.
 */
export function AdminShell({
  name,
  level,
  children,
}: {
  name: string;
  level: StaffLevel;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col bg-ink-950 text-white lg:w-60">
        <Link href="/admin" className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <span className="rounded-lg bg-white p-1">
            <LogoMark className="size-6" />
          </span>
          <span className="hidden text-base font-extrabold lg:inline">
            Home<span className="text-brand-400">all</span>
            <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-200 uppercase">
              Admin
            </span>
          </span>
        </Link>

        <AdminNav level={level} />

        <div className="mt-auto border-t border-white/10 p-3">
          <div className="hidden px-1 pb-2 lg:block">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-ink-300">{level === "ADMIN" ? "Administrator" : "Support"}</p>
          </div>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ink-200 hover:bg-white/10 lg:justify-start"
            title="Back to app"
          >
            <ArrowLeft aria-hidden className="size-4" />
            <span className="hidden lg:inline">Back to app</span>
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-8">{children}</main>
    </div>
  );
}

/** Page heading used on every admin screen. */
export function AdminPageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
            <ArrowLeft aria-hidden className="size-4" /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
