import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getUser } from "@/server/services/admin/users-admin.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/admin/users/:id — SUPPORT and ADMIN. */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) => getUser(actor, params.id));
