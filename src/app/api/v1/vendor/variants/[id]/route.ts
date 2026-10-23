import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { updateMyVariant } from "@/server/services/vendor/listing.service";
import { VariantPatch } from "@/shared/contracts/vendor";

const Params = z.object({ id: z.string().min(1) });

/** PATCH /api/v1/vendor/variants/:id — price, MRP, stock, lead time, pause/resume. */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: VariantPatch },
  async ({ actor, params, body, requestId, ipHash }) => updateMyVariant(actor, params.id, body, { requestId, ipHash }),
);
