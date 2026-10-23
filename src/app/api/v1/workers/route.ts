import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listWorkers } from "@/server/services/worker.service";
import { queryBool } from "@/server/http/query";

const Query = z.object({
  trade: z.enum(["MASON","ELECTRICIAN","PLUMBER","CARPENTER","PAINTER","TILE_WORKER","HELPER"]).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  availableToday: queryBool,
  verifiedOnly: queryBool,
  minRating: z.coerce.number().min(0).max(5).optional(),
  rateType: z.enum(["HOURLY", "DAILY", "FIXED"]).optional(),
  maxRate: z.coerce.number().int().optional(),
  sort: z.enum(["rating", "distance", "experience", "price_asc"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(20),
});

/** GET /api/v1/workers */
export const GET = withRoute({ auth: "public", query: Query }, async ({ query }) =>
  listWorkers({
    trade: query.trade,
    lat: query.lat,
    lng: query.lng,
    availableToday: query.availableToday,
    verifiedOnly: query.verifiedOnly,
    minRating: query.minRating,
    rateType: query.rateType,
    maxRatePaise: query.maxRate,
    sort: query.sort,
    page: query.page,
    perPage: query.perPage,
  }),
);
