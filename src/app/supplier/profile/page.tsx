import { requirePageVendor } from "@/server/auth/supplier-page";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/Stat";
import { VendorProfileForm } from "@/components/supplier/VendorProfileForm";
import { formatPhone } from "@/shared/phone";

export const metadata = { title: "Business profile" };

export default async function SupplierProfilePage() {
  const { vendor } = await requirePageVendor("/supplier/profile");

  return (
    <>
      <AdminPageHeader title="Business profile" description={`Registered mobile: ${formatPhone(vendor.phoneE164)}`} />
      <Panel className="max-w-3xl">
        <VendorProfileForm mode="edit" initial={vendor} identityLocked={vendor.status === "VERIFIED"} />
      </Panel>
    </>
  );
}
