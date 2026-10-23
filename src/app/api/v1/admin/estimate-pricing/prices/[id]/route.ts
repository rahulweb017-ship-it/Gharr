import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { updatePrice } from "@/server/services/admin/estimate-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z
  .object({
    unitPricePaise: z.number().int().positive().max(100_000_000),
    packCoverage: z.number().positive().max(1_000_000),
  })
  .partial()
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" });

/** PATCH /api/v1/admin/estimate-pricing/prices/:id — affects new estimates only. */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => updatePrice(actor, params.id, body, { requestId, ipHash }),
);
