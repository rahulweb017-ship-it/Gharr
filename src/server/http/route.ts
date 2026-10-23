import { randomUUID } from "node:crypto";
import type { ZodSchema, ZodTypeDef } from "zod";
import type { Role } from "@prisma/client";
import { logger } from "@/server/logger";
import {
  type Actor,
  assertCsrfSafe,
  requireActor,
  requireRole,
  resolveActor,
} from "@/server/auth/session";
import { ValidationError } from "./errors";
import { fail } from "./response";
import {
  type RateLimitRule,
  enforce,
  hashKey,
  sweepExpired,
} from "./rate-limit";
import { sweepExpiredOtps } from "@/server/auth/otp";

/**
 * The single wrapper every API route uses.
 *
 * It owns the concerns that must never be forgotten on any endpoint —
 * authentication, role gating, CSRF, input validation, rate limiting, the
 * response envelope and error mapping — so a handler contains only business
 * intent:
 *
 *   export const POST = withRoute(
 *     { auth: "required", body: CreateBookingInput,
 *       rateLimit: { rule: RATE_LIMITS.bookingCreatePerUserHour } },
 *     async ({ actor, body }) => bookingService.create(actor, body),
 *   );
 *
 * Handlers return plain data; the wrapper serialises it. Throwing an AppError is
 * the only way to produce a non-2xx response.
 */

type AuthMode = "required" | "optional" | "public";

export interface RouteContext<TBody, TQuery, TParams> {
  request: Request;
  actor: Actor;
  /** Null only when `auth` is "optional" or "public". */
  maybeActor: Actor | null;
  body: TBody;
  query: TQuery;
  params: TParams;
  requestId: string;
  ipHash: string;
}

export interface RouteConfig<TBody, TQuery, TParams> {
  auth?: AuthMode;
  roles?: Role[];
  body?: ZodSchema<TBody, ZodTypeDef, unknown>;
  query?: ZodSchema<TQuery, ZodTypeDef, unknown>;
  params?: ZodSchema<TParams, ZodTypeDef, unknown>;
  rateLimit?: {
    rule: RateLimitRule;
    /** Defaults to the user id when authenticated, otherwise the hashed IP. */
    keyBy?: "user" | "ip";
  };
  /** HTTP status for a successful response. Defaults to 200. */
  status?: number;
}

/**
 * Next passes route params as a promise in the App Router, and generates a
 * per-route type check against the handler signature. Accepting `unknown` and
 * narrowing inside satisfies that check for both static and dynamic routes,
 * which a concrete params type does not.
 */
type NextRouteArgs = { params?: Promise<Record<string, string>> };

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  const raw = await request.text();
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body is not valid JSON");
  }
}

function parseQuery(request: Request): Record<string, string | string[]> {
  const url = new URL(request.url);
  const result: Record<string, string | string[]> = {};

  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }

  return result;
}

function validate<T>(
  schema: ZodSchema<T, ZodTypeDef, unknown> | undefined,
  value: unknown,
  label: string,
): T {
  if (!schema) return value as T;

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid ${label}`,
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || label,
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

export function withRoute<TResult, TBody = undefined, TQuery = undefined, TParams = undefined>(
  config: RouteConfig<TBody, TQuery, TParams>,
  handler: (ctx: RouteContext<TBody, TQuery, TParams>) => Promise<TResult>,
) {
  return async function route(
    request: Request,
    context: unknown,
  ): Promise<Response> {
    const args = (context ?? {}) as NextRouteArgs;
    const requestId = randomUUID();
    const started = Date.now();
    const authMode: AuthMode = config.auth ?? "public";
    const ipHash = hashKey(clientIp(request));

    const log = logger.child({
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
    });

    try {
      if (authMode !== "public") {
        assertCsrfSafe(request);
      }

      const maybeActor =
        authMode === "required"
          ? await requireActor(request)
          : await resolveActor(request);

      if (config.roles?.length && maybeActor) {
        requireRole(maybeActor, config.roles);
      }

      if (config.rateLimit) {
        const { rule, keyBy } = config.rateLimit;
        const key =
          keyBy === "ip" || !maybeActor ? ipHash : maybeActor.userId;
        await enforce(rule, key);
      }

      const rawParams = args.params ? await args.params : {};

      const ctx: RouteContext<TBody, TQuery, TParams> = {
        request,
        actor: (maybeActor ?? { userId: "", roles: [] }) as Actor,
        maybeActor,
        body: validate(config.body, await parseBody(request), "request body"),
        query: validate(config.query, parseQuery(request), "query parameters"),
        params: validate(config.params, rawParams, "route parameters"),
        requestId,
        ipHash,
      };

      const result = await handler(ctx);

      // Opportunistic housekeeping — no cron on a Windows dev machine.
      void sweepExpired();
      void sweepExpiredOtps();

      log.debug({ ms: Date.now() - started }, "request ok");

      if (result === undefined || result === null) {
        return new Response(null, { status: 204 });
      }

      // A handler that needs custom headers (cookies, redirects) may return a
      // Response directly instead of data.
      if (result instanceof Response) return result;

      return Response.json(
        { data: result },
        { status: config.status ?? 200, headers: { "X-Request-Id": requestId } },
      );
    } catch (error) {
      log.debug({ ms: Date.now() - started }, "request failed");
      return fail(error, requestId);
    }
  };
}
