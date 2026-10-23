import { z } from "zod";
import { BookingStatus } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { adminTransitionBooking } from "@/server/services/admin/bookings-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  to: z.nativeEnum(BookingStatus),
  reason: z.string().trim().max(1000).optional(),
});

/** POST /api/v1/admin/bookings/:id/transition — ADMIN only; resolves disputes. */
export const POST = withRoute({ auth: "required", params: Params, body: Body }, async ({ actor, params, body, requestId, ipHash }) =>
  adminTransitionBooking(actor, params.id, body.to, body.reason, { requestId, ipHash }),
);
