import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listUsers } from "@/server/services/admin/users-admin.service";

const Query = z.object({
  q: z.string().max(80).optional(),
  role: z.enum(["CUSTOMER", "VENDOR", "WORKER", "DELIVERY_PARTNER", "ADMIN", "SUPPORT"]).optional(),
  active: z.enum(["active", "suspended"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().optional(),
});

/** GET /api/v1/admin/users — SUPPORT and ADMIN. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) => listUsers(actor, query));
