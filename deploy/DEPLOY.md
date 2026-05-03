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
