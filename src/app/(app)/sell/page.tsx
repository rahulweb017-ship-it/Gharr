import { redirect } from "next/navigation";
import { BadgeCheck, IndianRupee, PackageCheck, Truck } from "lucide-react";
import { getPageActor } from "@/server/auth/page-session";
import { getSelectedCity } from "@/server/city";
import { getMyVendor } from "@/server/services/vendor/onboarding.service";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { VendorProfileForm } from "@/components/supplier/VendorProfileForm";

export const metadata = {
  title: "Sell on Gharr",
  description: "List your construction materials on Gharr and reach homeowners and contractors in your city.",
};
export const dynamic = "force-dynamic";

const STEPS = [
  { icon: PackageCheck, title: "Register your business", body: "Shop name, location and the pincodes you deliver to." },
  { icon: BadgeCheck, title: "Get verified", body: "Upload GST, shop licence and bank proof. We review them, usually within 2 working days." },
  { icon: Truck, title: "List and fulfil", body: "Add your products, prices and stock. Accept orders and update delivery from your phone." },
  { icon: IndianRupee, title: "Get paid", body: "Payouts for delivered orders, minus the platform commission, straight to your bank." },
];

/**
 * Public "Sell on Gharr" page. Signed-out visitors see the pitch and a sign-in
 * CTA; signed-in customers get the registration form; existing suppliers go
 * straight to their portal.
 */
export default async function SellPage() {
  const actor = await getPageActor();
  if (actor && (await getMyVendor(actor))) redirect("/supplier");
  const city = await getSelectedCity();

  return (
    <div className="pb-10 md:mx-auto md:max-w-3xl">
      <PageHeader title="Sell on Gharr" backHref="/account" />

      <section className="mx-4 mt-2 rounded-(--radius-card) bg-ink-950 p-6 text-white md:mx-0 md:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Sell your building materials to every site in {city}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-200 md:text-base">
          Cement, steel, sand, tiles, paint, plumbing and electricals. Homeowners and contractors order on Gharr, and you deliver.
        </p>
      </section>

      <ol className="mx-4 mt-6 grid gap-3 md:mx-0 md:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-3 rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icon aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-500">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mx-4 mt-8 rounded-(--radius-card) border border-ink-100 bg-white p-5 shadow-(--shadow-card) md:mx-0 md:p-6">
        {actor ? (
          <>
            <h2 className="mb-1 text-lg font-bold text-ink-900">Register your business</h2>
            <p className="mb-5 text-sm text-ink-500">You can change these details later from your supplier portal.</p>
            <VendorProfileForm mode="register" defaultCity={city} />
          </>
        ) : (
          <div className="text-center">
            <h2 className="text-lg font-bold text-ink-900">Start with your mobile number</h2>
            <p className="mt-1 text-sm text-ink-500">Sign in or create an account, then register your business.</p>
            <ButtonLink href="/login?next=/sell" size="lg" className="mt-5">
              Continue
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
