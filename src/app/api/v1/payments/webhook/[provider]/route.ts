import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger";
import { getProviderByKey } from "@/server/services/payment";
import { whitelistPayload } from "@/server/services/payment/types";
import { transition } from "@/server/services/order.service";
import { SYSTEM_ACTOR } from "@/server/auth/session";
import { fail } from "@/server/http/response";

/**
 * POST /api/v1/payments/webhook/:provider
 *
 * Written by hand rather than through withRoute because signature verification
 * needs the raw request bytes — any JSON round trip can reorder keys or change
 * whitespace and invalidate an otherwise genuine signature.
 *
 * The gateway, not the browser, is the authority on whether money moved. The
 * client's claim of success is never trusted; only a valid signature here moves
 * an order out of PENDING_PAYMENT.
 */
export async function POST(
  request: Request,
  context: unknown,
): Promise<Response> {
  const { params } = (context ?? {}) as {
    params?: Promise<{ provider: string }>;
  };

  const providerKey = params ? (await params).provider : "";

  try {
    const rawBody = await request.text();

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const provider = getProviderByKey(providerKey);
    const event = await provider.verifyWebhook(rawBody, headers);

    // A forged or misconfigured signature is recorded and rejected. Recording it
    // matters: a burst of invalid signatures is an attack signal.
    if (!event.signatureValid) {
      await prisma.webhookEvent.create({
        data: {
          provider: providerKey,
          eventId: `invalid_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          signatureValid: false,
          payload: safeJson(rawBody),
          error: "Signature verification failed",
        },
      });

      logger.warn({ provider: providerKey }, "Rejected webhook with invalid signature");
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Invalid signature" } },
        { status: 403 },
      );
    }

    // Idempotency: gateways retry aggressively, and the unique constraint on
    // (provider, eventId) turns a duplicate delivery into a no-op.
    const existing = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: providerKey, eventId: event.eventId } },
      select: { id: true, processedAt: true },
    });

    if (existing?.processedAt) {
      return Response.json({ data: { received: true, duplicate: true } });
    }

    const record =
      existing ??
      (await prisma.webhookEvent.create({
        data: {
          provider: providerKey,
          eventId: event.eventId,
          signatureValid: true,
          payload: safeJson(rawBody),
        },
        select: { id: true, processedAt: true },
      }));

    const payment = await prisma.payment.findFirst({
      where: { providerOrderId: event.providerOrderId },
      select: { id: true, checkoutGroupId: true, status: true },
    });

    if (!payment) {
      await prisma.webhookEvent.update({
        where: { id: record.id },
        data: { error: "No matching payment", processedAt: new Date() },
      });
      // 200 so the gateway stops retrying something we will never resolve.
      return Response.json({ data: { received: true, matched: false } });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: event.status,
        providerPaymentId: event.providerPaymentId,
        providerPayload: whitelistPayload(event.metadata) as never,
        ...(event.status === "CAPTURED" ? { capturedAt: new Date() } : {}),
        ...(event.status === "AUTHORIZED" ? { authorizedAt: new Date() } : {}),
        ...(event.status === "FAILED"
          ? { failureCode: event.failureCode, failureMessage: event.failureMessage }
          : {}),
      },
    });

    // Every order in the checkout group moves together — the customer paid once.
    const orders = await prisma.order.findMany({
      where: { checkoutGroupId: payment.checkoutGroupId, status: "PENDING_PAYMENT" },
      select: { id: true },
    });

    for (const order of orders) {
      await transition(
        SYSTEM_ACTOR,
        order.id,
        event.status === "CAPTURED" ? "CONFIRMED" : "CANCELLED",
        {
          system: true,
          reason:
            event.status === "CAPTURED"
              ? "Payment received"
              : (event.failureMessage ?? "Payment failed"),
        },
      ).catch((error) => {
        // One order failing must not abandon the rest of the group.
        logger.error({ err: error, orderId: order.id }, "Webhook transition failed");
      });
    }

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date() },
    });

    logger.info(
      { provider: providerKey, status: event.status, orders: orders.length },
      "Webhook processed",
    );

    return Response.json({ data: { received: true, orders: orders.length } });
  } catch (error) {
    logger.error({ err: error, provider: providerKey }, "Webhook handling failed");
    return fail(error);
  }
}

function safeJson(raw: string): object {
  try {
    return JSON.parse(raw) as object;
  } catch {
    return { raw: raw.slice(0, 2000) };
  }
}
