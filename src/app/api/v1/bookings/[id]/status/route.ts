import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { transitionBooking } from "@/server/services/booking.service";

const Params = z.object({ id: z.string().min(1) });
const Body = z.object({
  status: z.enum([
    "ACCEPTED", "REJECTED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS",
    "COMPLETED", "APPROVED", "PAID_OUT", "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_WORKER", "NO_SHOW", "DISPUTED",
  ]),
  reason: z.string().max(300).optional(),
});

/**
 * PATCH /api/v1/bookings/:id/status
 *
 * Both the customer and the worker drive this machine, so who may perform which
 * move is decided by booking-state.ts rather than by the caller.
 */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body }) =>
    transitionBooking(actor, params.id, body.status, { reason: body.reason }),
);
