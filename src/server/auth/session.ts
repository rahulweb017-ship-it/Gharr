import type { Role } from "@prisma/client";
import { env, isProduction } from "@/server/env";
import { verifyAccessToken } from "./tokens";
import { ForbiddenError, UnauthenticatedError } from "@/server/http/errors";

/**
 * Session resolution.
 *
 * The web client and the future React Native client differ in exactly one way:
 * where the token is carried. Web uses httpOnly cookies (immune to XSS token
 * theft); mobile uses an Authorization header with the token in SecureStore,
 * because a native app has no cookie jar worth relying on.
 *
 * Resolution order is Authorization header first, then cookie — one code path
 * serving both, with no branching in any route handler.
 */

export const ACCESS_COOKIE = "ha_at";
export const REFRESH_COOKIE = "ha_rt";
export const CLIENT_HEADER = "x-gharr-client";

export interface Actor {
  userId: string;
  roles: Role[];
}

/** The system itself, for transitions driven by webhooks or scheduled sweeps. */
export const SYSTEM_ACTOR: Actor = { userId: "system", roles: [] };

export function isMobileClient(request: Request): boolean {
  return request.headers.get(CLIENT_HEADER) === "mobile";
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function extractAccessToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return readCookie(request, ACCESS_COOKIE);
}

export function extractRefreshToken(request: Request, bodyToken?: string): string | undefined {
  return bodyToken ?? readCookie(request, REFRESH_COOKIE);
}

/** Returns the actor, or null when the request is anonymous. */
export async function resolveActor(request: Request): Promise<Actor | null> {
  const token = extractAccessToken(request);
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return { userId: claims.sub, roles: claims.roles };
}

export async function requireActor(request: Request): Promise<Actor> {
  const actor = await resolveActor(request);
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

export function requireRole(actor: Actor, roles: Role[]): void {
  if (roles.length === 0) return;
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new ForbiddenError();
  }
}

export function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role);
}

/**
 * CSRF defence for cookie-based requests.
 *
 * A custom header cannot be set by a cross-site HTML form, and setting it from
 * script forces a CORS preflight that a hostile origin will not pass. Combined
 * with SameSite=Lax cookies this removes the need for CSRF token plumbing.
 */
export function assertCsrfSafe(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;

  // Bearer-token requests cannot be CSRF'd: a browser will not attach the header
  // automatically.
  if (request.headers.get("authorization")?.startsWith("Bearer ")) return;

  const client = request.headers.get(CLIENT_HEADER);
  if (client !== "web" && client !== "mobile") {
    throw new ForbiddenError("Missing client header");
  }
}

interface CookieOptions {
  maxAgeSeconds: number;
}

function serialiseCookie(
  name: string,
  value: string,
  { maxAgeSeconds }: CookieOptions,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Builds Set-Cookie headers for a web sign-in. Mobile clients receive the tokens
 * in the response body instead and store them in SecureStore.
 */
export function buildSessionCookies(
  accessToken: string,
  refreshToken: string,
): string[] {
  return [
    serialiseCookie(ACCESS_COOKIE, accessToken, {
      maxAgeSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    }),
    serialiseCookie(REFRESH_COOKIE, refreshToken, {
      maxAgeSeconds: env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600,
    }),
  ];
}

export function buildClearedCookies(): string[] {
  return [
    serialiseCookie(ACCESS_COOKIE, "", { maxAgeSeconds: 0 }),
    serialiseCookie(REFRESH_COOKIE, "", { maxAgeSeconds: 0 }),
  ];
}
