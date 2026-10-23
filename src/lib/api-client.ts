/**
 * Browser-side API client.
 *
 * Every mutation in the web app goes through here rather than a Server Action,
 * which guarantees that each write the React Native app will need already exists
 * as an exercised REST endpoint. Reads on the server go direct to the service
 * layer; reads in the browser come through here.
 *
 * The X-Gharr-Client header doubles as CSRF defence: a cross-site form cannot
 * set a custom header, and setting one from script forces a CORS preflight that
 * a hostile origin will not pass.
 */

const BASE = "/api/v1";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

interface ApiFailureBody {
  error: { code: string; message: string; details?: unknown };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        // A FormData body needs the browser-generated multipart boundary.
        ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
        "x-gharr-client": "web",
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 204) {
      return { ok: true, data: undefined as T };
    }

    const payload = (await response.json()) as { data: T } | ApiFailureBody;

    if (!response.ok || "error" in payload) {
      const error =
        "error" in payload
          ? payload.error
          : { code: "INTERNAL", message: "Something went wrong" };
      return { ok: false, error };
    }

    return { ok: true, data: payload.data };
  } catch {
    // Network failure, offline, or the request was aborted.
    return {
      ok: false,
      error: {
        code: "NETWORK",
        message: "Could not reach Gharr. Check your connection and try again.",
      },
    };
  }
}

export function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "PATCH",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "PUT",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "DELETE" });
}

/** Multipart upload (KYC documents). */
export function apiUpload<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  return request<T>(path, { method: "POST", body: form });
}
