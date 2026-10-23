import { withRoute } from "@/server/http/route";
import { signOut } from "@/server/services/auth.service";
import {
  buildClearedCookies,
  extractRefreshToken,
} from "@/server/auth/session";
import { RefreshInput } from "@/shared/contracts/auth";

/**
 * POST /api/v1/auth/logout
 *
 * Revokes the presented refresh token server-side as well as clearing cookies —
 * clearing the browser's copy alone would leave a valid token in existence.
 * Mobile clients have no cookie jar, so they present the token in the body.
 */
export const POST = withRoute(
  { auth: "optional", body: RefreshInput.default({}) },
  async ({ request, body }) => {
    await signOut(extractRefreshToken(request, body.refreshToken));

    const headers = new Headers({ "content-type": "application/json" });
    for (const cookie of buildClearedCookies()) {
      headers.append("set-cookie", cookie);
    }

    return new Response(JSON.stringify({ data: { signedOut: true } }), {
      status: 200,
      headers,
    });
  },
);
