import { registerAs } from '@nestjs/config';

const DEFAULT_CORS_ORIGINS = 'http://localhost:5176,http://localhost:5173';

const parseCorsOrigins = (value: string | undefined) =>
  (value ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const corsConfig = registerAs('cors', () => ({
  origins: parseCorsOrigins(process.env.CORS_ORIGINS),
}));
