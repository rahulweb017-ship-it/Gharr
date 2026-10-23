import { withRoute } from "@/server/http/route";
import { sendOtp } from "@/server/services/auth.service";
import { SendOtpInput } from "@/shared/contracts/auth";
import { isMobileClient } from "@/server/auth/session";

/** POST /api/v1/auth/send-otp */
export const POST = withRoute(
  { auth: "public", body: SendOtpInput },
  async ({ body, request, ipHash }) =>
    sendOtp(body.phone, {
      ipHash,
      userAgent: request.headers.get("user-agent") ?? undefined,
      isMobile: isMobileClient(request),
    }),
);
