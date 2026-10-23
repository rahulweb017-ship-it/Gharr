import { z } from "zod";
import { EstimateMode, EstimateScope, QualityTier } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { listRules } from "@/server/services/admin/estimate-admin.service";

const Query = z.object({
  mode: z.nativeEnum(EstimateMode),
  scope: z.nativeEnum(EstimateScope),
  tier: z.nativeEnum(QualityTier),
});

/** GET /api/v1/admin/estimate-pricing/rules?mode&scope&tier */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) => listRules(actor, query));
