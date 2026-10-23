import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getAvailability } from "@/server/services/availability.service";

const Params = z.object({ id: z.string().min(1) });
const Query = z.object({
  days: z.coerce.number().int().min(1).max(30).default(14),
});

/** GET /api/v1/workers/:id/availability */
export const GET = withRoute(
  { auth: "public", params: Params, query: Query },
  async ({ params, query }) => getAvailability(params.id, query.days),
);
