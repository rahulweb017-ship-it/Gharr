import Link from "next/link";
import { ArrowRight, ChevronRight, ClipboardList, Store, Truck } from "lucide-react";
import { listCategories, listProducts } from "@/server/services/catalog.service";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchBox } from "@/components/shop/SearchBox";
import { CartButton } from "@/components/shop/CartButton";
import { CategoryIcon } from "@/components/shop/CategoryIcon";
import { ProductCard } from "@/components/shop/ProductCard";
import { SectionHeader } from "@/components/ui/Surface";

export const metadata = { title: "Shop materials" };
export const dynamic = "force-dynamic";

/**
 * Shop home — board 2, screen 1: search, a promo hero, the category grid and
 * featured products, closing with a nudge towards the estimate BOQ for people
 * who do not yet know what to buy.
 */
export default async function ShopPage() {
  const [categories, featured] = await Promise.all([
    listCategories(),
    listProducts({ sort: "popular", perPage: 8 }),
  ]);

  return (
    <div className="pb-8">
      <PageHeader title="Shop materials" actions={<CartButton />}>
        <SearchBox
          initialQuery=""
          autoFocus={false}
          placeholder="Search materials, brands, etc."
          className="w-full md:hidden"
        />
      </PageHeader>

      {/* Promo hero */}
      <section className="px-4 pt-4 md:px-0 md:pt-0">
        <div className="relative overflow-hidden rounded-(--radius-card) bg-linear-to-br from-ink-900 via-ink-800 to-ink-950 p-5 text-white shadow-(--shadow-card) md:p-8">
          <div
            aria-hidden
            className="absolute -top-16 -right-10 size-56 rounded-full bg-brand-500/25 blur-2xl"
          />
          <div aria-hidden className="absolute -right-6 -bottom-10 size-40 rounded-full bg-brand-600/20" />

          <div className="relative max-w-md">
            <h2 className="text-[22px] leading-tight font-extrabold tracking-tight md:text-3xl">
              Quality materials for a <span className="text-brand-400">stronger home</span>
            </h2>
            <p className="mt-2 text-sm text-ink-200 md:text-base">
              Trusted brands from local suppliers, priced upfront with GST shown.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-ink-200">
              <span className="inline-flex items-center gap-1.5">
                <Truck aria-hidden className="size-4 text-brand-400" /> Delivered to your site
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Store aria-hidden className="size-4 text-brand-400" /> Compare prices across sellers
              </span>
            </div>
            <Link
              href="#categories"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-(--shadow-cta) hover:bg-brand-700"
            >
              Shop now <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="scroll-mt-20 pt-7">
        <SectionHeader title="Shop by category" />
        <ul className="grid grid-cols-3 gap-2.5 px-4 sm:grid-cols-4 md:grid-cols-6 md:gap-3 md:px-0">
          {categories.map((category, index) => (
            <li key={category.id}>
              <Link
                href={`/shop/${category.slug}`}
                className="flex h-full flex-col items-center gap-2 rounded-(--radius-card) border border-ink-100 bg-white px-2 py-3 text-center shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-raised)"
              >
                <CategoryIcon iconKey={category.iconKey} index={index} className="size-14" />
                <span className="line-clamp-2 text-xs leading-tight font-semibold text-ink-900">
                  {category.name}
                </span>
                <span className="text-[11px] text-ink-400 tabular">
                  {category._count.products} {category._count.products === 1 ? "item" : "items"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured */}
      {featured.items.length > 0 && (
        <section className="pt-7">
          <SectionHeader title="Featured products" action="Search all" href="/search" />
          <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:gap-4 md:px-0">
            {featured.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Estimate nudge */}
      <section className="px-4 pt-7 md:px-0">
        <Link
          href="/estimate"
          className="flex items-center gap-3.5 rounded-(--radius-card) border border-brand-100 bg-brand-50 p-4 transition-colors hover:bg-brand-100/70"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-(--shadow-card)">
            <ClipboardList aria-hidden className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink-900">Need materials for your project?</span>
            <span className="block text-sm text-ink-600">Use your estimate BOQ to buy the whole list.</span>
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-brand-700" />
        </Link>
      </section>
    </div>
  );
}
