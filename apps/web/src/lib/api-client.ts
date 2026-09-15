// Thin fetch wrapper for the NestJS API. Sends credentials (the HttpOnly
// refresh cookie) on every request and attaches the in-memory access token.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Unexpected error" }));
    throw new ApiError(res.status, body.message ?? "Unexpected error");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// PDF endpoints return raw bytes, not JSON, and need the same Bearer token
// as apiFetch - a plain <a href> can't attach that header, so downloads
// are triggered via a short-lived object URL instead. Most PDF endpoints
// are simple GETs; bulk generation needs a POST body (which member IDs to
// include), so this accepts optional RequestInit overrides for that case.
export async function downloadPdf(path: string, filename: string, options: RequestInit = {}): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Unable to generate this document." }));
    throw new ApiError(res.status, body.message ?? "Unable to generate this document.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
