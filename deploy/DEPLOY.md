# Production Deploy (VPS)

## Stack
- Frontend: Vite static build in `web` container
- Backend: NestJS API in `api` container
- Database: Postgres 16 in `db` container
- Edge: host `nginx` reverse-proxy on `80/443`

## Resource policy (VPN priority)
Application limits are capped to keep at least half of server capacity for VPN:
- `api`: `0.20 CPU`, `320 MB`
- `db`: `0.20 CPU`, `256 MB`
- `web`: `0.10 CPU`, `96 MB`
- Total app cap: `0.50 CPU`, `672 MB`

## First deploy
1. Copy repo to server (example):
```bash
rsync -az --delete --exclude node_modules --exclude .git ./ root@SERVER:/opt/sql-schema-designer/
```

2. Create env file:
```bash
cd /opt/sql-schema-designer/deploy
cp .env.prod.example .env.prod
# fill secrets
```

3. Build and start:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api npm run prisma:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## Update deploy
```bash
cd /opt/sql-schema-designer/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api npm run prisma:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## Demo access
- Frontend button: `Live Demo Access`
- Backend endpoint: `POST /api/auth/demo`
- Enabled by env: `DEMO_AUTH_ENABLED=true`

## Health checks
- API: `GET /api/health`
- Containers: `docker compose -f docker-compose.prod.yml ps`
- Runtime usage: `docker stats --no-stream`

## GitHub Actions auto-deploy
`Deploy Production` workflow is configured to run automatically after successful `CI` on `main`.

Required repository secrets:
- `DEPLOY_HOST` (example: `212.118.55.241`)
- `DEPLOY_USER` (example: `root`)
- `DEPLOY_PATH` (example: `/opt/sql-schema-designer`)
- `DEPLOY_SSH_PRIVATE_KEY` (private key content for server access)
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS` (example: `http://212.118.55.241`)
- `DEMO_USER_EMAIL`
- `DEMO_USER_NAME`
- `DEMO_USER_PASSWORD`
