import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { listAudit } from "@/server/services/admin/audit-admin.service";
import { dateRange } from "@/lib/admin-format";

const Query = z.object({
  action: z.string().max(80).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.string().max(80).optional(),
  actor: z.string().max(20).optional(),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().optional(),
});

/** GET /api/v1/admin/audit — ADMIN only. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  listAudit(actor, {
    action: query.action,
    entityType: query.entityType,
    entityId: query.entityId,
    actorPhone: query.actor,
    createdAt: dateRange(query.from, query.to),
    page: query.page,
    perPage: query.perPage,
  }),
);
