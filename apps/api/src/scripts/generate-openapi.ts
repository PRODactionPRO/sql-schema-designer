import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../openapi/swagger';

async function generateOpenApiSchema() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const document = createOpenApiDocument(app);
  const schemaPath = join(
    process.cwd(),
    '..',
    '..',
    'packages',
    'api-client',
    'schema.json',
  );

  await mkdir(dirname(schemaPath), { recursive: true });
  await writeFile(schemaPath, JSON.stringify(document, null, 2), 'utf8');

  await app.close();
}

void generateOpenApiSchema().catch((error: unknown) => {
  console.error('Failed to generate OpenAPI schema', error);
  process.exit(1);
});
