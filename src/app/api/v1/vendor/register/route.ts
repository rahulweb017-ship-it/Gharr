import { withRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import { registerVendor } from "@/server/services/vendor/onboarding.service";
import { VendorProfileInput } from "@/shared/contracts/vendor";

/**
 * POST /api/v1/vendor/register — turn the signed-in account into a supplier.
 * The VENDOR role lands in the database at once; the client refreshes its
 * session afterwards so the access token carries it too.
 */
export const POST = withRoute(
  {
    auth: "required",
    body: VendorProfileInput,
    status: 201,
    rateLimit: { rule: RATE_LIMITS.vendorRegisterPerUserDay },
  },
  async ({ actor, body, requestId, ipHash }) => registerVendor(actor, body, { requestId, ipHash }),
);
