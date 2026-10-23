import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getMyTicket } from "@/server/services/support.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/support/tickets/:id — own tickets only (foreign ids are 404). */
export const GET = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => getMyTicket(actor.userId, params.id),
);
