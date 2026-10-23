import { getApiBaseUrl } from "~/config";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "~/auth/token-store";

/**
 * Native API client for /api/v1.
 *
 * Mirrors src/lib/api-client.ts in the web app, with the mobile differences:
 * - `x-gharr-client: mobile` makes auth endpoints return tokens in the body.
 * - The access token rides in `Authorization: Bearer` (no cookie jar).
 * - A 401 triggers one refresh (shared by every in-flight request) and a retry.
 *
 * Lists are paginated inside `data` ({ items, page, totalPages, ... }).
 * It throws ApiError rather than returning a result union, because React Query
 * treats a thrown error as the failure path.
 */

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Validation failures carry `[{ field, message }]`; map them onto form fields. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const result: Record<string, string> = {};
    for (const item of this.details as FieldError[]) {
      if (item?.field && !result[item.field]) result[item.field] = item.message;
    }
    return result;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
}

/** Called when the session can no longer be refreshed, so the UI can sign out. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

function buildUrl(path: string, query?: Query): string {
  let url = `${getApiBaseUrl()}/api/v1${path}`;
  if (query) {
    const params = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    if (params.length) url += `?${params.join("&")}`;
  }
  return url;
}

const REQUEST_TIMEOUT_MS = 15_000;

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "x-gharr-client": "mobile",
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const token = getAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;

  // An unreachable LAN host can leave fetch hanging for minutes on Android.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      "NETWORK",
      "Could not reach Gharr. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Endpoints that issue tokens; a 401 from them must not trigger a refresh. */
const TOKEN_ENDPOINTS = new Set(["/auth/send-otp", "/auth/verify-otp", "/auth/refresh"]);

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the refresh token. Concurrent callers share one network call. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const presented = getRefreshToken();
      if (!presented) return false;
      try {
        const response = await send("/auth/refresh", {
          method: "POST",
          body: { refreshToken: presented },
        });
        if (!response.ok) {
          // A rejected token is final (expired, revoked or reused); a 5xx or
          // rate limit is not, so keep the token for the next attempt.
          if (response.status === 401 || response.status === 403) await clearTokens();
          return false;
        }
        const payload = (await response.json()) as {
          data: { accessToken: string; refreshToken: string };
        };
        await saveTokens(payload.data);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  let body: { error?: { code: string; message: string; details?: unknown } } | null = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body (proxy page, crash) — fall through to a generic error.
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const wait = retryAfter ? ` Try again in ${retryAfter}s.` : "";
    return new ApiError("RATE_LIMITED", (body?.error?.message ?? "Too many attempts.") + wait, 429, undefined, requestId);
  }

  const error = body?.error ?? { code: "INTERNAL", message: "Something went wrong" };
  if (__DEV__) {
    console.warn(`[api] ${response.status} ${error.code} ${error.message} (request ${requestId ?? "?"})`);
  }
  return new ApiError(error.code, error.message, response.status, error.details, requestId);
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T }> {
  let response = await send(path, options);

  if (response.status === 401 && getRefreshToken() && !TOKEN_ENDPOINTS.has(path)) {
    if (await refreshSession()) {
      response = await send(path, options);
    } else if (!getRefreshToken()) {
      onSessionExpired?.();
    }
  }

  if (response.status === 204) return { data: undefined as T };
  if (!response.ok) throw await toApiError(response);

  return (await response.json()) as { data: T };
}

/** Convenience wrappers returning just `data`. */
export const api = {
  get: <T>(path: string, query?: Query) => apiRequest<T>(path, { query }).then((r) => r.data),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }).then((r) => r.data),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }).then((r) => r.data),
};
