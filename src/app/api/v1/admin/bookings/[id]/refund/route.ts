import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { adminRefundBooking } from "@/server/services/admin/bookings-admin.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  amountPaise: z.number().int().positive(),
  reason: z.string().trim().min(3, "Say why").max(500),
});

/** POST /api/v1/admin/bookings/:id/refund — ADMIN only; needs a captured payment. */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body, status: 201 },
  async ({ actor, params, body, requestId, ipHash }) => adminRefundBooking(actor, params.id, body, { requestId, ipHash }),
);
