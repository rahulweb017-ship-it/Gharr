"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, HardHat, Home, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Phone-width primary navigation: Home · Estimate · Shop · Labour · Profile.
 *
 * Mirrors the UI boards' tab bar, with the boards' "Project" slot given to
 * Labour until project tracking ships. Orders and bookings live under Profile.
 * Hidden from md up, where TopNav carries the same destinations.
 */

export const PRIMARY_TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/estimate",
    label: "Estimate",
    icon: Calculator,
    match: (p: string) => p.startsWith("/estimate"),
  },
  {
    href: "/shop",
    label: "Shop",
    icon: ShoppingBag,
    match: (p: string) =>
      p.startsWith("/shop") ||
      p.startsWith("/product") ||
      p.startsWith("/search") ||
      p.startsWith("/cart") ||
      p.startsWith("/checkout"),
  },
  {
    href: "/labour",
    label: "Labour",
    icon: HardHat,
    match: (p: string) => p.startsWith("/labour"),
  },
  {
    href: "/account",
    label: "Profile",
    icon: User,
    match: (p: string) =>
      p.startsWith("/account") || p.startsWith("/orders") || p.startsWith("/bookings"),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-100 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {PRIMARY_TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                  active ? "text-brand-600" : "text-ink-400 hover:text-ink-600",
                )}
              >
                <Icon
                  aria-hidden
                  className="size-[22px]"
                  strokeWidth={active ? 2.4 : 1.9}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
