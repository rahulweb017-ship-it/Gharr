import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getDashboard } from "@/server/services/admin/analytics.service";
import { parseRange } from "@/server/services/admin/analytics-math";

const Query = z.object({ days: z.string().max(3).optional() });

/** GET /api/v1/admin/analytics?days=7|30|90 — dashboard KPIs, daily series and queues. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  getDashboard(actor, parseRange(query.days)),
);
