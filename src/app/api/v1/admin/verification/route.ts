import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listQueue } from "@/server/services/admin/verification.service";

const Query = z.object({
  kind: z.enum(["vendor", "worker"]).default("vendor"),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/v1/admin/verification?kind=vendor|worker — the review queue. */
export const GET = withRoute(
  { auth: "required", query: Query },
  async ({ actor, query }) => listQueue(actor, query),
);
