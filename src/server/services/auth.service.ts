import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { issueOtp, verifyOtp } from "@/server/auth/otp";
import { getSmsProvider } from "@/server/auth/sms";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "@/server/auth/tokens";
import { hashKey, RATE_LIMITS, enforceAll } from "@/server/http/rate-limit";
import { NotFoundError } from "@/server/http/errors";
import type { SendOtpResult, AuthResult } from "@/shared/contracts/auth";
import type { ProfileUpdateInput } from "@/shared/contracts/address";

/**
 * Phone-OTP authentication.
 *
 * Sign-up and sign-in are the same action: there is no password and no separate
 * registration screen. A phone number that verifies and has no account gets one,
 * which is the right model for a market where users will not tolerate a
 * multi-step form.
 */

export interface AuthContext {
  ipHash: string;
  userAgent?: string;
  isMobile: boolean;
}

export async function sendOtp(
  phoneE164: string,
  context: AuthContext,
): Promise<SendOtpResult> {
  // Layered limits: per-minute stops hammering, per-hour and per-day stop
  // SMS-pumping fraud, per-IP stops enumeration across many numbers.
  await enforceAll(
    [
      RATE_LIMITS.otpSendPerPhoneMinute,
      RATE_LIMITS.otpSendPerPhoneHour,
      RATE_LIMITS.otpSendPerPhoneDay,
    ],
    phoneE164,
  );
  await enforceAll([RATE_LIMITS.otpSendPerIpHour], context.ipHash);

  const otp = await issueOtp(phoneE164, "LOGIN", {
    ipHash: context.ipHash,
    userAgentHash: context.userAgent ? hashKey(context.userAgent) : undefined,
  });

  await getSmsProvider().send(phoneE164, "OTP_LOGIN", { code: otp.code });

  return {
    sent: true,
    expiresAt: otp.expiresAt.toISOString(),
    ...(otp.devCode ? { devCode: otp.devCode } : {}),
  };
}

export async function verifyOtpAndSignIn(
  phoneE164: string,
  code: string,
  name: string | undefined,
  context: AuthContext,
): Promise<AuthResult> {
  await enforceAll([RATE_LIMITS.otpVerifyPerPhoneHour], phoneE164);

  await verifyOtp(phoneE164, code, "LOGIN");

  const existing = await prisma.user.findUnique({
    where: { phoneE164 },
    select: { id: true, name: true, roles: true, isActive: true },
  });

  let user = existing;
  const isNewUser = !existing;

  if (!user) {
    user = await prisma.user.create({
      data: {
        phoneE164,
        phoneVerifiedAt: new Date(),
        name: name ?? null,
        roles: ["CUSTOMER"],
        // Every customer gets a cart up front, so cart writes never have to
        // create-or-find under concurrency.
        cart: { create: {} },
      },
      select: { id: true, name: true, roles: true, isActive: true },
    });

    logger.info({ userId: user.id }, "New user registered");
  } else {
    if (!user.isActive) {
      throw new NotFoundError("Account");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        phoneVerifiedAt: new Date(),
        ...(name && !user.name ? { name } : {}),
      },
    });

    // Older accounts, and vendor/worker users created by the seed, may not have
    // a cart yet.
    await prisma.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  const accessToken = await signAccessToken(user.id, user.roles);
  const refresh = await issueRefreshToken(user.id, {
    client: context.isMobile ? "mobile" : "web",
    ipHash: context.ipHash,
    userAgentHash: context.userAgent ? hashKey(context.userAgent) : undefined,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: isNewUser ? "auth.register" : "auth.login",
      entityType: "User",
      entityId: user.id,
    },
  });

  return {
    user: {
      id: user.id,
      phone: phoneE164,
      name: user.name ?? name ?? null,
      roles: user.roles,
      isNewUser,
    },
    accessToken,
    refreshToken: refresh.token,
  };
}

export async function refreshSession(
  presentedToken: string,
  context: AuthContext,
) {
  const rotated = await rotateRefreshToken(presentedToken, {
    client: context.isMobile ? "mobile" : "web",
    ipHash: context.ipHash,
    userAgentHash: context.userAgent ? hashKey(context.userAgent) : undefined,
  });

  await enforceAll([RATE_LIMITS.authRefreshPerUserHour], rotated.userId);

  return rotated;
}

export async function signOut(refreshToken: string | undefined) {
  if (refreshToken) await revokeRefreshToken(refreshToken);
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phoneE164: true,
      name: true,
      email: true,
      avatarUrl: true,
      roles: true,
      createdAt: true,
      addresses: {
        where: { deletedAt: null },
        orderBy: { isDefault: "desc" },
        select: {
          id: true,
          type: true,
          contactName: true,
          contactPhone: true,
          line1: true,
          line2: true,
          landmark: true,
          city: true,
          state: true,
          pincode: true,
          isDefault: true,
        },
      },
      _count: { select: { orders: true, bookings: true } },
    },
  });

  if (!user) throw new NotFoundError("User");

  return {
    id: user.id,
    phone: user.phoneE164,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    roles: user.roles,
    memberSince: user.createdAt,
    addresses: user.addresses,
    orderCount: user._count.orders,
    bookingCount: user._count.bookings,
  };
}

/** Name and email only — the phone number is the identity and changes via OTP. */
export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    },
  });
  return getCurrentUser(userId);
}

/** Exposed so the login screen can explain that dev numbers use a fixed code. */
export const DEV_PHONE_PREFIX = env.DEV_PHONE_PREFIX;
