import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Price } from "@/components/ui/Money";
import { DeliveryChip } from "@/components/ui/Chip";
import { RatingStars } from "@/components/ui/RatingStars";
import type { ProductListItem } from "@/server/services/catalog.service";
import type { Unit } from "@/shared/units";
import { QuickAddButton } from "./QuickAddButton";

/**
 * Product card used on the home rails, the shop home and the listing grid.
 *
 * Shows the cheapest live offer with a "N sellers" hint rather than one
 * arbitrary seller — price competition between vendors is a selling point, so it
 * is surfaced rather than hidden.
 *
 * `layout="responsive"` is the listing card from the UI boards: a compact row
 * (88px thumb left) on phones, a vertical tile from md up. `layout="tile"` is
 * always vertical, for rails and 2-up grids.
 *
 * The quick-add button sits outside the link, because a button nested inside an
 * anchor is invalid HTML and steals the card's tap target.
 */

type Mode = "STANDARD" | "SCHEDULED" | "PICKUP";

export function ProductCard({
  product,
  layout = "tile",
  className,
}: {
  product: ProductListItem;
  layout?: "tile" | "responsive";
  className?: string;
}) {
  const row = layout === "responsive";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white",
        "shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-raised)",
        className,
      )}
    >
      <Link
        href={`/product/${product.slug}`}
        className={cn(
          "flex h-full",
          row ? "gap-3 p-3 md:flex-col md:gap-0 md:p-0" : "flex-col",
        )}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden bg-ink-50",
            row
              ? "size-[88px] rounded-xl md:aspect-square md:size-auto md:w-full md:rounded-none"
              : "aspect-square w-full",
          )}
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes={row ? "(max-width: 767px) 88px, 25vw" : "(max-width: 767px) 50vw, 25vw"}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[11px] text-ink-300">
              No image
            </div>
          )}

          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75">
              <span className="rounded-full bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                Out of stock
              </span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1",
            // Right padding keeps text clear of the floating + button.
            row ? "pr-12 md:p-3 md:pr-3" : "p-3",
          )}
        >
          {product.brandName && (
            <span className="truncate text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              {product.brandName}
            </span>
          )}

          <h3 className="line-clamp-2 text-[14px] leading-snug font-semibold text-ink-900">
            {product.name}
          </h3>

          <Price
            pricePaise={product.fromPricePaise}
            mrpPaise={product.mrpPaise}
            unit={product.unit as Unit}
            size="sm"
            className="mt-0.5"
          />

          {product.ratingCount > 0 && (
            <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
          )}

          <div
            className={cn(
              "mt-auto flex flex-wrap items-center gap-1.5 pt-1",
              // Leave room for the + button on vertical tiles.
              !row && "pr-11",
              row && "md:pr-11",
            )}
          >
            <DeliveryChip mode={product.deliveryMode as Mode} />
            {product.sellerCount > 1 && (
              <span className="text-[11px] font-medium text-ink-500">
                {product.sellerCount} sellers
              </span>
            )}
          </div>
        </div>
      </Link>

      <QuickAddButton
        slug={product.slug}
        productName={product.name}
        inStock={product.inStock}
        className="absolute right-3 bottom-3"
      />
    </div>
  );
}

/**
 * Horizontal rail used on Home and "Similar products". Scrolls rather than
 * wrapping; from md up there is room for a plain grid instead.
 */
export function ProductRail({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className="w-[164px] shrink-0 md:w-auto"
        />
      ))}
    </div>
  );
}

/** Listing grid: row cards on phones, 3–4 up tiles from md. */
export function ProductGrid({
  products,
  className,
}: {
  products: ProductListItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 px-4 md:grid-cols-3 md:gap-4 md:px-0 lg:grid-cols-4",
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} layout="responsive" />
      ))}
    </div>
  );
}
