# SQL Schema Designer API (NestJS)

Backend foundation for production usage with:
- NestJS + Prisma + PostgreSQL
- JWT auth
- Domain modules: projects, revisions, views, migrations
- CLI commands for operations
- OpenAPI contract generation

## Data model

- `User`
- `Project` (stores full schema in `schemaJson` as JSONB)
- `ProjectRevision` (version history snapshots)
- `ProjectSqlView` (saved analytical SQL queries)
- `ProjectMigration` (saved migration drafts)

## Local run

1. Start Postgres in repo root:

```bash
docker compose up -d postgres
```

2. Install dependencies:

```bash
npm install
```

3. Apply Prisma migrations:

```bash
npm run prisma:migrate
```

4. Start API:

```bash
npm run start:dev
```

API base URL: `http://localhost:3000/api`
Swagger UI: `http://localhost:3000/api/docs`
Scalar API Reference: `http://localhost:3000/api/reference`

## Main endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Projects (JWT required)
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PUT /api/projects/:projectId`
- `DELETE /api/projects/:projectId`

### Revisions (JWT required)
- `GET /api/projects/:projectId/revisions`
- `POST /api/projects/:projectId/revisions`
- `POST /api/projects/:projectId/revisions/:revision/restore`

### Views (JWT required)
- `GET /api/projects/:projectId/views`
- `POST /api/projects/:projectId/views`
- `PUT /api/projects/:projectId/views/:viewId`
- `DELETE /api/projects/:projectId/views/:viewId`

### Migrations (JWT required)
- `GET /api/projects/:projectId/migrations`
- `POST /api/projects/:projectId/migrations`
- `PUT /api/projects/:projectId/migrations/:migrationId`
- `DELETE /api/projects/:projectId/migrations/:migrationId`

## CLI

```bash
# create admin/user
npm run cli -- create-user --email admin@example.com --password secret --role admin

# import project from json file
npm run cli -- import-project --owner-email admin@example.com --file ./schema.json --name "Imported schema"

# export current PostgreSQL structure into the app JSON format
npm run cli -- export-db-schema --out ../../backups/live-schema.json
```

## Contract generation

```bash
# from repository root:
npm run contracts:generate
```
