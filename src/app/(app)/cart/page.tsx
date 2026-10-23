import { ShoppingCart } from "lucide-react";
import { getCart } from "@/server/services/cart.service";
import { requirePageActor } from "@/server/auth/page-session";
import { CartView } from "@/components/shop/CartView";
import { EmptyState } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "Cart" };
export const dynamic = "force-dynamic";

/**
 * Cart.
 *
 * Grouped by vendor, because each group becomes its own order with its own
 * delivery fee and minimum order value. Showing one merged list would hide why
 * the customer is paying two delivery charges.
 */
export default async function CartPage() {
  const actor = await requirePageActor("/cart");
  const cart = await getCart(actor.userId);

  if (cart.items.length === 0) {
    return (
      <div>
        <PageHeader title="My Cart" backHref="/shop" />
        <EmptyState
          className="pt-12"
          icon={<ShoppingCart aria-hidden className="size-7" />}
          title="Your cart is empty"
          description="Browse cement, steel, tiles and more from verified Hyderabad suppliers."
          action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
        />
      </div>
    );
  }

  return <CartView initialCart={cart} />;
}
