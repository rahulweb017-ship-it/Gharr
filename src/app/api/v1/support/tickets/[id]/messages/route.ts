import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { addCustomerMessage, getMyTicket } from "@/server/services/support.service";
import { TicketReplyInput } from "@/shared/contracts/support";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/support/tickets/:id/messages — the thread, opening message first. */
export const GET = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => (await getMyTicket(actor.userId, params.id)).thread,
);

/** POST /api/v1/support/tickets/:id/messages — a customer reply; reopens a resolved ticket. */
export const POST = withRoute(
  { auth: "required", params: Params, body: TicketReplyInput, status: 201 },
  async ({ actor, params, body }) => addCustomerMessage(actor, params.id, body.body),
);
