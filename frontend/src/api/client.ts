import { getAuthToken } from "./tokenStore";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const IS_PROXIED = BASE_URL.includes("/proxy/");

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeout?: number;
  params?: Record<string, string | number | undefined>;
}

const buildUrl = (
  path: string,
  params?: Record<string, string | number | undefined>,
): string => {
  const url = `${BASE_URL}${path}`;
  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.append(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `${url}?${qs}` : url;
};

const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const {
    method = "GET",
    headers = {},
    body,
    timeout = 30000,
    params,
  } = options;
  const url = buildUrl(path, params);

  const token = getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: { "ngrok-skip-browser-warning": "true", ...authHeaders, ...headers },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const err = new Error(
        errorBody.detail || `HTTP ${res.status}`,
      ) as Error & {
        status: number;
        detail?: string;
      };
      err.status = res.status;
      err.detail = errorBody.detail;
      throw err;
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

export const get = <T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  timeout?: number,
): Promise<T> => request<T>(path, { params, timeout });

export const post = <T>(path: string, body: BodyInit, headers?: Record<string, string>, timeout?: number): Promise<T> =>
  request<T>(path, { method: "POST", body, headers, timeout });

export const put = <T>(path: string, body: BodyInit, headers?: Record<string, string>): Promise<T> =>
  request<T>(path, { method: "PUT", body, headers });
