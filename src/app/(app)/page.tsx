import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  ChevronDown,
  ChevronRight,
  HardHat,
  House,
  LifeBuoy,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { listProducts } from "@/server/services/catalog.service";
import { listWorkers } from "@/server/services/worker.service";
import { listEstimates } from "@/server/services/estimate.service";
import { getCurrentUser } from "@/server/services/auth.service";
import { getPageActor } from "@/server/auth/page-session";
import { getSelectedCity } from "@/server/city";
import { ProductRail } from "@/components/shop/ProductCard";
import { WorkerRail } from "@/components/labour/WorkerCard";
import { SectionHeader } from "@/components/ui/Surface";
import { Money } from "@/components/ui/Money";
import { LogoMark } from "@/components/layout/Logo";
import { SCOPE_LABELS, TIER_LABELS } from "@/shared/estimate";
import { cn } from "@/lib/cn";

/**
 * Home.
 *
 * The product's core loop is estimate → buy materials → hire labour, so those
 * three get the largest tap targets directly under the greeting. A customer who
 * already has an estimate sees it next, because continuing a project matters
 * more to them than discovery. Everything below is discovery.
 */

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await getPageActor();
  const [city, popular, workers, user, estimates] = await Promise.all([
    getSelectedCity(),
    listProducts({ sort: "popular", perPage: 8 }),
    listWorkers({ availableToday: true, perPage: 8 }),
    actor ? getCurrentUser(actor.userId).catch(() => null) : null,
    actor ? listEstimates(actor.userId) : [],
  ]);

  const firstName = user?.name?.split(" ")[0];
  const latest = estimates[0];

  return (
    <div className="pb-8">
      {/* Greeting + location + search. Phone only — desktop has the TopNav. */}
      <header className="px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] md:hidden">
        <div className="flex items-center gap-3">
          <LogoMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold text-ink-900">
              Hello, {firstName ?? "Homeowner"}!
            </p>
            <Link href="/location?next=/" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500">
              <MapPin aria-hidden className="size-3.5 text-brand-600" />
              {city}
              <ChevronDown aria-hidden className="size-3.5" />
            </Link>
          </div>
          <Link
            href="/cart"
            aria-label="Cart"
            className="flex size-10 items-center justify-center rounded-full bg-ink-50 text-ink-700"
          >
            <ShoppingCart aria-hidden className="size-5" />
          </Link>
        </div>

        <Link
          href="/search"
          className="mt-4 flex h-12 w-full items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-4 text-ink-400"
        >
          <Search aria-hidden className="size-5" />
          <span className="text-sm">Search materials, brands, workers…</span>
        </Link>
      </header>

      {/* Hero */}
      <section className="px-4 pt-4 md:px-0 md:pt-8">
        <div className="relative overflow-hidden rounded-(--radius-sheet) bg-ink-900 p-5 text-white md:p-10">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-brand-500/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute right-4 bottom-0 hidden text-white/10 md:block">
            <House className="size-56" strokeWidth={1.2} />
          </div>
          <p className="relative text-xs font-semibold tracking-wide text-brand-300 uppercase md:text-sm">
            {user ? `Welcome back · ${city}` : `Now live in ${city}`}
          </p>
          <h1 className="relative mt-1.5 max-w-md text-2xl leading-tight font-extrabold md:text-4xl">
            Build or renovate with confidence.
          </h1>
          <p className="relative mt-2 max-w-md text-sm text-ink-200 md:text-base">
            Get a transparent estimate, buy verified materials and book skilled labour — in one place.
          </p>
          <Link
            href="/estimate"
            className="relative mt-4 inline-flex items-center gap-1.5 rounded-xl bg-linear-to-b from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-bold shadow-(--shadow-cta) md:mt-6 md:px-5 md:py-3 md:text-base"
          >
            Get free estimate
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      {/* The three dominant actions. */}
      <section className="grid grid-cols-3 gap-3 px-4 pt-5 md:gap-5 md:px-0 md:pt-8">
        {[
          { href: "/estimate", label: "Get Estimate", sub: "Cost & material list", icon: Calculator, tint: "bg-ink-50 text-ink-900" },
          { href: "/shop", label: "Buy Materials", sub: "Cement, tiles, paint…", icon: ShoppingCart, tint: "bg-brand-50 text-brand-600" },
          { href: "/labour", label: "Book Labour", sub: "Verified workers", icon: HardHat, tint: "bg-amber-50 text-amber-600" },
        ].map(({ href, label, sub, icon: Icon, tint }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-(--radius-card) border border-ink-100 bg-white p-3 text-center shadow-(--shadow-card) transition-transform active:scale-[0.98] md:flex-row md:gap-4 md:p-5 md:text-left md:hover:shadow-(--shadow-raised)"
          >
            <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl md:size-14", tint)}>
              <Icon aria-hidden className="size-6 md:size-7" strokeWidth={2.1} />
            </span>
            <span>
              <span className="block text-[13px] leading-tight font-bold text-ink-900 md:text-lg">{label}</span>
              <span className="mt-0.5 hidden text-sm text-ink-500 md:block">{sub}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* Continue the current project. */}
      {latest && (
        <section className="pt-7">
          <SectionHeader title="Your latest estimate" action="View all" href="/estimate" />
          <div className="px-4 md:px-0">
            <Link
              href={`/estimate/${latest.id}`}
              className="flex items-center gap-4 rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card) hover:shadow-(--shadow-raised) md:max-w-xl"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <House aria-hidden className="size-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink-900">{latest.title}</span>
                <span className="block truncate text-xs text-ink-500">
                  {SCOPE_LABELS[latest.scope]} · {TIER_LABELS[latest.tier]} · {latest.city}
                </span>
                <span className="mt-1 block text-lg font-extrabold text-ink-900">
                  <Money paise={latest.totalPaise} />
                </span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-ink-300" />
            </Link>
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="pt-7">
        <SectionHeader title="Quick actions" />
        <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-0">
          {[
            { href: "/orders", label: "Track orders", icon: Truck },
            { href: "/bookings", label: "My bookings", icon: HardHat },
            { href: "/estimate/new?mode=RENOVATION", label: "Plan a renovation", icon: Package },
            { href: "/account/support", label: "Get help", icon: LifeBuoy },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-(--radius-card) border border-ink-100 bg-white p-3.5 hover:bg-ink-50"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-ink-50 text-ink-800">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="text-[13px] leading-tight font-semibold text-ink-800 md:text-sm">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular materials */}
      <section className="pt-7">
        <SectionHeader title="Featured materials" action="View all" href="/shop" />
        <ProductRail products={popular.items} />
      </section>

      {/* Workers available today */}
      {workers.items.length > 0 && (
        <section className="pt-7">
          <SectionHeader title="Available today" action="View all" href="/labour" />
          <WorkerRail workers={workers.items} />
        </section>
      )}

      {/* Trust strip — transparency is the product's differentiator. */}
      <section className="px-4 pt-8 md:px-0">
        <div className="grid gap-3 rounded-(--radius-card) border border-ink-100 bg-ink-50 p-4 md:grid-cols-3 md:p-6">
          {[
            { icon: Calculator, title: "Auditable estimates", body: "Every line is quantity × local price." },
            { icon: ShieldCheck, title: "Verified partners", body: "Checked vendors and background-verified workers." },
            { icon: Truck, title: "Scheduled delivery", body: "Cement, steel and sand when your site needs them." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-trust-600" />
              <div>
                <h3 className="text-sm font-bold text-ink-900">{title}</h3>
                <p className="text-[13px] text-ink-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
