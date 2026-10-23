import { withRoute } from "@/server/http/route";
import { getMyVendor, updateVendorProfile } from "@/server/services/vendor/onboarding.service";
import { VendorProfilePatch } from "@/shared/contracts/vendor";

/** GET /api/v1/vendor/me — the caller's supplier profile, documents and KYC checklist (null if not registered). */
export const GET = withRoute({ auth: "required" }, async ({ actor }) => getMyVendor(actor));

/** PATCH /api/v1/vendor/me — profile and delivery settings. */
export const PATCH = withRoute(
  { auth: "required", body: VendorProfilePatch },
  async ({ actor, body, requestId, ipHash }) => updateVendorProfile(actor, body, { requestId, ipHash }),
);
