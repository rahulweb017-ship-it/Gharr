import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Card, section header, skeleton and empty state — the structural primitives. */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tappable card. Renders as a link so it keeps native navigation semantics. */
export function CardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)",
        "transition-shadow hover:shadow-(--shadow-raised) active:scale-[0.995]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SectionHeader({
  title,
  action,
  href,
  className,
}: {
  title: string;
  action?: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 px-4 pb-3 md:px-0", className)}>
      <h2 className="text-[17px] font-bold tracking-tight text-ink-900">{title}</h2>
      {action && href && (
        <Link
          href={href}
          className="text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-ink-100", className)}
    />
  );
}

/**
 * Empty states always offer a way forward. An empty cart that only says
 * "your cart is empty" is a dead end.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-8 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-ink-50 text-ink-300">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Sticky action bar for cart and booking CTAs, per the blueprint's
 * "sticky cart/booking CTA where appropriate".
 *
 * On a phone it sits above the bottom navigation and clears the home indicator.
 * From md up there is no bottom bar and the page has room for a side column, so
 * it becomes an ordinary in-flow block wherever the page places it.
 */
export function StickyBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 w-full border-t border-ink-100 bg-white/95 px-4 py-3 shadow-(--shadow-sticky) backdrop-blur",
        "md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        className,
      )}
      style={{
        bottom: `calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {children}
    </div>
  );
}
