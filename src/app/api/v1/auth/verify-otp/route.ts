import { withRoute } from "@/server/http/route";
import { verifyOtpAndSignIn } from "@/server/services/auth.service";
import { VerifyOtpInput } from "@/shared/contracts/auth";
import { buildSessionCookies, isMobileClient } from "@/server/auth/session";

/**
 * POST /api/v1/auth/verify-otp
 *
 * Web receives the session as httpOnly cookies and no tokens in the body, so a
 * XSS payload cannot read them. Mobile receives the tokens in the body and
 * stores them in SecureStore, because a native client has no useful cookie jar.
 */
export const POST = withRoute(
  { auth: "public", body: VerifyOtpInput },
  async ({ body, request, ipHash }) => {
    const isMobile = isMobileClient(request);

    const result = await verifyOtpAndSignIn(body.phone, body.code, body.name, {
      ipHash,
      userAgent: request.headers.get("user-agent") ?? undefined,
      isMobile,
    });

    const headers = new Headers({ "content-type": "application/json" });

    if (!isMobile) {
      for (const cookie of buildSessionCookies(
        result.accessToken!,
        result.refreshToken!,
      )) {
        headers.append("set-cookie", cookie);
      }
    }

    return new Response(
      JSON.stringify({
        data: isMobile
          ? result
          : { user: result.user },
      }),
      { status: 200, headers },
    );
  },
);
