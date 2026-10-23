import { withRoute } from "@/server/http/route";
import { getCurrentUser, updateProfile } from "@/server/services/auth.service";
import { ProfileUpdateInput } from "@/shared/contracts/address";

/** GET /api/v1/auth/me */
export const GET = withRoute({ auth: "required" }, async ({ actor }) =>
  getCurrentUser(actor.userId),
);

/** PATCH /api/v1/auth/me — name and email. */
export const PATCH = withRoute(
  { auth: "required", body: ProfileUpdateInput },
  async ({ actor, body }) => updateProfile(actor.userId, body),
);
