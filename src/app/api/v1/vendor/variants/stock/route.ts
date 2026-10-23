import { withRoute } from "@/server/http/route";
import { bulkUpdateStock } from "@/server/services/vendor/listing.service";
import { BulkStockInput } from "@/shared/contracts/vendor";

/** POST /api/v1/vendor/variants/stock — set stock for many offers at once. */
export const POST = withRoute(
  { auth: "required", body: BulkStockInput },
  async ({ actor, body, requestId, ipHash }) => bulkUpdateStock(actor, body.items, { requestId, ipHash }),
);
