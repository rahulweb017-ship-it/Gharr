import { z } from "zod";
import { QualityTier } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { syncPrices } from "@/server/services/admin/estimate-admin.service";

const Body = z.object({ city: z.string().trim().min(1).max(80), tier: z.nativeEnum(QualityTier).optional() }).strict();

/** POST /api/v1/admin/estimate-pricing/sync — re-derive material prices from the shop. */
export const POST = withRoute(
  { auth: "required", body: Body },
  async ({ actor, body, requestId, ipHash }) => syncPrices(actor, body, { requestId, ipHash }),
);
