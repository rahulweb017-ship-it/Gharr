import { withRoute } from "@/server/http/route";
import { getVendorForReview } from "@/server/services/admin/verification.service";
import { IdParams } from "../../_schemas";

/** GET /api/v1/admin/verification/vendors/:id — profile, documents, requirement status. */
export const GET = withRoute(
  { auth: "required", params: IdParams },
  async ({ actor, params }) => getVendorForReview(actor, params.id),
);
