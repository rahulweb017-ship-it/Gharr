import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listTickets } from "@/server/services/support.service";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/shared/contracts/support";

const Query = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  assigned: z.enum(["me", "unassigned"]).optional(),
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().optional(),
});

/** GET /api/v1/admin/tickets — the staff queue (defaults to open + in progress). */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) => listTickets(actor, query));
