import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getTicket, updateTicket } from "@/server/services/support.service";
import { TicketUpdateInput } from "@/shared/contracts/support";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/admin/tickets/:id */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) => getTicket(actor, params.id));

/** PATCH /api/v1/admin/tickets/:id — status, priority, assignee. */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: TicketUpdateInput },
  async ({ actor, params, body, requestId, ipHash }) => updateTicket(actor, params.id, body, { requestId, ipHash }),
);
