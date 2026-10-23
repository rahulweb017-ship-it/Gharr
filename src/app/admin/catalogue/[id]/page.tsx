import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError, NotFoundError } from "@/server/http/errors";
import { getProduct } from "@/server/services/admin/catalog-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ActionButton } from "@/components/admin/ActionButton";
import { DetailList, Panel } from "@/components/admin/Stat";
import { NeedsAdmin } from "@/components/admin/catalogue/NeedsAdmin";
import { VariantsTable } from "@/components/admin/catalogue/VariantsTable";
import { Chip } from "@/components/ui/Chip";
import { formatDateTime } from "@/lib/admin-format";

export const metadata = { title: "Product" };

/** One product: its facts, the listing toggle, and every seller's offer. */
export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPageActor();

  let product: Awaited<ReturnType<typeof getProduct>>;
  try {
    product = await getProduct(actor, id);
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Product" />;
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description={product.shortDescription}
        back={{ href: "/admin/catalogue", label: "Catalogue" }}
        actions={
          <>
            <Link href={`/product/${product.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">
              View in shop
            </Link>
            <ActionButton
              label={product.isActive ? "Deactivate product" : "Activate product"}
              method="PATCH"
              path={`/admin/catalogue/products/${product.id}`}
              body={{ isActive: !product.isActive }}
              variant={product.isActive ? "danger" : "primary"}
              confirm={{
                title: product.isActive ? "Hide this product from the shop?" : "List this product in the shop?",
                message: product.isActive
                  ? "Customers will no longer find or buy it. Carts and saved estimates that reference it are left as they are."
                  : "It becomes searchable and purchasable again wherever a seller has an active, in-stock offer.",
                confirmLabel: product.isActive ? "Deactivate" : "Activate",
              }}
            />
          </>
        }
      />

      <div className="grid gap-6">
        <Panel title="Product">
          <DetailList
            items={[
              { label: "Status", value: product.isActive ? <Chip tone="trust">Active</Chip> : <Chip>Inactive</Chip> },
              { label: "Category", value: product.category.name },
              { label: "Brand", value: product.brand?.name ?? "—" },
              { label: "Slug", value: <span className="font-mono text-xs">{product.slug}</span> },
              { label: "HSN / GST", value: `${product.hsnCode ?? "—"} · ${product.taxRatePercent}%` },
              { label: "Rating", value: product.ratingCount ? `${product.ratingAvg} (${product.ratingCount})` : "No reviews" },
              {
                label: "Estimate pricing",
                value: product.estimatePriceCount
                  ? `Linked to ${product.estimatePriceCount} estimate price row${product.estimatePriceCount === 1 ? "" : "s"}`
                  : "Not used by estimates",
              },
              { label: "Updated", value: formatDateTime(product.updatedAt) },
            ]}
          />
        </Panel>

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-ink-900">Seller offers</h2>
            <p className="text-xs text-ink-500">
              Prices in ₹, tax-exclusive. Every change is recorded in the audit log.
              {product.estimatePriceCount > 0 && " Price changes reach estimates after a price sync."}
            </p>
          </div>
          <VariantsTable variants={product.variants} />
        </section>
      </div>
    </>
  );
}
