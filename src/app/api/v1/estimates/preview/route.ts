import { withRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import { previewEstimate } from "@/server/services/estimate.service";
import { EstimateInput } from "@/shared/contracts/estimate";

/** POST /api/v1/estimates/preview — computes without saving; no sign-in needed. */
export const POST = withRoute(
  {
    auth: "public",
    body: EstimateInput,
    rateLimit: { rule: RATE_LIMITS.estimatePreviewPerIpMinute, keyBy: "ip" },
  },
  async ({ body }) => previewEstimate(body),
);
