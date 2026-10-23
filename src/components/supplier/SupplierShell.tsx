import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { VerificationStatus } from "@prisma/client";
import { LogoMark } from "@/components/layout/Logo";
import { VerificationStatusChip } from "@/components/admin/verification/VerificationStatusChip";
import { SupplierSideNav, SupplierTabNav } from "./SupplierNav";

/**
 * Supplier portal frame. Suppliers run their shop from a phone as often as a
 * counter PC, so it is a navy top bar with scrolling tabs on small screens and
 * the admin-style sidebar from lg up.
 */
export function SupplierShell({
  businessName,
  status,
  children,
}: {
  businessName: string;
  status: VerificationStatus;
  children: React.ReactNode;
}) {
  const brand = (
    <span className="flex items-center gap-2">
      <span className="rounded-lg bg-white p-1">
        <LogoMark className="size-6" />
      </span>
      <span className="text-base font-extrabold text-white">
        Ghar<span className="text-brand-400">r</span>
        <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-200 uppercase">
          Supplier
        </span>
      </span>
    </span>
  );

  return (
    <div className="min-h-screen bg-ink-50 lg:flex">
      <header className="sticky top-0 z-30 bg-ink-950 lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/supplier">{brand}</Link>
          <Link href="/" className="text-xs font-semibold text-ink-200">
            Back to shop
          </Link>
        </div>
        <SupplierTabNav />
      </header>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink-950 text-white lg:flex">
        <Link href="/supplier" className="flex h-16 items-center border-b border-white/10 px-4">
          {brand}
        </Link>
        <SupplierSideNav />
        <div className="mt-auto border-t border-white/10 p-3">
          <div className="px-1 pb-2">
            <p className="truncate text-sm font-semibold">{businessName}</p>
            <div className="mt-1">
              <VerificationStatusChip status={status} />
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ink-200 hover:bg-white/10"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to shop
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 lg:py-8">{children}</main>
    </div>
  );
}
