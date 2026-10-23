import { z } from "zod";
import { QualityTier } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { listPrices } from "@/server/services/admin/estimate-admin.service";

const Query = z.object({ city: z.string().min(1).max(80), tier: z.nativeEnum(QualityTier) });

/** GET /api/v1/admin/estimate-pricing/prices?city&tier — with live derived prices. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) => listPrices(actor, query));
