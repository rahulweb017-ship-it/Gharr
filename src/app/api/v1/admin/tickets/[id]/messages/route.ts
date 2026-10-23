import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { staffReply } from "@/server/services/support.service";
import { TicketReplyInput } from "@/shared/contracts/support";

const Params = z.object({ id: z.string().min(1) });

/** POST /api/v1/admin/tickets/:id/messages — a staff reply, shown to the customer as Gharr Support. */
export const POST = withRoute(
  { auth: "required", params: Params, body: TicketReplyInput, status: 201 },
  async ({ actor, params, body, requestId, ipHash }) => staffReply(actor, params.id, body.body, { requestId, ipHash }),
);
