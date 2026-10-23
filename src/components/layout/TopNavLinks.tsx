"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/estimate", label: "Estimate", match: (p: string) => p.startsWith("/estimate") },
  {
    href: "/shop",
    label: "Materials",
    match: (p: string) => p.startsWith("/shop") || p.startsWith("/product") || p.startsWith("/search"),
  },
  { href: "/labour", label: "Labour", match: (p: string) => p.startsWith("/labour") },
  { href: "/orders", label: "Orders", match: (p: string) => p.startsWith("/orders") },
  { href: "/bookings", label: "Bookings", match: (p: string) => p.startsWith("/bookings") },
] as const;

export function TopNavLinks() {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="Primary" className="flex items-center gap-1">
      {LINKS.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
