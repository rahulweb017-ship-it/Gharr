import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/http/errors";
import { SELLABLE_VARIANT, VISIBLE_PRODUCT } from "@/server/services/visibility";

/**
 * Catalogue reads.
 *
 * Deliberately transport-agnostic: Server Components call these functions
 * directly (no HTTP hop, fast first paint) and the /api/v1 route handlers call
 * exactly the same functions. One implementation, two transports, so the web and
 * the future Android app can never drift apart.
 */

export interface ProductFilters {
  categorySlug?: string;
  brandSlugs?: string[];
  vendorIds?: string[];
  minPricePaise?: number;
  maxPricePaise?: number;
  units?: string[];
  deliveryModes?: string[];
  inStockOnly?: boolean;
  search?: string;
  sort?: "popular" | "price_asc" | "price_desc" | "rating" | "newest";
  page?: number;
  perPage?: number;
}

/** Shape returned to listing surfaces. Prices come from the cheapest live offer. */
export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  image: string | null;
  brandName: string | null;
  categoryName: string;
  ratingAvg: number;
  ratingCount: number;
  fromPricePaise: number;
  mrpPaise: number;
  unit: string;
  deliveryMode: string;
  sellerCount: number;
  inStock: boolean;
}

const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  images: true,
  ratingAvg: true,
  ratingCount: true,
  brand: { select: { name: true } },
  category: { select: { name: true } },
  variants: {
    where: SELLABLE_VARIANT,
    orderBy: { pricePaise: "asc" },
    select: {
      pricePaise: true,
      mrpPaise: true,
      unit: true,
      deliveryMode: true,
      inventory: { select: { quantityAvailable: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(product: ProductRow): ProductListItem {
  const cheapest = product.variants[0];
  const inStock = product.variants.some(
    (v) => Number(v.inventory?.quantityAvailable ?? 0) > 0,
  );

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    image: product.images[0] ?? null,
    brandName: product.brand?.name ?? null,
    categoryName: product.category.name,
    ratingAvg: Number(product.ratingAvg),
    ratingCount: product.ratingCount,
    fromPricePaise: cheapest?.pricePaise ?? 0,
    mrpPaise: cheapest?.mrpPaise ?? 0,
    unit: cheapest?.unit ?? "PIECE",
    deliveryMode: cheapest?.deliveryMode ?? "STANDARD",
    sellerCount: product.variants.length,
    inStock,
  };
}

export async function listCategories() {
  return prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      iconKey: true,
      imageUrl: true,
      _count: { select: { products: true } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, imageUrl: true },
  });
  if (!category) throw new NotFoundError("Category");
  return category;
}

/**
 * Filtered, sorted, paginated product listing.
 *
 * Price filters apply to the variant, not the product, so "under 500" means at
 * least one seller offers it under 500 — which is what a shopper means.
 */
export async function listProducts(filters: ProductFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(60, Math.max(1, filters.perPage ?? 20));

  const variantWhere: Prisma.ProductVariantWhereInput = { ...SELLABLE_VARIANT };

  if (filters.minPricePaise != null || filters.maxPricePaise != null) {
    variantWhere.pricePaise = {
      ...(filters.minPricePaise != null ? { gte: filters.minPricePaise } : {}),
      ...(filters.maxPricePaise != null ? { lte: filters.maxPricePaise } : {}),
    };
  }
  if (filters.units?.length) {
    variantWhere.unit = { in: filters.units as never };
  }
  if (filters.deliveryModes?.length) {
    variantWhere.deliveryMode = { in: filters.deliveryModes as never };
  }
  if (filters.vendorIds?.length) {
    variantWhere.vendorId = { in: filters.vendorIds };
  }
  if (filters.inStockOnly) {
    variantWhere.inventory = { is: { quantityAvailable: { gt: 0 } } };
  }

  const where: Prisma.ProductWhereInput = {
    ...VISIBLE_PRODUCT,
    ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
    ...(filters.brandSlugs?.length
      ? { brand: { slug: { in: filters.brandSlugs } } }
      : {}),
    ...(filters.search
      ? { searchText: { contains: filters.search.toLowerCase() } }
      : {}),
    // `some` rather than `every`: a product qualifies if ANY seller matches.
    variants: { some: variantWhere },
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.sort === "rating"
      ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }]
      : filters.sort === "newest"
        ? [{ createdAt: "desc" }]
        : [{ popularityScore: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: LIST_SELECT,
    }),
    prisma.product.count({ where }),
  ]);

  let items = rows.map(toListItem);

  // Price sorting is applied after mapping because the sort key is the cheapest
  // variant, which Prisma cannot order by across the relation.
  if (filters.sort === "price_asc") {
    items = [...items].sort((a, b) => a.fromPricePaise - b.fromPricePaise);
  } else if (filters.sort === "price_desc") {
    items = [...items].sort((a, b) => b.fromPricePaise - a.fromPricePaise);
  }

  return {
    items,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Full product detail including every seller offer, cheapest first. */
export async function getProductBySlug(slug: string) {
  // findFirst so the active flag is part of the lookup: a product an admin has
  // taken off sale must 404 on its direct link, not only vanish from listings.
  const product = await prisma.product.findFirst({
    where: { slug, ...VISIBLE_PRODUCT },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      images: true,
      specs: true,
      hsnCode: true,
      taxRatePercent: true,
      ratingAvg: true,
      ratingCount: true,
      brand: { select: { name: true, slug: true, logoUrl: true } },
      category: { select: { name: true, slug: true } },
      variants: {
        where: SELLABLE_VARIANT,
        orderBy: { pricePaise: "asc" },
        select: {
          id: true,
          label: true,
          sku: true,
          unit: true,
          packSize: true,
          mrpPaise: true,
          pricePaise: true,
          moqQuantity: true,
          stepQuantity: true,
          maxOrderQuantity: true,
          deliveryMode: true,
          leadTimeDays: true,
          weightKgPerUnit: true,
          inventory: { select: { quantityAvailable: true, restockEtaDays: true } },
          vendor: {
            select: {
              id: true,
              businessName: true,
              slug: true,
              ratingAvg: true,
              ratingCount: true,
              status: true,
              minOrderPaise: true,
              freeDeliveryAbovePaise: true,
              baseDeliveryFeePaise: true,
            },
          },
        },
      },
    },
  });

  if (!product) throw new NotFoundError("Product");

  return {
    ...product,
    taxRatePercent: Number(product.taxRatePercent),
    ratingAvg: Number(product.ratingAvg),
    variants: product.variants.map((variant) => ({
      ...variant,
      packSize: Number(variant.packSize),
      moqQuantity: Number(variant.moqQuantity),
      stepQuantity: Number(variant.stepQuantity),
      maxOrderQuantity:
        variant.maxOrderQuantity != null ? Number(variant.maxOrderQuantity) : null,
      weightKgPerUnit:
        variant.weightKgPerUnit != null ? Number(variant.weightKgPerUnit) : null,
      stockQuantity: Number(variant.inventory?.quantityAvailable ?? 0),
      vendor: {
        ...variant.vendor,
        ratingAvg: Number(variant.vendor.ratingAvg),
      },
    })),
  };
}

export type ProductDetail = Awaited<ReturnType<typeof getProductBySlug>>;

export async function getRelatedProducts(productId: string, categorySlug: string) {
  const rows = await prisma.product.findMany({
    where: {
      ...VISIBLE_PRODUCT,
      category: { slug: categorySlug },
      id: { not: productId },
      variants: { some: SELLABLE_VARIANT },
    },
    orderBy: { popularityScore: "desc" },
    take: 8,
    select: LIST_SELECT,
  });
  return rows.map(toListItem);
}

/**
 * Typo-tolerant search backed by the pg_trgm GIN index.
 *
 * Exact substring matches rank above fuzzy ones, then by similarity, then by
 * popularity — so "cement" puts actual cement first rather than whatever scores
 * highest on trigrams.
 */
export async function searchProducts(query: string, limit = 24) {
  const normalised = query.trim().toLowerCase();
  if (normalised.length < 2) return [];

  // Each word must match, so "vitrified tile" does not return every tile AND
  // every vitrified thing. Terms are matched independently, which is what makes
  // multi-word queries with a typo in one word still work.
  const terms = normalised.split(/\s+/).filter((term) => term.length >= 2);
  if (terms.length === 0) return [];

  // word_similarity, not similarity: `similarity` compares whole strings, so a
  // two-word query always scores low against a long searchText and multi-word
  // typos fall through. word_similarity scores the query against the best
  // matching run of words inside searchText, which is the behaviour wanted here.
  const conditions = Prisma.join(
    terms.map(
      (term) =>
        Prisma.sql`(p."searchText" ILIKE ${`%${term}%`} OR word_similarity(${term}, p."searchText") > 0.6)`,
    ),
    " AND ",
  );

  const relevance = Prisma.join(
    terms.map(
      (term) => Prisma.sql`word_similarity(${term}, p."searchText")`,
    ),
    " + ",
  );

  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p."id"
    FROM "Product" p
    WHERE p."isActive" = true AND p."reviewStatus" = 'APPROVED' AND (${conditions})
    ORDER BY
      (p."searchText" ILIKE ${`%${normalised}%`}) DESC,
      (${relevance}) DESC,
      p."popularityScore" DESC
    LIMIT ${limit}
  `;

  if (ids.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: ids.map((r) => r.id) }, variants: { some: SELLABLE_VARIANT } },
    select: LIST_SELECT,
  });

  // Restore the relevance order the SQL produced; findMany does not preserve it.
  const rank = new Map(ids.map((row, index) => [row.id, index]));
  return rows
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map(toListItem);
}

/** Facets for the listing filter sheet, scoped to the current category. */
export async function getFilterFacets(categorySlug?: string) {
  const productWhere: Prisma.ProductWhereInput = {
    ...VISIBLE_PRODUCT,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  };

  const [brands, priceRange] = await Promise.all([
    prisma.brand.findMany({
      where: { isActive: true, products: { some: productWhere } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.productVariant.aggregate({
      where: { ...SELLABLE_VARIANT, product: productWhere },
      _min: { pricePaise: true },
      _max: { pricePaise: true },
    }),
  ]);

  return {
    brands,
    minPricePaise: priceRange._min.pricePaise ?? 0,
    maxPricePaise: priceRange._max.pricePaise ?? 0,
  };
}
