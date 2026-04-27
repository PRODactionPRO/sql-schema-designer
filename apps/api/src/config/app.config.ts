import { registerAs } from '@nestjs/config';

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? '3000'),
  globalPrefix: process.env.API_PREFIX ?? 'api',
  enableSwagger: parseBoolean(process.env.ENABLE_SWAGGER, true),
  swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
}));
