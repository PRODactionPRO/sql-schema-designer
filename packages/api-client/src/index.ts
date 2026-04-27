import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

export type ApiPaths = paths;

export interface CreateApiClientOptions {
  baseUrl: string;
  accessToken?: string;
}

export function createApiClient(options: CreateApiClientOptions) {
  const headers: Record<string, string> = {};
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  return createClient<paths>({
    baseUrl: options.baseUrl,
    headers,
  });
}
