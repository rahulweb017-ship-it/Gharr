import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getBoq } from "@/server/services/estimate.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/estimates/:id/boq — material list mapped to live offers. */
export const GET = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => getBoq(actor.userId, params.id),
);
