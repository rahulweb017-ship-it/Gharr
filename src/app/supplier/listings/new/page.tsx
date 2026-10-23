import { redirect } from "next/navigation";
import { requirePageVendor } from "@/server/auth/supplier-page";
import { listCategories } from "@/server/services/vendor/listing.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/Stat";
import { NewListing } from "@/components/supplier/NewListing";

export const metadata = { title: "Add a product" };

export default async function NewListingPage() {
  const { vendor } = await requirePageVendor("/supplier/listings/new");
  if (vendor.status !== "VERIFIED" || !vendor.isActive) redirect("/supplier/listings");
  const categories = await listCategories();

  return (
    <>
      <AdminPageHeader title="Add a product" back={{ href: "/supplier/listings", label: "Listings" }} />
      <Panel className="max-w-4xl">
        <NewListing categories={categories} />
      </Panel>
    </>
  );
}
