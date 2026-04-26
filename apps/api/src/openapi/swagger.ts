import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('SQL Schema Designer API')
    .setDescription(
      'Backend API for projects, revisions, SQL views and migrations',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}
