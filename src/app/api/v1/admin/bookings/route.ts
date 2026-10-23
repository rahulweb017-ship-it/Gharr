import { z } from "zod";
import { Trade } from "@prisma/client";
import { withRoute } from "@/server/http/route";
import { BOOKING_ADMIN_TABS, listAdminBookings } from "@/server/services/admin/bookings-admin.service";

const Query = z.object({
  tab: z.enum(BOOKING_ADMIN_TABS).optional(),
  trade: z.nativeEnum(Trade).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/v1/admin/bookings — staff booking search, disputes first (SUPPORT may read). */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  listAdminBookings(actor, query),
);
