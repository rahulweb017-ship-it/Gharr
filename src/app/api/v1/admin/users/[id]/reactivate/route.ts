import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { reactivateUser } from "@/server/services/admin/users-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({ reason: z.string().trim().max(500).optional() }).default({});

/** POST /api/v1/admin/users/:id/reactivate — ADMIN. */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => reactivateUser(actor, params.id, body.reason, { requestId, ipHash }),
);
