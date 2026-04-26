import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const globalPrefix =
    configService.get<string>('app.globalPrefix') ??
    configService.get<string>('API_PREFIX', 'api');
  const port = Number(
    configService.get<string>('app.port') ??
      configService.get<string>('PORT', '3000'),
  );
  const enableSwagger =
    configService.get<boolean>('app.enableSwagger') ??
    configService.get<string>('ENABLE_SWAGGER', 'true') === 'true';
  const swaggerPath =
    configService.get<string>('app.swaggerPath') ??
    configService.get<string>('SWAGGER_PATH', 'docs');
  const origins =
    configService.get<string[]>('cors.origins') ??
    configService
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (enableSwagger) {
    const openApiDocument = createOpenApiDocument(app);
    SwaggerModule.setup(`${globalPrefix}/${swaggerPath}`, app, openApiDocument);
  }

  await app.listen(port);
}

void bootstrap();
