import { withRoute } from "@/server/http/route";
import { refreshSession } from "@/server/services/auth.service";
import { RefreshInput } from "@/shared/contracts/auth";
import {
  buildSessionCookies,
  extractRefreshToken,
  isMobileClient,
} from "@/server/auth/session";
import { UnauthenticatedError } from "@/server/http/errors";

/**
 * POST /api/v1/auth/refresh
 *
 * Rotates the refresh token on every call. Presenting an already-rotated token
 * revokes the whole family — see server/auth/tokens.ts.
 */
export const POST = withRoute(
  { auth: "public", body: RefreshInput },
  async ({ body, request, ipHash }) => {
    const isMobile = isMobileClient(request);
    const presented = extractRefreshToken(request, body.refreshToken);

    if (!presented) throw new UnauthenticatedError();

    const rotated = await refreshSession(presented, {
      ipHash,
      userAgent: request.headers.get("user-agent") ?? undefined,
      isMobile,
    });

    const headers = new Headers({ "content-type": "application/json" });

    if (!isMobile) {
      for (const cookie of buildSessionCookies(
        rotated.accessToken,
        rotated.refreshToken,
      )) {
        headers.append("set-cookie", cookie);
      }
    }

    return new Response(
      JSON.stringify({
        data: isMobile
          ? {
              accessToken: rotated.accessToken,
              refreshToken: rotated.refreshToken,
              expiresAt: rotated.refreshExpiresAt.toISOString(),
            }
          : { refreshed: true },
      }),
      { status: 200, headers },
    );
  },
);
