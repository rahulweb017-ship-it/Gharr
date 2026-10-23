import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { updateVariant } from "@/server/services/admin/catalog-admin.service";

const Params = z.object({ id: z.string().min(1) });

// Shape checks here; cross-field rules (MRP ≥ price against the stored values)
// live in the service, which sees the merged result.
const Body = z
  .object({
    pricePaise: z.number().int().positive().max(100_000_000),
    mrpPaise: z.number().int().positive().max(100_000_000),
    isActive: z.boolean(),
    quantityAvailable: z.number().min(0).max(999_999_999),
    lowStockThreshold: z.number().min(0).max(999_999_999),
  })
  .partial()
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" });

/** PATCH /api/v1/admin/catalogue/variants/:id — price, MRP, stock, active. */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => updateVariant(actor, params.id, body, { requestId, ipHash }),
);
