const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export type ApiError = { error: string; details?: unknown };

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  user: unknown;
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await request(path, options);
  if (response.status !== 401 || path === "/auth/login" || path === "/auth/refresh") {
    return parseResponse<T>(response);
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    clearSession();
    window.location.assign("/login");
    return Promise.reject(new Error("Sitzung abgelaufen. Bitte neu einloggen."));
  }

  return parseResponse<T>(await request(path, options));
}

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("macroflow.token");
  return fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("macroflow.refreshToken");
  if (!refreshToken) return false;

  const response = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) return false;

  const payload = await response.json() as RefreshResponse;
  localStorage.setItem("macroflow.token", payload.accessToken);
  localStorage.setItem("macroflow.refreshToken", payload.refreshToken);
  localStorage.setItem("macroflow.user", JSON.stringify(payload.user));
  return true;
}

function clearSession() {
  localStorage.removeItem("macroflow.token");
  localStorage.removeItem("macroflow.refreshToken");
  localStorage.removeItem("macroflow.user");
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: response.statusText }))) as ApiError;
    throw new Error(payload.error);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}
