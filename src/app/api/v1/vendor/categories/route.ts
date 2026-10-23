import { withRoute } from "@/server/http/route";
import { listCategories } from "@/server/services/vendor/listing.service";

/** GET /api/v1/vendor/categories — leaf categories for the new-product form. */
export const GET = withRoute({ auth: "required" }, async () => listCategories());
