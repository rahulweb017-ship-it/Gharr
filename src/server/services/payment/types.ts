import type { PaymentMethod, PaymentStatus } from "@prisma/client";

/**
 * Provider-agnostic payment contract.
 *
 * Razorpay/PhonePe merchant onboarding takes weeks (business registration, KYC,
 * policy pages), so development must never depend on it. COD and a signed mock
 * gateway implement the same interface as the real thing, and the mock posts a
 * correctly signed webhook — meaning the development path exercises the exact
 * production state-transition code rather than a shortcut around it.
 */

export interface CreateIntentInput {
  paymentId: string;
  checkoutGroupId: string;
  amountPaise: number;
  method: PaymentMethod;
  customer: { id: string; phone: string; name: string | null };
  /** Where the gateway should return the customer after payment. */
  returnUrl: string;
}

export interface CreateIntentResult {
  providerOrderId: string;
  status: PaymentStatus;
  /**
   * Opaque to Gharr and handed to the client as-is. For a redirect gateway
   * this carries a URL; for a native SDK it carries the checkout options.
   */
  clientPayload: Record<string, unknown>;
}

export interface VerifiedWebhook {
  eventId: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: PaymentStatus;
  signatureValid: boolean;
  /** Whitelisted before persistence — never raw card data. */
  metadata: Record<string, unknown>;
  failureCode?: string;
  failureMessage?: string;
}

export interface RefundInput {
  providerPaymentId: string;
  amountPaise: number;
  reason: string;
  idempotencyKey: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  readonly key: string;
  readonly supportsRefund: boolean;
  /** True when the customer pays on delivery rather than up front. */
  readonly isDeferred: boolean;

  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<VerifiedWebhook>;
  fetchStatus(providerOrderId: string): Promise<PaymentStatus>;
  refund(input: RefundInput): Promise<RefundResult>;
}

/**
 * Only these keys are ever persisted from a provider payload. Everything else is
 * logged and discarded, which keeps card data out of the database by
 * construction rather than by reviewer vigilance.
 */
export const SAFE_PAYLOAD_KEYS = [
  "method",
  "last4",
  "bank",
  "vpa",
  "wallet",
  "network",
] as const;

export function whitelistPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_PAYLOAD_KEYS) {
    if (payload[key] !== undefined) safe[key] = payload[key];
  }
  return safe;
}
