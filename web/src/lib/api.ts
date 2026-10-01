import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// Lazily-imported Clerk token getter avoids importing auth at module top-level
// (which is needed for server components / public pages too).
let tokenResolver: (() => Promise<string | null>) | null = null;
export function setTokenResolver(fn: () => Promise<string | null>) {
  tokenResolver = fn;
}

let orgResolver: (() => string | null | undefined) | null = null;
export function setOrgResolver(fn: () => string | null | undefined) {
  orgResolver = fn;
}

const baseURL =
  process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api`
    : '/api/backend';

export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (tokenResolver) {
    const token = await tokenResolver();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  if (orgResolver) {
    const org = orgResolver();
    if (org) config.headers['x-organization-id'] = org;
  }
  return config;
});

// Unwrap the server's { success, data, meta } envelope so callers get `data`.
http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success === false) {
        return Promise.reject(new Error(body.message || 'Request failed'));
      }
      // Preserve pagination meta when present.
      if ('meta' in body && body.meta) return { ...res, data: { data: body.data, ...body.meta } };
      return { ...res, data: body.data };
    }
    return res;
  },
  (error) => {
    const message =
      error?.response?.data?.message || error?.message || 'Network error — is the API server running?';
    return Promise.reject(new Error(message));
  }
);

export const api = {
  get: <T = any>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data),
  post: <T = any>(url: string, data?: object) => http.post<T>(url, data).then((r) => r.data),
  put: <T = any>(url: string, data?: object) => http.put<T>(url, data).then((r) => r.data),
  patch: <T = any>(url: string, data?: object) => http.patch<T>(url, data).then((r) => r.data),
  delete: <T = any>(url: string) => http.delete<T>(url).then((r) => r.data),
  upload: <T = any>(url: string, form: FormData) =>
    http.post<T>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
};

/** Upload a Multer-served file path to an absolute URL. */
export function assetUrl(path?: string | null) {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
