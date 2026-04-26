# SQL Schema Designer API (NestJS)

Minimal backend for production usage with:
- NestJS
- PostgreSQL
- Prisma
- JWT auth
- Projects + revisions storage

## Data model

- `User`
- `Project` (stores full schema in `schemaJson` as JSONB)
- `ProjectRevision` (version history snapshots)

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
