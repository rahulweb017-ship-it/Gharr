import { redirect } from "next/navigation";
import { requirePageActor } from "./page-session";
import { getMyVendor } from "@/server/services/vendor/onboarding.service";

/**
 * Page gate for the supplier portal. Next renders a page in parallel with its
 * layout, so each page checks for itself rather than trusting the layout's
 * redirect: an account without a supplier profile goes to "Sell on Gharr".
 */
export async function requirePageVendor(returnTo: string) {
  const actor = await requirePageActor(returnTo);
  const vendor = await getMyVendor(actor);
  if (!vendor) redirect("/sell");
  return { actor, vendor };
}
