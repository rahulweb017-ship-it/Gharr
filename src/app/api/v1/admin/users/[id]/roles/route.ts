import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { setStaffRole } from "@/server/services/admin/users-admin.service";
import { MANAGED_ROLES } from "@/server/services/admin/users-rules";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({ role: z.enum(MANAGED_ROLES), enabled: z.boolean() });

/** POST /api/v1/admin/users/:id/roles — ADMIN grants or revokes ADMIN/SUPPORT. */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) =>
    setStaffRole(actor, params.id, body.role, body.enabled, { requestId, ipHash }),
);
