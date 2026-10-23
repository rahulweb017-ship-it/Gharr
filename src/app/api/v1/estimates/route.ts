import { withRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import { createEstimate, listEstimates } from "@/server/services/estimate.service";
import { EstimateInput } from "@/shared/contracts/estimate";

/** GET /api/v1/estimates */
export const GET = withRoute({ auth: "required" }, async ({ actor }) =>
  listEstimates(actor.userId),
);

/** POST /api/v1/estimates — computes and saves. */
export const POST = withRoute(
  {
    auth: "required",
    body: EstimateInput,
    status: 201,
    rateLimit: { rule: RATE_LIMITS.estimateCreatePerUserHour },
  },
  async ({ actor, body }) => createEstimate(actor.userId, body),
);
