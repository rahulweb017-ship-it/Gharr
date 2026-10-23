import { withRoute } from "@/server/http/route";
import { listPendingProducts } from "@/server/services/admin/catalog-admin.service";

/** GET /api/v1/admin/catalogue/pending — supplier-submitted products awaiting review. */
export const GET = withRoute({ auth: "required" }, async ({ actor }) => listPendingProducts(actor));
