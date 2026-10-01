import { config } from './config';

/**
 * Minimal fetch-based REST client. A token + org resolver are injected by the
 * auth bridge once Clerk is initialised, mirroring the web app's axios design.
 * Server envelope { success, data, meta } is unwrapped here.
 */

let tokenResolver: (() => Promise<string | null> | string | null) | null = null;
let orgResolver: (() => string | null) | null = null;

export function setTokenResolver(fn: () => Promise<string | null> | string | null) {
  tokenResolver = fn;
}
export function setOrgResolver(fn: () => string | null) {
  orgResolver = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = tokenResolver ? await tokenResolver() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  const org = orgResolver ? orgResolver() : null;
  if (org) headers['x-organization-id'] = org;

  const res = await fetch(`${config.apiUrl}${path}`, { ...options, headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? json?.message ?? res.statusText, res.status);
  }
  // Unwrap { success, data } envelopes; return raw body otherwise.
  if (json && typeof json === 'object' && 'data' in json) return json.data as T;
  return json as T;
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)])).toString() : '';
    return request<T>(`${path}${qs}`);
  },
  post: <T = any>(path: string, body?: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),

  /**
   * Multipart upload to POST /uploads/:category. RN FormData accepts
   * { uri, name, type } file objects; resolves to { url, absoluteUrl, ... }.
   */
  uploadFile: <T = any>(
    category: string,
    files: { uri: string; name: string; type: string }[],
  ) => {
    const form = new FormData();
    for (const f of files) form.append('file' as any, f as any);
    return request<T>(`/uploads/${category}`, {
      method: 'POST',
      body: form as any,
      headers: { 'Content-Type': 'multipart/form-data' } as any,
    });
  },
};

/** Build an absolute asset URL from a server-relative file path. */
export function assetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const origin = config.apiUrl.replace(/\/api\/?$/, '');
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}
