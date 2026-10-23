import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { searchProducts } from "@/server/services/catalog.service";
import { RATE_LIMITS } from "@/server/http/rate-limit";

const Query = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(50).default(24),
});

/** GET /api/v1/search — typo-tolerant, backed by the pg_trgm index. */
export const GET = withRoute(
  {
    auth: "public",
    query: Query,
    rateLimit: { rule: RATE_LIMITS.searchPerIpMinute, keyBy: "ip" },
  },
  async ({ query }) => searchProducts(query.q, query.limit),
);
