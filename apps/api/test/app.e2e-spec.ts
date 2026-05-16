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

interface SemanticViewResponse {
  id: string;
  type: string;
  name: string;
}

interface CreateObjectInViewResponse {
  object: {
    id: string;
    name: string;
    type: string;
    metadata: unknown;
    deletedAt?: string | null;
  };
  node: {
    id: string;
    viewId: string;
    objectId: string;
    x: number;
    y: number;
    visible: boolean;
  };
}

interface CreateRelationInViewResponse {
  relation: {
    id: string;
    sourceObjectId: string;
    targetObjectId: string;
    type: string;
    metadata?: unknown;
  };
  edge: {
    id: string;
    relationId: string;
    sourceViewNodeId: string;
    targetViewNodeId: string;
    visible: boolean;
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

    const createSemanticViewResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/semantic/commands/create-view`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'erd',
        name: 'Primary ERD',
        settings: { grid: true },
      });

    expect(createSemanticViewResponse.status).toBe(201);
    const semanticView =
      createSemanticViewResponse.body as SemanticViewResponse;
    expect(semanticView.type).toBe('erd');

    const createUsersObjectResponse = await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/semantic/commands/create-object-in-view`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        viewId: semanticView.id,
        type: 'table',
        name: 'users',
        metadata: {
          id: 'table-users',
          fields: [{ id: 'users-id', name: 'id', type: 'uuid' }],
        },
        position: { x: 100, y: 120 },
      });

    expect(createUsersObjectResponse.status).toBe(201);
    const usersSemantic =
      createUsersObjectResponse.body as CreateObjectInViewResponse;
    expect(usersSemantic.object.type).toBe('table');
    expect(usersSemantic.node.x).toBe(100);

    const createPostsObjectResponse = await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/semantic/commands/create-object-in-view`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        viewId: semanticView.id,
        type: 'table',
        name: 'posts',
        metadata: {
          id: 'table-posts',
          fields: [{ id: 'posts-id', name: 'id', type: 'uuid' }],
        },
        position: { x: 420, y: 120 },
      });

    expect(createPostsObjectResponse.status).toBe(201);
    const postsSemantic =
      createPostsObjectResponse.body as CreateObjectInViewResponse;

    const createSemanticRelationResponse = await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/semantic/commands/create-relation-in-view`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        viewId: semanticView.id,
        sourceViewNodeId: postsSemantic.node.id,
        targetViewNodeId: usersSemantic.node.id,
        type: 'references',
        metadata: {
          id: 'relation-posts-users',
          fromTableId: 'table-posts',
          fromFieldId: 'posts-user-id',
          toTableId: 'table-users',
          toFieldId: 'users-id',
          type: '1:N',
        },
      });

    expect(createSemanticRelationResponse.status).toBe(201);
    const semanticRelation =
      createSemanticRelationResponse.body as CreateRelationInViewResponse;
    expect(semanticRelation.relation.sourceObjectId).toBe(
      postsSemantic.object.id,
    );
    expect(semanticRelation.edge.sourceViewNodeId).toBe(postsSemantic.node.id);

    const updateSemanticRelationResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/semantic/commands/update-relation`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        relationId: semanticRelation.relation.id,
        type: 'references',
        metadata: {
          id: 'relation-posts-users',
          fromTableId: 'table-posts',
          fromFieldId: 'posts-user-id',
          toTableId: 'table-users',
          toFieldId: 'users-id',
          type: '1:1',
        },
      });

    expect(updateSemanticRelationResponse.status).toBe(201);
    expect(updateSemanticRelationResponse.body.metadata.type).toBe('1:1');

    const moveNodeResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/semantic/commands/move-view-node`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        viewId: semanticView.id,
        nodeId: usersSemantic.node.id,
        x: 160,
        y: 180,
      });

    expect(moveNodeResponse.status).toBe(201);
    expect((moveNodeResponse.body as { x: number; y: number }).x).toBe(160);

    const updateObjectResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/semantic/commands/update-object`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        objectId: usersSemantic.object.id,
        name: 'app_users',
        metadata: {
          id: 'table-users',
          name: 'app_users',
          fields: [{ id: 'users-id', name: 'id', type: 'uuid' }],
        },
      });

    expect(updateObjectResponse.status).toBe(201);
    expect((updateObjectResponse.body as { name: string }).name).toBe(
      'app_users',
    );

    const primaryErdResponse = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/semantic/views/primary-erd`)
      .set('Authorization', `Bearer ${token}`);

    expect(primaryErdResponse.status).toBe(200);
    expect(primaryErdResponse.body.view.nodes).toHaveLength(2);
    expect(primaryErdResponse.body.view.edges).toHaveLength(1);

    const deleteRelationResponse = await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/semantic/commands/delete-relation-from-view`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        relationId: semanticRelation.relation.id,
        viewId: semanticView.id,
      });

    expect(deleteRelationResponse.status).toBe(201);
    expect(deleteRelationResponse.body.hiddenEdgeIds).toContain(
      semanticRelation.edge.id,
    );

    const primaryErdAfterRelationDeleteResponse = await request(
      app.getHttpServer(),
    )
      .get(`/api/projects/${projectId}/semantic/views/primary-erd`)
      .set('Authorization', `Bearer ${token}`);

    expect(primaryErdAfterRelationDeleteResponse.status).toBe(200);
    expect(primaryErdAfterRelationDeleteResponse.body.view.nodes).toHaveLength(
      2,
    );
    expect(primaryErdAfterRelationDeleteResponse.body.view.edges).toHaveLength(
      0,
    );

    const deleteObjectResponse = await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/semantic/commands/delete-object-from-view`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        objectId: postsSemantic.object.id,
        viewId: semanticView.id,
      });

    expect(deleteObjectResponse.status).toBe(201);
    expect(deleteObjectResponse.body.hiddenNodeIds).toContain(
      postsSemantic.node.id,
    );

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
