import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { createBooking, listBookings } from "@/server/services/booking.service";
import { RATE_LIMITS } from "@/server/http/rate-limit";

const TRADES = ["MASON","ELECTRICIAN","PLUMBER","CARPENTER","PAINTER","TILE_WORKER","HELPER"] as const;

const CreateInput = z.object({
  workerId: z.string().min(1),
  trade: z.enum(TRADES),
  rateType: z.enum(["HOURLY", "DAILY", "FIXED"]),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(60).max(720),
  addressId: z.string().min(1),
  workDescription: z.string().trim().min(10).max(1000),
  photoKeys: z.array(z.string()).max(6).optional(),
});

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(20),
});

/** GET /api/v1/bookings */
export const GET = withRoute(
  { auth: "required", query: ListQuery },
  async ({ actor, query }) => listBookings(actor.userId, query.page, query.perPage),
);

/** POST /api/v1/bookings */
export const POST = withRoute(
  {
    auth: "required",
    body: CreateInput,
    status: 201,
    rateLimit: { rule: RATE_LIMITS.bookingCreatePerUserHour },
  },
  async ({ actor, body }) => createBooking(actor.userId, body),
);
