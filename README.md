# Almaty Dining Club

Monorepo architecture with strict separation:
- `apps/frontend` - Next.js UI
- `apps/backend` - Express + TypeScript MVC API
- `packages/shared` - shared types and schemas

Supabase dependencies were removed from the codebase. Data/auth/storage are now self-hosted:
- PostgreSQL for data
- Express auth/session flow
- MinIO (S3-compatible) for file storage

## Local setup

1) Install dependencies:
```bash
npm install
```

2) Configure env files:
```bash
cp .env.example apps/frontend/.env.local
cp .env.example apps/backend/.env
```

3) Start full local stack (frontend + backend + nginx + infra):
```bash
docker compose up -d
```

4) Apply DB schema:
```bash
docker exec -i adc-postgres psql -U adc -d adc < "apps/backend/sql/init.sql"
```

4.1) If you run app containers via compose, open:
- App via nginx: [http://localhost](http://localhost)
- Backend health via nginx: [http://localhost/health](http://localhost/health)

5) Optional development mode (without app containers):
```bash
npm run dev
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:4000](http://localhost:4000)

## Backend MVC layout

- `src/modules/<domain>/controllers`
- `src/modules/<domain>/services`
- `src/modules/<domain>/repositories`
- `src/common` (config, middleware, errors)
- `src/infrastructure` (db, storage integrations)

## Notes

- During migration, frontend Supabase calls are routed through a compatibility layer that targets backend endpoints.
- Backend is implemented on Express + TypeScript as requested.
