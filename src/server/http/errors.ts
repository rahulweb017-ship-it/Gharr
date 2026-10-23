/**
 * Error taxonomy.
 *
 * Services throw these; the route wrapper is the only place that turns them into
 * HTTP. That keeps the service layer free of Next/Request/Response types, which
 * is what lets it move into a shared package for the React Native app later.
 */

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "PROVIDER_NOT_CONFIGURED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_FAILED: 402,
  PROVIDER_NOT_CONFIGURED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Seconds until the client may retry. Surfaces as the Retry-After header. */
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: unknown; retryAfter?: number } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
    this.retryAfter = options.retryAfter;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted data is invalid", details?: unknown) {
    super("VALIDATION_FAILED", message, { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Sign in to continue") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this") {
    super("FORBIDDEN", message);
  }
}

/**
 * Also used for resources the caller does not own.
 *
 * Returning 404 rather than 403 for someone else's order is deliberate: a 403
 * confirms the record exists, which is an enumeration oracle.
 */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("NOT_FOUND", `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, { details });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number, message = "Too many attempts. Please wait and try again.") {
    super("RATE_LIMITED", message, { retryAfter });
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: unknown) {
    super("PAYMENT_FAILED", message, { details });
  }
}

export class ProviderNotConfiguredError extends AppError {
  constructor(provider: string) {
    super("PROVIDER_NOT_CONFIGURED", `Payment provider '${provider}' is not configured`);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
