import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck } from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/server/services/catalog.service";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/ui/Surface";
import { ProductRail } from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { CartButton } from "@/components/shop/CartButton";
import { BuyBox } from "@/components/shop/BuyBox";
import { formatQuantity, type Unit } from "@/shared/units";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    const product = await getProductBySlug(slug);
    return { title: product.name, description: product.shortDescription };
  } catch {
    return { title: "Product" };
  }
}

/**
 * Product detail.
 *
 * Because vendors sell the same catalogue item, this page is a seller comparison
 * as much as a product page — the cheapest offer is preselected and the others
 * are listed with their own price, delivery terms and minimum order.
 *
 * Layout: one column on phones (gallery → offer → details, with a fixed buy
 * bar). From md, a grid puts the gallery and details on the left and the offer
 * in a sticky right column spanning both rows, so the buy box stays in view
 * while reading specifications.
 */
export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch {
    notFound();
  }

  const related = await getRelatedProducts(product.id, product.category.slug);
  const cheapest = product.variants[0];
  const specs = Object.entries((product.specs ?? {}) as Record<string, unknown>).filter(
    ([, value]) => value != null && value !== "",
  );

  return (
    <div className="pb-44 md:pb-8">
      <PageHeader
        title={product.category.name}
        backHref={`/shop/${product.category.slug}`}
        actions={<CartButton />}
        className="md:hidden"
      />

      {/* Desktop breadcrumb stands in for the phone header. */}
      <nav aria-label="Breadcrumb" className="hidden pt-6 pb-4 text-sm text-ink-500 md:block">
        <Link href="/shop" className="hover:text-ink-800">Shop</Link>
        <span aria-hidden className="mx-2 text-ink-300">/</span>
        <Link href={`/shop/${product.category.slug}`} className="hover:text-ink-800">
          {product.category.name}
        </Link>
        <span aria-hidden className="mx-2 text-ink-300">/</span>
        <span className="text-ink-800">{product.name}</span>
      </nav>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_400px] md:gap-x-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-10">
        {/* Gallery */}
        <div className="px-4 pt-3 md:col-start-1 md:row-start-1 md:px-0 md:pt-0">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        {/* Offer column */}
        <div className="px-4 pt-4 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start md:px-0 md:pt-0 md:sticky md:top-24">
          <div className="md:rounded-(--radius-card) md:border md:border-ink-100 md:bg-white md:p-5 md:shadow-(--shadow-card)">
            {product.brand && (
              <span className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">
                {product.brand.name}
              </span>
            )}
            <h1 className="mt-0.5 text-[21px] leading-snug font-bold text-ink-900 md:text-2xl">
              {product.name}
            </h1>

            <BuyBox
              productName={product.name}
              taxRatePercent={product.taxRatePercent}
              ratingAvg={product.ratingAvg}
              ratingCount={product.ratingCount}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                label: variant.label,
                unit: variant.unit as Unit,
                pricePaise: variant.pricePaise,
                mrpPaise: variant.mrpPaise,
                moqQuantity: variant.moqQuantity,
                stepQuantity: variant.stepQuantity,
                maxOrderQuantity: variant.maxOrderQuantity,
                stockQuantity: variant.stockQuantity,
                deliveryMode: variant.deliveryMode,
                leadTimeDays: variant.leadTimeDays,
                vendorName: variant.vendor.businessName,
                vendorRating: variant.vendor.ratingAvg,
                vendorRatingCount: variant.vendor.ratingCount,
                vendorVerified: variant.vendor.status === "VERIFIED",
                minOrderPaise: variant.vendor.minOrderPaise,
                freeDeliveryAbovePaise: variant.vendor.freeDeliveryAbovePaise,
              }))}
            />
          </div>
        </div>

        {/* Details */}
        <div className="md:col-start-1 md:row-start-2">
          {specs.length > 0 && (
            <section className="mt-7">
              <SectionHeader title="Product specifications" />
              <div className="mx-4 overflow-hidden rounded-(--radius-card) border border-ink-100 md:mx-0">
                <dl>
                  {specs.map(([key, value], index) => (
                    <div
                      key={key}
                      className={`grid grid-cols-[2fr_3fr] gap-3 px-4 py-2.5 text-[13px] ${
                        index % 2 === 0 ? "bg-white" : "bg-ink-50"
                      }`}
                    >
                      <dt className="font-medium text-ink-500">{key}</dt>
                      <dd className="font-semibold break-words text-ink-900">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )}

          {/* Delivery note for heavy goods */}
          {cheapest?.deliveryMode === "SCHEDULED" && (
            <section className="mt-6 px-4 md:px-0">
              <div className="flex gap-3 rounded-(--radius-card) border border-amber-200 bg-amber-50 p-3.5">
                <Truck aria-hidden className="size-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="text-[13px] font-bold text-amber-900">Scheduled delivery</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                    This is a heavy material delivered by truck. You&apos;ll choose a
                    delivery window at checkout. Minimum order{" "}
                    {formatQuantity(cheapest.moqQuantity, cheapest.unit as Unit)}.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mt-7 px-4 md:px-0">
            <h2 className="text-[17px] font-bold tracking-tight text-ink-900">Description</h2>
            {product.shortDescription && (
              <p className="mt-2 text-sm leading-relaxed font-medium text-ink-700">
                {product.shortDescription}
              </p>
            )}
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-600">
              {product.description}
            </p>
            {product.hsnCode && (
              <p className="mt-3 text-xs text-ink-400">
                HSN {product.hsnCode} · GST {product.taxRatePercent}%
              </p>
            )}
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-9">
          <SectionHeader title="Similar products" />
          <ProductRail products={related} />
        </section>
      )}
    </div>
  );
}
