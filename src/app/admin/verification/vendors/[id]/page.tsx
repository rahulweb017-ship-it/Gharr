import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError, NotFoundError } from "@/server/http/errors";
import { getVendorForReview } from "@/server/services/admin/verification.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel } from "@/components/admin/Stat";
import { NeedsAdmin } from "@/components/admin/verification/NeedsAdmin";
import { AccountDecision } from "@/components/admin/verification/AccountDecision";
import { DocumentReviewCard } from "@/components/admin/verification/DocumentReviewCard";
import { RequirementsPanel } from "@/components/admin/verification/RequirementsPanel";
import { formatDateTime } from "@/lib/admin-format";

export const metadata = { title: "Vendor verification" };

export default async function VendorVerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPageActor();

  let vendor;
  try {
    vendor = await getVendorForReview(actor, id);
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Vendor verification" />;
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title={vendor.businessName}
        description="Vendor verification"
        back={{ href: "/admin/verification", label: "Verification queue" }}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Business">
            <DetailList
              items={[
                { label: "Business name", value: vendor.businessName },
                { label: "Legal name", value: vendor.legalName },
                { label: "GSTIN", value: vendor.gstin && <span className="font-mono">{vendor.gstin}</span> },
                { label: "Phone", value: vendor.phoneE164 },
                { label: "Email", value: vendor.email },
                { label: "City", value: `${vendor.city}, ${vendor.state} ${vendor.pincode}` },
                { label: "Service pincodes", value: vendor.servicePincodes.length ? vendor.servicePincodes.join(", ") : null },
                { label: "Owner account", value: vendor.user ? `${vendor.user.name ?? "—"} · ${vendor.user.phoneE164}` : "Not linked" },
                { label: "Listed", value: vendor.isActive ? "Live" : "Off sale" },
                { label: "Applied", value: formatDateTime(vendor.createdAt) },
              ]}
            />
          </Panel>

          <section>
            <h2 className="mb-3 text-base font-bold text-ink-900">Documents ({vendor.documents.length})</h2>
            {vendor.documents.length === 0 ? (
              <p className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {vendor.documents.map((doc) => (
                  <DocumentReviewCard key={doc.id} kind="vendor" doc={doc} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <AccountDecision
            kind="vendor"
            id={vendor.id}
            status={vendor.status}
            statusNote={vendor.statusNote}
            summary={vendor.requirements}
          />
          <RequirementsPanel summary={vendor.requirements} />
        </div>
      </div>
    </>
  );
}
