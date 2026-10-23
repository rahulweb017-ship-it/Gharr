"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Calculator,
  ClipboardList,
  HardHat,
  LayoutDashboard,
  LifeBuoy,
  Package,
  ScrollText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { StaffLevel } from "@/server/services/admin/guard";

const SECTIONS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, level: "SUPPORT" },
  { href: "/admin/verification", label: "Verification", icon: BadgeCheck, level: "ADMIN" },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, level: "SUPPORT" },
  { href: "/admin/bookings", label: "Bookings", icon: HardHat, level: "SUPPORT" },
  { href: "/admin/catalogue", label: "Catalogue", icon: Package, level: "ADMIN" },
  { href: "/admin/estimate-pricing", label: "Estimate pricing", icon: Calculator, level: "ADMIN" },
  { href: "/admin/users", label: "Users", icon: Users, level: "SUPPORT" },
  { href: "/admin/tickets", label: "Tickets", icon: LifeBuoy, level: "SUPPORT" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, level: "ADMIN" },
] as const;

export function AdminNav({ level }: { level: StaffLevel }) {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav aria-label="Admin" className="flex flex-col gap-0.5 p-2">
      {SECTIONS.filter((s) => level === "ADMIN" || s.level === "SUPPORT").map(({ href, label, icon: Icon, ...rest }) => {
        const active = "exact" in rest ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors lg:justify-start",
              active ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
