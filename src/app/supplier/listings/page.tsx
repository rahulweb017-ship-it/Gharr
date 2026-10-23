import Link from "next/link";
import { Package } from "lucide-react";
import { requirePageVendor } from "@/server/auth/supplier-page";
import { listMySubmissions, listMyVariants } from "@/server/services/vendor/listing.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/Stat";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Surface";
import { ListingsTable } from "@/components/supplier/ListingsTable";
import { VerificationBanner } from "@/components/supplier/VerificationBanner";
import { formatDay } from "@/lib/admin-format";
import type { Unit } from "@/shared/units";

export const metadata = { title: "Listings" };

export default async function SupplierListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lowStock?: string }>;
}) {
  const { actor, vendor } = await requirePageVendor("/supplier/listings");
  const { q, lowStock } = await searchParams;
  const canEdit = vendor.status === "VERIFIED" && vendor.isActive;
  const [rows, submissions] = await Promise.all([
    listMyVariants(actor, { q, lowStock: lowStock === "1" }),
    listMySubmissions(actor),
  ]);
  const openSubmissions = submissions.filter((s) => s.reviewStatus !== "APPROVED");

  return (
    <>
      <AdminPageHeader
        title="Listings"
        description="Your products, prices and stock. Shoppers only see listings that are on, in stock and approved."
        actions={canEdit ? <ButtonLink href="/supplier/listings/new" size="sm">Add a product</ButtonLink> : undefined}
      />
      <VerificationBanner vendor={vendor} />

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by product, SKU or pack"
          aria-label="Search listings"
          className="h-10 w-full max-w-sm rounded-xl border border-ink-200 bg-white px-3.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStock === "1"} className="size-4 accent-brand-600" />
          Low stock only
        </label>
        <button type="submit" className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">
          Filter
        </button>
        {(q || lowStock) && (
          <Link href="/supplier/listings" className="text-sm font-semibold text-ink-500">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package aria-hidden className="size-7" />}
          title={q || lowStock ? "No listings match" : "No listings yet"}
          description={canEdit ? "Add the products you sell: pick from the Gharr catalogue or propose a new one." : "You can add products once your business is verified."}
          action={canEdit ? <ButtonLink href="/supplier/listings/new">Add a product</ButtonLink> : undefined}
        />
      ) : (
        <ListingsTable
          canEdit={canEdit}
          rows={rows.map((r) => ({
            id: r.id,
            sku: r.sku,
            label: r.label,
            unit: r.unit as Unit,
            pricePaise: r.pricePaise,
            mrpPaise: r.mrpPaise,
            isActive: r.isActive,
            stock: r.stock,
            lowStockThreshold: r.lowStockThreshold,
            lowStock: r.lowStock,
            product: {
              name: r.product.name,
              slug: r.product.slug,
              isActive: r.product.isActive,
              reviewStatus: r.product.reviewStatus,
              category: r.product.category.name,
            },
          }))}
        />
      )}

      {openSubmissions.length > 0 && (
        <Panel title="Products you proposed" className="mt-6">
          <ul className="divide-y divide-ink-100">
            {openSubmissions.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{s.name}</p>
                  <p className="text-xs text-ink-400">
                    {s.category.name} · submitted {formatDay(s.createdAt)}
                  </p>
                  {s.reviewStatus === "REJECTED" && s.reviewNote && <p className="mt-0.5 text-sm text-red-700">Reason: {s.reviewNote}</p>}
                </div>
                {s.reviewStatus === "PENDING" ? <Chip tone="warning">Awaiting approval</Chip> : <Chip tone="danger">Not approved</Chip>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
