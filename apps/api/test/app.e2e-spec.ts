/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import 'reflect-metadata';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

describe('API critical flow (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('schema_designer_e2e')
      .withUsername('test')
      .withPassword('test')
      .start();

    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const prismaBinary = join(process.cwd(), 'node_modules', '.bin', 'prisma');
    execFileSync(prismaBinary, ['migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('supports auth + projects + revisions + views + migrations lifecycle', async () => {
    const healthResponse = await request(app.getHttpServer()).get(
      '/api/health',
    );
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.status).toBe('ok');

    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'password123',
        name: 'E2E User',
      });

    expect(registerResponse.status).toBe(201);
    const registerPayload = registerResponse.body as AuthResponse;
    expect(registerPayload.accessToken).toEqual(expect.any(String));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'password123',
      });

    expect(loginResponse.status).toBe(201);
    const token = (loginResponse.body as AuthResponse).accessToken;

    const createProjectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Project',
        description: 'Project for end-to-end test',
        schemaJson: {
          tables: [],
          relations: [],
          domains: [],
          enums: [],
        },
      });

    expect(createProjectResponse.status).toBe(201);
    const projectId = (createProjectResponse.body as { id: string }).id;

    const createRevisionResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/revisions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        schemaJson: {
          tables: [{ id: 'tbl1', name: 'user' }],
          relations: [],
          domains: [],
          enums: [],
        },
        comment: 'initial revision',
      });

    expect(createRevisionResponse.status).toBe(201);

    const createViewResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/views`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'active-users',
        description: 'Active users in last 30 days',
        sqlQuery: 'select count(*) as total from "User";',
        dialect: 'postgresql',
        tool: 'grafana',
      });

    expect(createViewResponse.status).toBe(201);

    const createMigrationResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/migrations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'add-user-status',
        upSql: 'alter table "User" add column "status" text;',
        downSql: 'alter table "User" drop column "status";',
        status: 'draft',
      });

    expect(createMigrationResponse.status).toBe(201);

    const listViewsResponse = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/views`)
      .set('Authorization', `Bearer ${token}`);

    expect(listViewsResponse.status).toBe(200);
    expect(listViewsResponse.body).toHaveLength(1);

    const listMigrationsResponse = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/migrations`)
      .set('Authorization', `Bearer ${token}`);

    expect(listMigrationsResponse.status).toBe(200);
    expect(listMigrationsResponse.body).toHaveLength(1);
  }, 120000);
});
