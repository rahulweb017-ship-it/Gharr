import { withRoute } from "@/server/http/route";
import { getEarnings } from "@/server/services/vendor/earnings.service";

/** GET /api/v1/vendor/earnings — monthly sales, commission and payouts. */
export const GET = withRoute({ auth: "required" }, async ({ actor }) => getEarnings(actor));
