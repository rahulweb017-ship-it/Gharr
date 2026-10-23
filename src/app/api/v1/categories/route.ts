import { withRoute } from "@/server/http/route";
import { listCategories } from "@/server/services/catalog.service";

/** GET /api/v1/categories */
export const GET = withRoute({ auth: "public" }, async () => listCategories());
