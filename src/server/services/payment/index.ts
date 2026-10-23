import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "@prisma/client";
import { env, isProduction } from "@/server/env";
import { logger } from "@/server/logger";
import { PaymentError, ProviderNotConfiguredError } from "@/server/http/errors";
import type {
  CreateIntentInput,
  CreateIntentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifiedWebhook,
} from "./types";

/**
 * Cash on delivery.
 *
 * COD is a first-class provider rather than an `if` branch in checkout, so the
 * order pipeline stays uniform and COD-specific rules (capture on delivery, no
 * refund path) are testable in isolation. In India this remains a large share of
 * volume, so it cannot be an afterthought.
 */
class CodProvider implements PaymentProvider {
  readonly key = "cod";
  readonly supportsRefund = false;
  readonly isDeferred = true;

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    return {
      providerOrderId: `cod_${input.checkoutGroupId}`,
      status: "PENDING",
      clientPayload: { method: "COD", collectOnDelivery: input.amountPaise },
    };
  }

  async verifyWebhook(): Promise<VerifiedWebhook> {
    throw new PaymentError("Cash on delivery does not receive webhooks");
  }

  async fetchStatus(): Promise<PaymentStatus> {
    return "PENDING";
  }

  async refund(): Promise<RefundResult> {
    // Nothing was collected, so there is nothing to send back through a gateway.
    throw new PaymentError(
      "Cash-on-delivery orders are refunded outside the app",
    );
  }
}

/**
 * Offline mock gateway for development.
 *
 * `createIntent` returns a redirect to an in-app page offering Succeed / Fail /
 * Abandon. Each button posts an HMAC-signed body to the same webhook endpoint a
 * real provider would call, so the code under test is the production code.
 */
class MockProvider implements PaymentProvider {
  readonly key = "mock";
  readonly supportsRefund = true;
  readonly isDeferred = false;

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const providerOrderId = `mock_${input.paymentId}`;

    return {
      providerOrderId,
      status: "CREATED",
      clientPayload: {
        redirectUrl: `/dev/pay/${input.paymentId}`,
        providerOrderId,
        amountPaise: input.amountPaise,
      },
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<VerifiedWebhook> {
    const signature = headers["x-mock-signature"] ?? "";
    const expected = createHmac("sha256", env.MOCK_PAYMENT_SECRET)
      .update(rawBody)
      .digest("hex");

    const signatureValid = safeEqual(signature, expected);
    const payload = JSON.parse(rawBody) as {
      eventId?: string;
      providerOrderId: string;
      providerPaymentId?: string;
      outcome: "success" | "failure";
      method?: string;
      vpa?: string;
    };

    return {
      eventId: payload.eventId ?? randomUUID(),
      providerOrderId: payload.providerOrderId,
      providerPaymentId: payload.providerPaymentId ?? `mockpay_${randomUUID()}`,
      status: payload.outcome === "success" ? "CAPTURED" : "FAILED",
      signatureValid,
      metadata: { method: payload.method ?? "UPI", vpa: payload.vpa },
      ...(payload.outcome === "failure"
        ? { failureCode: "MOCK_DECLINED", failureMessage: "Payment declined by the test gateway" }
        : {}),
    };
  }

  async fetchStatus(): Promise<PaymentStatus> {
    return "CREATED";
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      providerRefundId: `mockrfnd_${randomUUID()}`,
      status: input.amountPaise > 0 ? "REFUNDED" : "FAILED",
    };
  }
}

/**
 * Razorpay.
 *
 * Signature verification is written and unit-testable now because it is the one
 * genuinely security-critical part of a gateway integration — getting it wrong
 * means accepting forged payment confirmations. Intent creation throws until
 * merchant keys exist.
 */
class RazorpayProvider implements PaymentProvider {
  readonly key = "razorpay";
  readonly supportsRefund = true;
  readonly isDeferred = false;

  async createIntent(): Promise<CreateIntentResult> {
    throw new ProviderNotConfiguredError("razorpay");
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<VerifiedWebhook> {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new ProviderNotConfiguredError("razorpay");

    const signature = headers["x-razorpay-signature"] ?? "";
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const signatureValid = safeEqual(signature, expected);

    const payload = JSON.parse(rawBody) as {
      event: string;
      payload: {
        payment: {
          entity: {
            id: string;
            order_id: string;
            status: string;
            method?: string;
            card?: { last4?: string; network?: string };
            vpa?: string;
            bank?: string;
            wallet?: string;
            error_code?: string;
            error_description?: string;
          };
        };
      };
    };

    const entity = payload.payload.payment.entity;

    const status: PaymentStatus =
      entity.status === "captured"
        ? "CAPTURED"
        : entity.status === "authorized"
          ? "AUTHORIZED"
          : entity.status === "failed"
            ? "FAILED"
            : "PENDING";

    return {
      eventId: entity.id,
      providerOrderId: entity.order_id,
      providerPaymentId: entity.id,
      status,
      signatureValid,
      metadata: {
        method: entity.method,
        last4: entity.card?.last4,
        network: entity.card?.network,
        vpa: entity.vpa,
        bank: entity.bank,
        wallet: entity.wallet,
      },
      ...(entity.error_code
        ? { failureCode: entity.error_code, failureMessage: entity.error_description }
        : {}),
    };
  }

  async fetchStatus(): Promise<PaymentStatus> {
    throw new ProviderNotConfiguredError("razorpay");
  }

  async refund(): Promise<RefundResult> {
    throw new ProviderNotConfiguredError("razorpay");
  }
}

/** Constant-time comparison — a fast-exit compare on a signature leaks bytes. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

const PROVIDERS: Record<string, PaymentProvider> = {
  cod: new CodProvider(),
  mock: new MockProvider(),
  razorpay: new RazorpayProvider(),
};

/** Resolves the provider for a payment method, falling back to the configured default. */
export function getPaymentProvider(method?: string): PaymentProvider {
  if (method === "COD") return PROVIDERS.cod;

  const provider = PROVIDERS[env.PAYMENT_PROVIDER];
  if (!provider) {
    throw new ProviderNotConfiguredError(env.PAYMENT_PROVIDER);
  }

  if (provider.key === "mock" && isProduction) {
    logger.error("Mock payment provider selected in production");
    throw new ProviderNotConfiguredError("mock");
  }

  return provider;
}

export function getProviderByKey(key: string): PaymentProvider {
  const provider = PROVIDERS[key];
  if (!provider) throw new ProviderNotConfiguredError(key);
  return provider;
}

/** Signs a mock webhook body. Used only by the dev payment page. */
export function signMockWebhook(rawBody: string): string {
  return createHmac("sha256", env.MOCK_PAYMENT_SECRET).update(rawBody).digest("hex");
}
