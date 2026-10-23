import { withRoute } from "@/server/http/route";
import type { RateLimitRule } from "@/server/http/rate-limit";
import { createTicket, listMyTickets } from "@/server/services/support.service";
import { CreateTicketInput } from "@/shared/contracts/support";

/** Generous for a real complaint, tight enough that nobody can flood the queue. */
const TICKET_CREATE_PER_USER_DAY: RateLimitRule = { bucket: "support.ticket.create.day", limit: 10, windowSec: 86_400 };

/** GET /api/v1/support/tickets — the caller's own tickets. */
export const GET = withRoute({ auth: "required" }, async ({ actor }) => listMyTickets(actor.userId));

/** POST /api/v1/support/tickets */
export const POST = withRoute(
  { auth: "required", body: CreateTicketInput, rateLimit: { rule: TICKET_CREATE_PER_USER_DAY }, status: 201 },
  async ({ actor, body }) => createTicket(actor, body),
);
