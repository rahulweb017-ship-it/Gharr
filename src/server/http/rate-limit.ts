import { createHash } from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { RateLimitError } from "./errors";

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Redis is not installed and is not worth running as a second stateful service
 * at this stage. A single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`
 * is atomic and race-free in one round trip, which is all a fixed window needs.
 *
 * Fixed windows allow a burst across a boundary (up to 2x the limit in theory).
 * For OTP and checkout abuse that is an acceptable trade against the complexity
 * of a sliding log.
 */

export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfter: number;
}

/** Named policies, so limits live in one reviewable place rather than scattered. */
export const RATE_LIMITS = {
  otpSendPerPhoneMinute: { bucket: "otp.send.phone.min", limit: 1, windowSec: 60 },
  otpSendPerPhoneHour: { bucket: "otp.send.phone.hour", limit: 5, windowSec: 3600 },
  otpSendPerPhoneDay: { bucket: "otp.send.phone.day", limit: 10, windowSec: 86_400 },
  otpSendPerIpHour: { bucket: "otp.send.ip.hour", limit: 20, windowSec: 3600 },
  otpVerifyPerPhoneHour: { bucket: "otp.verify.phone.hour", limit: 10, windowSec: 3600 },
  authRefreshPerUserHour: { bucket: "auth.refresh.hour", limit: 60, windowSec: 3600 },
  orderCreatePerUserHour: { bucket: "order.create.hour", limit: 20, windowSec: 3600 },
  bookingCreatePerUserHour: { bucket: "booking.create.hour", limit: 20, windowSec: 3600 },
  searchPerIpMinute: { bucket: "search.ip.min", limit: 120, windowSec: 60 },
  estimatePreviewPerIpMinute: { bucket: "estimate.preview.ip.min", limit: 60, windowSec: 60 },
  estimateCreatePerUserHour: { bucket: "estimate.create.hour", limit: 60, windowSec: 3600 },
  reviewCreatePerUserDay: { bucket: "review.create.day", limit: 20, windowSec: 86_400 },
} as const satisfies Record<string, RateLimitRule>;

/** IPs and user agents are hashed before storage — they are personal data. */
export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function windowStart(windowSec: number): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(Date.now() / ms) * ms);
}

/** Records one hit and reports whether it is within the limit. Never throws. */
export async function consume(
  rule: RateLimitRule,
  key: string,
): Promise<RateLimitResult> {
  const start = windowStart(rule.windowSec);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitCounter" ("bucket", "key", "windowStart", "count")
    VALUES (${rule.bucket}, ${key}, ${start}, 1)
    ON CONFLICT ("bucket", "key", "windowStart")
    DO UPDATE SET "count" = "RateLimitCounter"."count" + 1
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 1;
  const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);

  return {
    allowed: count <= rule.limit,
    count,
    limit: rule.limit,
    retryAfter: Math.max(1, rule.windowSec - elapsed),
  };
}

/** Consumes and throws a 429 when the limit is exceeded. */
export async function enforce(rule: RateLimitRule, key: string): Promise<void> {
  const result = await consume(rule, key);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfter);
  }
}

/** Applies several rules to the same key, e.g. per-minute plus per-day on OTP. */
export async function enforceAll(
  rules: RateLimitRule[],
  key: string,
): Promise<void> {
  for (const rule of rules) {
    await enforce(rule, key);
  }
}

/**
 * Drops expired windows. Invoked lazily on roughly 1% of requests rather than
 * on a schedule — Windows development machines have no cron, and the table is
 * tiny enough that this is sufficient.
 */
export async function sweepExpired(probability = 0.01): Promise<void> {
  if (Math.random() > probability) return;

  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  await prisma.rateLimitCounter
    .deleteMany({ where: { windowStart: { lt: cutoff } } })
    .catch(() => {
      // Housekeeping must never fail a user request.
    });
}
