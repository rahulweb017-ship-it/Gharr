import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { updateRule } from "@/server/services/admin/estimate-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z
  .object({
    label: z.string().trim().min(2).max(120),
    quantityPerBasis: z.number().positive().max(1_000_000),
    wastagePercent: z.number().min(0).max(100),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" });

/** PATCH /api/v1/admin/estimate-pricing/rules/:id — affects new estimates only. */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => updateRule(actor, params.id, body, { requestId, ipHash }),
);
