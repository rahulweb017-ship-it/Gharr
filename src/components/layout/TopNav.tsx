import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";
import { getPageActor } from "@/server/auth/page-session";
import { getCartCount } from "@/server/services/cart.service";
import { SearchBox } from "@/components/shop/SearchBox";
import { Logo } from "./Logo";
import { TopNavLinks } from "./TopNavLinks";

/**
 * Desktop primary navigation (md and up). Phones use BottomNav instead.
 *
 * Server-rendered so the cart badge is correct on first paint without a client
 * fetch; the active-link highlighting is the only client part.
 */
export async function TopNav() {
  const actor = await getPageActor();
  const cartCount = actor ? await getCartCount(actor.userId) : 0;

  return (
    <header className="sticky top-0 z-40 hidden border-b border-ink-100 bg-white/95 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <Logo />
        <TopNavLinks />
        <SearchBox
          initialQuery=""
          autoFocus={false}
          placeholder="Search materials, brands, workers…"
          className="ml-auto w-full max-w-sm"
        />

        <Link
          href="/cart"
          aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50"
        >
          <ShoppingCart aria-hidden className="size-5" />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white tabular">
              {cartCount}
            </span>
          )}
        </Link>

        {actor ? (
          <Link
            href="/account"
            aria-label="Your profile"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white hover:bg-ink-800"
          >
            <User aria-hidden className="size-5" />
          </Link>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
