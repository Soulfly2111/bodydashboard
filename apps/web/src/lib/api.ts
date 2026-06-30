const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export type ApiError = { error: string; details?: unknown };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("macroflow.token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: response.statusText }))) as ApiError;
    throw new Error(payload.error);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}
