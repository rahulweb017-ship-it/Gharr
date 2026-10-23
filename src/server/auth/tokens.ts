import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { UnauthenticatedError } from "@/server/http/errors";

/**
 * Two-token scheme, chosen so one implementation serves both clients:
 *
 *   Access token   Short-lived (15 min) stateless JWT. Verifiable without a
 *                  database round trip, including in edge middleware.
 *   Refresh token  Long-lived (60 day) opaque random string, stored hashed and
 *                  rotated on every use.
 *
 * Rotation gives stolen-token containment for free. Each token belongs to a
 * `family`; presenting a token that has already been rotated means two parties
 * hold it, so the entire family is revoked and the event is audited.
 */

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = "gharr";
const AUDIENCE = "gharr-app";

export interface AccessTokenClaims {
  sub: string;
  roles: Role[];
  jti: string;
}

export async function signAccessToken(
  userId: string,
  roles: Role[],
): Promise<string> {
  return new SignJWT({ roles })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secret);
}

/** Returns the claims, or null for any invalid or expired token. */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (!payload.sub) return null;

    return {
      sub: payload.sub,
      roles: (payload.roles as Role[]) ?? [],
      jti: (payload.jti as string) ?? "",
    };
  } catch {
    return null;
  }
}

/** Refresh tokens are stored as a hash — a leaked database dump yields nothing usable. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
  familyId: string;
}

export async function issueRefreshToken(
  userId: string,
  options: {
    client?: string;
    familyId?: string;
    ipHash?: string;
    userAgentHash?: string;
  } = {},
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString("base64url");
  const familyId = options.familyId ?? randomUUID();
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      familyId,
      client: options.client ?? "web",
      expiresAt,
      ipHash: options.ipHash,
      userAgentHash: options.userAgentHash,
    },
  });

  return { token, expiresAt, familyId };
}

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  userId: string;
  roles: Role[];
}

/**
 * Validates a refresh token and swaps it for a fresh pair.
 *
 * Reuse of an already-rotated token revokes the whole family: either the token
 * was stolen, or the legitimate client is retrying against a stale copy. Both
 * cases are resolved safely by forcing a new sign-in.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  options: { client?: string; ipHash?: string; userAgentHash?: string } = {},
): Promise<RotatedTokens> {
  const tokenHash = hashToken(presentedToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw new UnauthenticatedError("Your session has expired. Please sign in again.");
  }

  if (existing.replacedById || existing.revokedAt) {
    await revokeFamily(existing.familyId);
    await prisma.auditLog.create({
      data: {
        actorUserId: existing.userId,
        action: "auth.refresh_reuse_detected",
        entityType: "RefreshToken",
        entityId: existing.id,
        after: { familyId: existing.familyId },
      },
    });
    logger.warn(
      { userId: existing.userId, familyId: existing.familyId },
      "Refresh token reuse detected — family revoked",
    );
    throw new UnauthenticatedError("Your session has expired. Please sign in again.");
  }

  if (existing.expiresAt < new Date()) {
    throw new UnauthenticatedError("Your session has expired. Please sign in again.");
  }

  if (!existing.user.isActive) {
    throw new UnauthenticatedError("This account is no longer active.");
  }

  const next = await issueRefreshToken(existing.userId, {
    client: options.client ?? existing.client,
    familyId: existing.familyId,
    ipHash: options.ipHash,
    userAgentHash: options.userAgentHash,
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: {
      revokedAt: new Date(),
      replacedById: next.familyId,
    },
  });

  const accessToken = await signAccessToken(
    existing.userId,
    existing.user.roles,
  );

  return {
    accessToken,
    refreshToken: next.token,
    refreshExpiresAt: next.expiresAt,
    userId: existing.userId,
    roles: existing.user.roles,
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Used on "sign out of all devices" and on account deactivation. */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
