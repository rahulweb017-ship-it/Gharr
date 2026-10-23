import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { suspendUser } from "@/server/services/admin/users-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({ reason: z.string().trim().min(3, "Give a reason").max(500) });

/** POST /api/v1/admin/users/:id/suspend — ADMIN; also revokes every refresh token. */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body, requestId, ipHash }) => suspendUser(actor, params.id, body.reason, { requestId, ipHash }),
);
