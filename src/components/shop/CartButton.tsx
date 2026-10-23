import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getPageActor } from "@/server/auth/page-session";
import { getCartCount } from "@/server/services/cart.service";

/**
 * Cart shortcut for PageHeader actions on phones.
 *
 * Hidden from md up because the TopNav already carries the cart with its badge;
 * two cart icons side by side on desktop would just be noise.
 */
export async function CartButton() {
  const actor = await getPageActor();
  const count = actor ? await getCartCount(actor.userId) : 0;

  return (
    <Link
      href="/cart"
      aria-label={`Cart${count ? `, ${count} items` : ""}`}
      className="relative flex size-11 items-center justify-center rounded-full text-ink-800 hover:bg-ink-50 md:hidden"
    >
      <ShoppingCart aria-hidden className="size-[22px]" />
      {count > 0 && (
        <span className="absolute top-1 right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] leading-[18px] font-bold text-white tabular">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
