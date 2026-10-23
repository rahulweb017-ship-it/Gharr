import { redirect } from "next/navigation";
import { getCart } from "@/server/services/cart.service";
import { getCurrentUser } from "@/server/services/auth.service";
import { listAddresses } from "@/server/services/address.service";
import { availableDeliverySlots } from "@/server/services/checkout.service";
import { requirePageActor } from "@/server/auth/page-session";
import { env, isProduction } from "@/server/env";
import { CheckoutView, type PaymentOption } from "@/components/shop/CheckoutView";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

/**
 * Which prepaid methods can actually be taken right now.
 *
 * Every non-COD method routes to the configured PAYMENT_PROVIDER. Only the mock
 * gateway can create an intent today (Razorpay throws until merchant keys are
 * wired, and the "cod" provider cannot collect money up front), and the mock is
 * refused in production — so prepaid options are shown but disabled otherwise,
 * rather than failing after the customer taps "Place Order".
 */
function prepaidAvailable(): boolean {
  return env.PAYMENT_PROVIDER === "mock" && !isProduction;
}

/**
 * One-page checkout, as the blueprint specifies.
 *
 * Address, delivery window, payment method and the bill are all visible at once.
 * A multi-step wizard adds drop-off at every step for no benefit when there are
 * only four decisions.
 */
export default async function CheckoutPage() {
  const actor = await requirePageActor("/checkout");

  const [cart, user, addresses] = await Promise.all([
    getCart(actor.userId),
    getCurrentUser(actor.userId),
    listAddresses(actor.userId),
  ]);

  if (cart.items.length === 0) redirect("/cart");

  // Scheduled goods drive the earliest window: a truck of sand cannot arrive
  // sooner than the slowest item in the order.
  const leadTime = Math.max(
    1,
    ...cart.items.map((item) => item.leadTimeDays),
  );

  const prepaid = prepaidAvailable();
  const paymentOptions: PaymentOption[] = [
    { key: "UPI", enabled: prepaid },
    { key: "CARD", enabled: prepaid },
    { key: "NETBANKING", enabled: prepaid },
    { key: "COD", enabled: true },
  ];

  return (
    <CheckoutView
      cart={cart}
      addresses={addresses}
      addressDefaults={{
        contactName: user.name ?? undefined,
        contactPhone: user.phone,
      }}
      slots={availableDeliverySlots(leadTime)}
      needsSlot={cart.items.some((item) => item.deliveryMode === "SCHEDULED")}
      leadTimeDays={leadTime}
      paymentOptions={paymentOptions}
    />
  );
}
