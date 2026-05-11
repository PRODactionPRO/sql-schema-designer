import { registerAs } from '@nestjs/config';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5176',
].join(',');

const parseCorsOrigins = (value: string | undefined) =>
  (value ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const corsConfig = registerAs('cors', () => ({
  origins: parseCorsOrigins(process.env.CORS_ORIGINS),
}));
