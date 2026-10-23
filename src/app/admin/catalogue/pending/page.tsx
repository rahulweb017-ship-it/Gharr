import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError } from "@/server/http/errors";
import { listPendingProducts } from "@/server/services/admin/catalog-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ActionButton } from "@/components/admin/ActionButton";
import { DetailList, Panel } from "@/components/admin/Stat";
import { NeedsAdmin } from "@/components/admin/catalogue/NeedsAdmin";
import { VerificationStatusChip } from "@/components/admin/verification/VerificationStatusChip";
import { EmptyState } from "@/components/ui/Surface";
import { formatDateTime } from "@/lib/admin-format";
import { formatINR } from "@/shared/money";
import { formatQuantity, type Unit } from "@/shared/units";

export const metadata = { title: "Supplier submissions" };

/**
 * Products suppliers proposed. Approving puts the product and the supplier's
 * offer live; rejecting needs a reason, which the supplier sees.
 */
export default async function PendingProductsPage() {
  const actor = await getPageActor();
  let rows: Awaited<ReturnType<typeof listPendingProducts>>;
  try {
    rows = await listPendingProducts(actor);
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Supplier submissions" />;
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title="Supplier submissions"
        description="New products proposed by suppliers. Check the name, category, GST rate and description before approving."
        back={{ href: "/admin/catalogue", label: "Catalogue" }}
      />
      {rows.length === 0 ? (
        <div className="rounded-(--radius-card) border border-ink-100 bg-white">
          <EmptyState icon={<PackageCheck aria-hidden className="size-7" />} title="Nothing to review" description="New supplier products will appear here." />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((p) => (
            <Panel
              key={p.id}
              title={p.name}
              actions={
                <div className="flex gap-2">
                  <ActionButton
                    label="Reject"
                    variant="ghost"
                    path={`/admin/catalogue/products/${p.id}/review`}
                    body={{ decision: "REJECTED" }}
                    confirm={{
                      title: `Reject ${p.name}?`,
                      message: "The supplier sees your reason and can submit again.",
                      reasonField: "note",
                      reasonLabel: "Reason",
                      reasonRequired: true,
                      confirmLabel: "Reject",
                    }}
                  />
                  <ActionButton
                    label="Approve"
                    variant="primary"
                    path={`/admin/catalogue/products/${p.id}/review`}
                    body={{ decision: "APPROVED" }}
                    confirm={{ title: `Approve ${p.name}?`, message: "It goes live on the storefront with the supplier's offer.", confirmLabel: "Approve" }}
                  />
                </div>
              }
            >
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-3 text-sm">
                  <p className="font-medium text-ink-800">{p.shortDescription}</p>
                  <p className="whitespace-pre-line text-ink-600">{p.description}</p>
                  {p.images[0] && (
                    <a href={p.images[0]} target="_blank" rel="noopener noreferrer nofollow" className="inline-block text-sm font-semibold text-brand-700">
                      Open supplier image link
                    </a>
                  )}
                  <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                    {p.variants.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <span>
                          <span className="font-mono text-xs text-ink-400">{v.sku}</span> {v.label}
                        </span>
                        <span className="tabular">
                          {formatINR(v.pricePaise)} <span className="text-ink-400">(MRP {formatINR(v.mrpPaise)})</span> · {formatQuantity(v.stock, v.unit as Unit)} in stock
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <DetailList
                  items={[
                    {
                      label: "Supplier",
                      value: p.submittedByVendor ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <Link href={`/admin/verification/vendors/${p.submittedByVendor.id}`} className="text-brand-700 hover:underline">
                            {p.submittedByVendor.businessName}
                          </Link>
                          <VerificationStatusChip status={p.submittedByVendor.status} />
                        </span>
                      ) : null,
                    },
                    { label: "Category", value: p.category.name },
                    { label: "Brand", value: p.brand?.name ?? "—" },
                    { label: "HSN", value: p.hsnCode ?? "—" },
                    { label: "GST", value: `${p.taxRatePercent}%` },
                    { label: "Submitted", value: formatDateTime(p.createdAt) },
                  ]}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
