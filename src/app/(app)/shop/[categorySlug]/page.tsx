import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, PackageX } from "lucide-react";
import {
  getCategoryBySlug,
  getFilterFacets,
  listProducts,
} from "@/server/services/catalog.service";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductGrid } from "@/components/shop/ProductCard";
import { SortSelect } from "@/components/shop/SortTabs";
import { CartButton } from "@/components/shop/CartButton";
import { FilterSidebar, FiltersButton, ListingSearch } from "@/components/shop/ListingFilters";
import {
  activeFilterCount,
  listingHref,
  parseListingParams,
  toProductFilters,
  type RawSearchParams,
} from "@/components/shop/listing-params";
import { EmptyState } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const PER_PAGE = 40;

interface PageProps {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps) {
  const { categorySlug } = await params;
  try {
    const category = await getCategoryBySlug(categorySlug);
    return { title: category.name };
  } catch {
    return { title: "Category" };
  }
}

/**
 * Product listing for one category.
 *
 * Everything the shopper can change — search, filters, sort, page — is in the
 * URL, so this stays a Server Component that calls the catalogue service
 * directly; the client pieces only rewrite the query string.
 */
export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { categorySlug } = await params;
  const state = parseListingParams(await searchParams);

  let category;
  try {
    category = await getCategoryBySlug(categorySlug);
  } catch {
    notFound();
  }

  const basePath = `/shop/${categorySlug}`;
  const [products, facets] = await Promise.all([
    listProducts({ ...toProductFilters(state), categorySlug, perPage: PER_PAGE }),
    getFilterFacets(categorySlug),
  ]);

  const filtered = activeFilterCount(state) > 0 || Boolean(state.q);

  return (
    <div className="pb-8">
      <PageHeader title={category.name} backHref="/shop" actions={<CartButton />}>
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <div className="md:w-96">
            <ListingSearch
              key={state.q}
              basePath={basePath}
              state={state}
              placeholder={`Search in ${category.name}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:ml-auto md:flex">
            <FiltersButton basePath={basePath} state={state} facets={facets} className="md:hidden" />
            <SortSelect basePath={basePath} state={state} className="md:w-60" />
          </div>
        </div>
      </PageHeader>

      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden md:block">
          <div className="sticky top-24">
            <FilterSidebar basePath={basePath} state={state} facets={facets} />
          </div>
        </div>

        <div>
          <p className="px-4 pt-3 pb-2.5 text-xs font-medium text-ink-500 md:px-0 md:pt-0">
            {products.total} {products.total === 1 ? "product" : "products"}
            {state.q && (
              <>
                {" "}for <span className="font-semibold text-ink-800">&ldquo;{state.q}&rdquo;</span>
              </>
            )}
          </p>

          {products.items.length === 0 ? (
            <EmptyState
              icon={<PackageX aria-hidden className="size-7" />}
              title={filtered ? "No products match" : "Nothing here yet"}
              description={
                filtered
                  ? "Try removing a filter or searching for something broader."
                  : "Browse another category while this one is stocked."
              }
              action={
                filtered ? (
                  <ButtonLink href={basePath} variant="outline">
                    Clear filters
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/shop" variant="outline">
                    Browse categories
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ProductGrid products={products.items} className="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
          )}

          {products.totalPages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 px-4">
              {products.page > 1 && (
                <Link
                  href={listingHref(basePath, state, { page: products.page - 1 })}
                  className="flex h-11 items-center gap-1 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                >
                  <ChevronLeft aria-hidden className="size-4" /> Previous
                </Link>
              )}
              <span className="text-sm text-ink-500 tabular">
                Page {products.page} of {products.totalPages}
              </span>
              {products.page < products.totalPages && (
                <Link
                  href={listingHref(basePath, state, { page: products.page + 1 })}
                  className="flex h-11 items-center gap-1 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                >
                  Next <ChevronRight aria-hidden className="size-4" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
