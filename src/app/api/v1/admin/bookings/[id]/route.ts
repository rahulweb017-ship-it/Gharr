import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getAdminBooking } from "@/server/services/admin/bookings-admin.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/admin/bookings/:id — booking, history and dispute (SUPPORT may read). */
export const GET = withRoute({ auth: "required", params: Params }, async ({ actor, params }) =>
  getAdminBooking(actor, params.id),
);
