# Визуальный редактор модели данных

This is a code bundle for Визуальный редактор модели данных. The original project is available at https://www.figma.com/design/0ROnVGCJKhrqC9hWA5TsxG/%D0%92%D0%B8%D0%B7%D1%83%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9-%D1%80%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%BE%D1%80-%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D0%B8-%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85.

## Running the code

- `npm i` — install dependencies
- `npm run dev` — starts full local stack (Postgres + migrations + API + frontend)
- `npm run dev:web` — starts frontend only (if API is already running)

## Backend API (NestJS + Prisma + Postgres)

- `docker compose up -d postgres` — start local Postgres (`localhost:5434`)
- `npm run api:migrate` — apply Prisma migrations
- `npm run api:dev` — start API (`http://localhost:3000/api`)
- `npm run contracts:generate` — generate OpenAPI schema and typed client package

Auth endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`

## Quality gates

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run check` (all checks)

CI runs these checks automatically on `develop` and PRs to `develop/main`.

## Architecture guardrails

- `shared` must not import `pages`/`app`
- `pages` must not import `app`
- direct `localStorage` access is allowed only in `src/shared/lib/project-storage.ts`
- project/schema JSON is normalized via runtime guards before use

Details: `guidelines/ArchitectureGuardrails.md`.
