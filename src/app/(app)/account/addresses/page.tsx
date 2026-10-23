import { requirePageActor } from "@/server/auth/page-session";
import { getCurrentUser } from "@/server/services/auth.service";
import { listAddresses } from "@/server/services/address.service";
import { getSelectedCity } from "@/server/city";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddressBook } from "@/components/account/AddressBook";

export const metadata = { title: "Saved addresses" };
export const dynamic = "force-dynamic";

/** Saved addresses: add, edit, delete and choose the default. */
export default async function AddressesPage() {
  const actor = await requirePageActor("/account/addresses");
  const [addresses, user, city] = await Promise.all([
    listAddresses(actor.userId),
    getCurrentUser(actor.userId),
    getSelectedCity(),
  ]);

  return (
    <div className="pb-8 md:mx-auto md:max-w-2xl">
      <PageHeader title="Saved addresses" backHref="/account" />
      <div className="px-4 md:px-0">
        <AddressBook
          addresses={addresses}
          defaults={{ contactName: user.name ?? undefined, contactPhone: user.phone, city }}
        />
      </div>
    </div>
  );
}
