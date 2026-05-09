import { useAuthStore } from '@/shared/auth/store';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { skipAuth?: boolean } = {},
): Promise<T> {
  const startedAt = performance.now();
  const token = useAuthStore.getState().token;

  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path}`;
  const bodySize = typeof init.body === 'string' ? init.body.length : 0;
  const shouldLog = path.includes('/projects') || path.includes('/revisions');
  if (shouldLog) {
    console.info('[apiRequest:start]', {
      method: init.method || 'GET',
      path,
      bodySize,
      startedAt: new Date().toISOString(),
    });
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (shouldLog) {
    console.info('[apiRequest:done]', {
      method: init.method || 'GET',
      path,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  const body = await parseResponse(response);

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: unknown }).message)
      : `Request failed with status ${response.status}`;

    if (response.status === 401 && !options.skipAuth) {
      useAuthStore.getState().clearSession();
    }

    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export const apiBaseUrl = API_BASE_URL;
