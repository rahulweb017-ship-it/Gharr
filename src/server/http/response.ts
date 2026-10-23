import { AppError, isAppError } from "./errors";
import { isProduction } from "@/server/env";
import { logger } from "@/server/logger";

/**
 * Every endpoint answers in one of two shapes:
 *
 *   { data: T, meta?: {...} }
 *   { error: { code, message, details? } }
 *
 * A single envelope means the API client — web today, React Native later —
 * has exactly one success path and one failure path to implement.
 */

export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit): Response {
  return Response.json({ data, ...(meta ? { meta } : {}) } satisfies ApiSuccess<T>, {
    status: 200,
    ...init,
  });
}

export function created<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data } satisfies ApiSuccess<T>, { status: 201, ...init });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Maps a thrown value to the failure envelope.
 *
 * Unexpected errors are logged with their stack but answered with a generic
 * message in production — internal details are an information leak.
 */
export function fail(error: unknown, requestId?: string): Response {
  if (isAppError(error)) {
    const headers: Record<string, string> = {};
    if (error.retryAfter != null) {
      headers["Retry-After"] = String(error.retryAfter);
    }
    if (requestId) headers["X-Request-Id"] = requestId;

    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      } satisfies ApiFailure,
      { status: error.status, headers },
    );
  }

  logger.error(
    { err: error, requestId },
    "Unhandled error in route handler",
  );

  return Response.json(
    {
      error: {
        code: "INTERNAL",
        message: isProduction
          ? "Something went wrong. Please try again."
          : error instanceof Error
            ? error.message
            : String(error),
        ...(isProduction
          ? {}
          : { details: error instanceof Error ? error.stack : undefined }),
      },
    } satisfies ApiFailure,
    {
      status: 500,
      headers: requestId ? { "X-Request-Id": requestId } : {},
    },
  );
}

export function buildMeta(
  page: number,
  perPage: number,
  total: number,
): ApiMeta {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page,
    perPage,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

export { AppError };
