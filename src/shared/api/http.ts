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
  const token = useAuthStore.getState().token;

  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

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
