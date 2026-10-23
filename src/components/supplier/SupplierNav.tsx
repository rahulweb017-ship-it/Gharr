"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileCheck2, LayoutDashboard, Package, Store, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

export const SUPPLIER_SECTIONS = [
  { href: "/supplier", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/supplier/orders", label: "Orders", icon: ClipboardList },
  { href: "/supplier/listings", label: "Listings", icon: Package },
  { href: "/supplier/earnings", label: "Earnings", icon: Wallet },
  { href: "/supplier/documents", label: "Documents", icon: FileCheck2 },
  { href: "/supplier/profile", label: "Business profile", icon: Store },
] as const;

function useActive() {
  const pathname = usePathname() ?? "/supplier";
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
}

/** Sidebar links from lg up. */
export function SupplierSideNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Supplier portal" className="flex flex-col gap-0.5 p-2">
      {SUPPLIER_SECTIONS.map(({ href, label, icon: Icon, ...rest }) => {
        const active = isActive(href, "exact" in rest);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              active ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontally scrolling tabs below the top bar on phones and tablets. */
export function SupplierTabNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Supplier portal" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
      {SUPPLIER_SECTIONS.map(({ href, label, icon: Icon, ...rest }) => {
        const active = isActive(href, "exact" in rest);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap",
              active ? "bg-brand-600 text-white" : "bg-white/10 text-ink-100",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
