import { requirePageVendor } from "@/server/auth/supplier-page";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DocumentUploader, type DocRequirement } from "@/components/supplier/DocumentUploader";
import { VerificationBanner } from "@/components/supplier/VerificationBanner";
import { formatDay } from "@/lib/admin-format";

export const metadata = { title: "Documents" };

export default async function SupplierDocumentsPage() {
  const { vendor } = await requirePageVendor("/supplier/documents");

  // Newest document of each type drives the row (documents are newest-first).
  const items: DocRequirement[] = vendor.requirements.items.map((req) => {
    const doc = vendor.documents.find((d) => req.anyOf.includes(d.type));
    return {
      key: req.key,
      label: req.label,
      type: req.anyOf[0],
      state: req.state,
      note: doc?.notes ?? null,
      uploadedAt: doc ? formatDay(doc.createdAt) : null,
    };
  });

  return (
    <>
      <AdminPageHeader
        title="Verification documents"
        description="PDF or a clear photo (PNG, JPG, WebP), up to 5 MB each. Only Gharr's verification team can see them."
      />
      <VerificationBanner vendor={vendor} />
      <div className="max-w-3xl">
        <DocumentUploader items={items} />
      </div>
    </>
  );
}
