# EcoChain Backend (Express + TypeScript)

This service implements the backend API described in `BACKEND_INTEGRATION.md` and uses Supabase Auth + RBAC + service-role admin actions.

## Setup

1. Copy environment file:

```bash
cp .env.example .env
```

2. Fill in:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_VISION_MODEL`

## Run (dev)

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3001` and mounts API under `/api` by default.

## Build + Run (prod)

```bash
npm install
npm run build
npm start
```

## Health check

`GET /healthz` → `{ ok: true }`

