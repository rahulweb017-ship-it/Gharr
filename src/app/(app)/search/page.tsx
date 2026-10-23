import Link from "next/link";
import { SearchX } from "lucide-react";
import { searchProducts, listProducts } from "@/server/services/catalog.service";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductGrid } from "@/components/shop/ProductCard";
import { SearchBox } from "@/components/shop/SearchBox";
import { CartButton } from "@/components/shop/CartButton";
import { EmptyState, SectionHeader } from "@/components/ui/Surface";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

const SUGGESTIONS = [
  "cement",
  "tmt bar",
  "vitrified tiles",
  "asian paints",
  "cpvc pipe",
  "plywood",
  "wall putty",
  "wire",
];

/**
 * Search.
 *
 * Backed by pg_trgm, so near-misses still land — "ultratec", "ultra tech" and
 * "ultratech" all find the same cement, which matters when customers are typing
 * brand names on a phone at a building site.
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query ? await searchProducts(query, 40) : [];
  const popular = query ? { items: [] } : await listProducts({ sort: "popular", perPage: 8 });

  return (
    <div className="pb-8">
      <PageHeader title={query ? `Results for “${query}”` : "Search"} backHref="/shop" actions={<CartButton />}>
        {/* Keyed so the input picks up a new query after navigation. */}
        <SearchBox key={query} initialQuery={query} className="w-full md:max-w-xl" />
      </PageHeader>

      {query ? (
        results.length === 0 ? (
          <EmptyState
            icon={<SearchX aria-hidden className="size-7" />}
            title={`No results for "${query}"`}
            description="Check the spelling, or try a broader term such as the material type or brand."
          />
        ) : (
          <>
            <p className="px-4 pt-3 pb-2.5 text-xs font-medium text-ink-500 md:px-0 md:pt-0">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            <ProductGrid products={results} />
          </>
        )
      ) : (
        <>
          <section className="px-4 pt-5 md:px-0 md:pt-0">
            <h2 className="text-sm font-bold text-ink-900">Popular searches</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SUGGESTIONS.map((term) => (
                <Link
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  className="flex h-9 items-center rounded-full border border-ink-200 bg-white px-3.5 text-xs font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                >
                  {term}
                </Link>
              ))}
            </div>
          </section>

          {popular.items.length > 0 && (
            <section className="pt-7">
              <SectionHeader title="Popular right now" />
              <ProductGrid products={popular.items} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
