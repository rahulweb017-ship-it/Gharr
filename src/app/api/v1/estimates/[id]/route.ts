import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import {
  getEstimate,
  recomputeEstimate,
  removeEstimate,
} from "@/server/services/estimate.service";
import { EstimateInput } from "@/shared/contracts/estimate";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/estimates/:id */
export const GET = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => getEstimate(actor.userId, params.id),
);

/** PUT /api/v1/estimates/:id — recompute with edited inputs and current prices. */
export const PUT = withRoute(
  {
    auth: "required",
    params: Params,
    body: EstimateInput,
    rateLimit: { rule: RATE_LIMITS.estimateCreatePerUserHour },
  },
  async ({ actor, params, body }) => recomputeEstimate(actor.userId, params.id, body),
);

/** DELETE /api/v1/estimates/:id */
export const DELETE = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => {
    await removeEstimate(actor.userId, params.id);
    return null;
  },
);
