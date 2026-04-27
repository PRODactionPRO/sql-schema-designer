import type { AuthUser } from '@/shared/auth/store';
import { apiRequest } from './http';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export function register(payload: { email: string; password: string; name?: string }) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { skipAuth: true });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { skipAuth: true });
}
