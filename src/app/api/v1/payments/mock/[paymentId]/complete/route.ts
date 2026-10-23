import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { prisma } from "@/server/db/prisma";
import { env, isProduction } from "@/server/env";
import { signMockWebhook } from "@/server/services/payment";
import { NotFoundError } from "@/server/http/errors";

const Params = z.object({ paymentId: z.string().min(1) });
const Body = z.object({ outcome: z.enum(["success", "failure"]) });

/**
 * POST /api/v1/payments/mock/:paymentId/complete  (development only)
 *
 * The test gateway page cannot sign a webhook itself — the HMAC secret must
 * never reach the browser. So it asks this endpoint to sign a payload and post
 * it to the real webhook handler on its behalf. The signing and verification
 * paths exercised are the production ones; only the trigger is synthetic.
 *
 * Returns 404 in production and whenever the mock provider is not selected, so
 * it cannot exist as a live payment bypass.
 */
export const POST = withRoute(
  { auth: "required", params: Params, body: Body },
  async ({ actor, params, body }) => {
    if (isProduction || env.PAYMENT_PROVIDER !== "mock") {
      throw new NotFoundError("Endpoint");
    }

    // Scoped to the caller's own payment: this must not become a way to settle
    // somebody else's order.
    const payment = await prisma.payment.findFirst({
      where: { id: params.paymentId, userId: actor.userId },
      select: { id: true, providerOrderId: true },
    });

    if (!payment?.providerOrderId) throw new NotFoundError("Payment");

    const payload = JSON.stringify({
      eventId: `mockevt_${payment.id}_${body.outcome}`,
      providerOrderId: payment.providerOrderId,
      providerPaymentId: `mockpay_${payment.id}`,
      outcome: body.outcome,
      method: "UPI",
      vpa: "test@upi",
    });

    const response = await fetch(
      `${env.APP_BASE_URL}/api/v1/payments/webhook/mock`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mock-signature": signMockWebhook(payload),
        },
        body: payload,
      },
    );

    return {
      forwarded: true,
      webhookStatus: response.status,
      outcome: body.outcome,
    };
  },
);
