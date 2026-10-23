import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { OtpPurpose } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { ConflictError, ValidationError } from "@/server/http/errors";

/**
 * Phone OTP issuing and verification.
 *
 * The code itself is never stored. What goes in the database is
 * HMAC-SHA256(code + phone, OTP_PEPPER): binding the phone into the hash means a
 * code issued for one number cannot be replayed against another, and the pepper
 * means a database dump alone does not let an attacker verify guesses offline.
 */

const CODE_LENGTH = 6;
const TTL_MINUTES = 5;

export function generateCode(): string {
  // randomInt is CSPRNG-backed; Math.random is not acceptable for a credential.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function hashCode(code: string, phoneE164: string): string {
  return createHmac("sha256", env.OTP_PEPPER)
    .update(`${code}:${phoneE164}`)
    .digest("hex");
}

/**
 * Seeded demo accounts use a fixed code so the app can be demonstrated without
 * reading the server terminal. Restricted to the dev phone prefix AND the
 * console SMS provider, so it cannot apply to a real number or a real deployment.
 */
export function isDevPhone(phoneE164: string): boolean {
  return (
    env.SMS_PROVIDER === "console" &&
    phoneE164.startsWith(env.DEV_PHONE_PREFIX)
  );
}

/**
 * Until a real SMS provider is set up nobody can receive a code, so it is sent
 * back to the client and shown on the login screen, for every number. Both
 * conditions are refused at boot in production (see src/server/env.ts).
 */
function shouldEchoCode(): boolean {
  return env.OTP_DEV_ECHO && env.SMS_PROVIDER === "console";
}

export const DEV_FIXED_CODE = "000000";

export interface IssuedOtp {
  code: string;
  expiresAt: Date;
  /** Present only while SMS is not configured; echoed to the client to ease testing. */
  devCode?: string;
}

export async function issueOtp(
  phoneE164: string,
  purpose: OtpPurpose = "LOGIN",
  context: { ipHash?: string; userAgentHash?: string } = {},
): Promise<IssuedOtp> {
  const code = isDevPhone(phoneE164) ? DEV_FIXED_CODE : generateCode();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // Any earlier live code for this phone is burnt, so only the newest SMS works.
  await prisma.otpRequest.updateMany({
    where: { phoneE164, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otpRequest.create({
    data: {
      phoneE164,
      codeHash: hashCode(code, phoneE164),
      purpose,
      expiresAt,
      ipHash: context.ipHash,
      userAgentHash: context.userAgentHash,
    },
  });

  return {
    code,
    expiresAt,
    devCode: shouldEchoCode() ? code : undefined,
  };
}

/**
 * Verifies a submitted code.
 *
 * Failed attempts are counted against the OTP row itself, in addition to the
 * per-phone rate limit, so an attacker cannot brute-force a single live code by
 * spreading guesses over time.
 */
export async function verifyOtp(
  phoneE164: string,
  code: string,
  purpose: OtpPurpose = "LOGIN",
): Promise<void> {
  const record = await prisma.otpRequest.findFirst({
    where: { phoneE164, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new ValidationError("Request a new code to continue");
  }

  if (record.expiresAt < new Date()) {
    await prisma.otpRequest.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw new ValidationError("That code has expired. Request a new one.");
  }

  if (record.attempts >= record.maxAttempts) {
    await prisma.otpRequest.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw new ConflictError("Too many incorrect attempts. Request a new code.");
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(code, phoneE164), "hex");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    const updated = await prisma.otpRequest.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = updated.maxAttempts - updated.attempts;
    throw new ValidationError(
      remaining > 0
        ? `Incorrect code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
        : "Incorrect code. Request a new one.",
    );
  }

  await prisma.otpRequest.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}

/** Housekeeping for expired rows; called opportunistically alongside the rate-limit sweep. */
export async function sweepExpiredOtps(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  await prisma.otpRequest
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch(() => {
      // Never fail a user request for housekeeping.
    });
}
