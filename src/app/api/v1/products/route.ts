import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listProducts } from "@/server/services/catalog.service";
import { queryBool } from "@/server/http/query";

/** Comma-separated query params are accepted as a convenience for URL filters. */
const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    v == null ? undefined : (Array.isArray(v) ? v : v.split(",")).filter(Boolean),
  );

const Query = z.object({
  category: z.string().optional(),
  brands: csv,
  vendors: csv,
  units: csv,
  delivery: csv,
  minPrice: z.coerce.number().int().optional(),
  maxPrice: z.coerce.number().int().optional(),
  inStock: queryBool,
  q: z.string().optional(),
  sort: z.enum(["popular", "price_asc", "price_desc", "rating", "newest"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(60).default(20),
});

/** GET /api/v1/products */
export const GET = withRoute({ auth: "public", query: Query }, async ({ query }) =>
  listProducts({
    categorySlug: query.category,
    brandSlugs: query.brands,
    vendorIds: query.vendors,
    units: query.units,
    deliveryModes: query.delivery,
    minPricePaise: query.minPrice,
    maxPricePaise: query.maxPrice,
    inStockOnly: query.inStock,
    search: query.q,
    sort: query.sort,
    page: query.page,
    perPage: query.perPage,
  }),
);
