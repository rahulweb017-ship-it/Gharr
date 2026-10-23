import { withRoute } from "@/server/http/route";
import { listEstimateCities } from "@/server/services/estimate.service";

/** GET /api/v1/estimates/cities — cities with a local price table. */
export const GET = withRoute({ auth: "public" }, async () => listEstimateCities());
