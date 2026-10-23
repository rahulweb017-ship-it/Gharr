import { withRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import { listMySubmissions, submitProduct } from "@/server/services/vendor/listing.service";
import { SubmitProductInput } from "@/shared/contracts/vendor";

/** GET /api/v1/vendor/products — products this supplier proposed, with review state. */
export const GET = withRoute({ auth: "required" }, async ({ actor }) => listMySubmissions(actor));

/** POST /api/v1/vendor/products — propose a new product; hidden until an admin approves it. */
export const POST = withRoute(
  {
    auth: "required",
    body: SubmitProductInput,
    status: 201,
    rateLimit: { rule: RATE_LIMITS.vendorProductSubmitPerUserDay },
  },
  async ({ actor, body, requestId, ipHash }) => submitProduct(actor, body, { requestId, ipHash }),
);
