import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { json, urlencoded } from 'express';
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
  const scalarPath = configService.get<string>('SCALAR_PATH', 'reference');
  const bodySizeLimit = configService.get<string>('BODY_SIZE_LIMIT') ?? '2mb';
  const origins =
    configService.get<string[]>('cors.origins') ??
    configService
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  app.setGlobalPrefix(globalPrefix);
  // Large schemaJson payloads can include inline snapshot data URLs.
  app.use(json({ limit: bodySizeLimit }));
  app.use(urlencoded({ extended: true, limit: bodySizeLimit }));
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
    app.use(
      `/${globalPrefix}/${scalarPath}`,
      apiReference({
        content: openApiDocument,
        layout: 'modern',
        pageTitle: 'Archon API Reference',
        showDeveloperTools: 'localhost',
        theme: 'default',
      }),
    );
  }

  await app.listen(port);
}

void bootstrap();
