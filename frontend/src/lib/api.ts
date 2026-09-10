import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiErrorBody, ApiResponse, AuthPayload } from '@/types';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

/** refresh token lives in an httpOnly cookie, so every call sends credentials. */
export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** a bare client for the refresh call itself — never runs the retry interceptor. */
const refreshClient = axios.create({ baseURL, withCredentials: true });

export class ApiError extends Error {
  status: number;
  fieldErrors: { field: string; message: string }[];

  constructor(message: string, status: number, fieldErrors: { field: string; message: string }[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<ApiErrorBody>;
    if (err.response) {
      return new ApiError(
        err.response.data?.message || 'Request failed',
        err.response.status,
        err.response.data?.errors ?? []
      );
    }
    return new ApiError('Cannot reach the EventSphere server. Check your connection and try again.', 0);
  }
  return new ApiError(error instanceof Error ? error.message : 'Unexpected error', 0);
}

// silent refresh
// concurrent 401s share one refresh call instead of firing a stampede.
let refreshPromise: Promise<AuthPayload> | null = null;

export function refreshSession(): Promise<AuthPayload> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiResponse<AuthPayload>>('/auth/refresh')
      .then((res) => {
        const payload = res.data.data;
        useAuthStore.getState().setSession(payload);
        return payload;
      })
      .catch((err) => {
        useAuthStore.getState().clear();
        throw toApiError(err);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const url = config.url ?? '';
  if (PUBLIC_AUTH_PATHS.some((p) => url.startsWith(p))) return config;

  const { accessToken, expiresAt } = useAuthStore.getState();

  // renew proactively when the token is within 30s of expiry, so the user
  // never sees a failed request just because a token aged out mid-click.
  if (accessToken && expiresAt && expiresAt - Date.now() < 30_000) {
    try {
      await refreshSession();
    } catch {
      // fall through — the response interceptor will handle the 401.
    }
  }

  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = original?.url ?? '';

    const shouldRetry =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !PUBLIC_AUTH_PATHS.some((p) => url.startsWith(p));

    if (shouldRetry) {
      original._retried = true;
      try {
        const { accessToken } = await refreshSession();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        return Promise.reject(toApiError(error));
      }
    }

    return Promise.reject(toApiError(error));
  }
);

/** unwraps `{ success, data, message }` so callers work with `data` directly. */
export async function request<T>(config: Parameters<AxiosInstance['request']>[0]): Promise<T> {
  const response = await api.request<ApiResponse<T>>(config);
  return response.data.data;
}

/**
 * multipart upload. `Content-Type` is deliberately unset so the browser can
 * add the multipart boundary itself — setting it by hand breaks the parse.
 */
function requestForm<T>(method: 'POST' | 'PATCH', url: string, form: FormData, onProgress?: (percent: number) => void) {
  return request<T>({
    method,
    url,
    data: form,
    headers: { 'Content-Type': undefined },
    onUploadProgress: onProgress
      ? (event) => {
          if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        }
      : undefined,
  });
}

export const http = {
  get: <T>(url: string, params?: unknown) => request<T>({ method: 'GET', url, params }),
  post: <T>(url: string, data?: unknown) => request<T>({ method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown) => request<T>({ method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown) => request<T>({ method: 'PATCH', url, data }),
  delete: <T>(url: string) => request<T>({ method: 'DELETE', url }),
  /**
   * fetch a file through the same authenticated client.
   *
   * a plain <a href> to an API route arrives without the authorization header
   * the interceptor adds, so it 401s. this goes through axios — token
   * injection, silent refresh and all — and hands back a blob.
   */
  download: async (url: string): Promise<Blob> => {
    const response = await api.get(url, { responseType: 'blob' });
    return response.data as Blob;
  },
  postForm: <T>(url: string, form: FormData, onProgress?: (percent: number) => void) =>
    requestForm<T>('POST', url, form, onProgress),
};
