import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getBooking } from "@/server/services/booking.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/bookings/:id */
export const GET = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => getBooking(params.id, actor),
);
