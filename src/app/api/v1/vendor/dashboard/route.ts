import { withRoute } from "@/server/http/route";
import { getDashboard } from "@/server/services/vendor/earnings.service";

/** GET /api/v1/vendor/dashboard — headline numbers for the portal home. */
export const GET = withRoute({ auth: "required" }, async ({ actor }) => getDashboard(actor));
