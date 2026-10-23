import { requirePageVendor } from "@/server/auth/supplier-page";
import { SupplierShell } from "@/components/supplier/SupplierShell";

export const metadata = {
  title: { default: "Supplier portal", template: "%s · Gharr Supplier" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The supplier portal sits outside the customer (app) group, like the admin
 * console. The gate is the linked Vendor row, not the token role, so a
 * just-registered supplier gets in before their token refreshes; every service
 * call re-checks the link and status.
 */
export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const { vendor } = await requirePageVendor("/supplier");

  return (
    <SupplierShell businessName={vendor.businessName} status={vendor.status}>
      {children}
    </SupplierShell>
  );
}
