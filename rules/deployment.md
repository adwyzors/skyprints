# Deployment — Vercel Serverless (Free Tier)

Both `apps/backend` and `apps/frontend` deploy to Vercel on the free tier. Understand these constraints before making changes.

## Backend (serverless via `api/index.ts`)

### Cold starts & singleton pattern

`main.serverless.ts` caches the NestJS app in a module-level variable (`let cachedApp`). This means:
- First invocation per container bootstraps the full `AppModule` (~several hundred ms)
- Subsequent invocations in the same container reuse it
- **Never store per-request state in module-level variables** — containers are shared across concurrent requests

### Function timeout

Free tier: **10 seconds max**. Long-running operations (bulk billing recalculations, analytics aggregation) will time out. The `jobs` module (`order-rentention-sequence.job.ts`) uses `@nestjs/schedule` — cron jobs work in the long-running `main.ts` server mode but **will not fire** in serverless (each invocation is stateless). Vercel cron is configured in `vercel.json` instead and hits HTTP endpoints guarded by `CRON_SECRET`.

### LoggingInterceptor is excluded on serverless

`main.serverless.ts` does not register `LoggingInterceptor`. This is intentional — Vercel log aggregation is used instead. Do not add it to `main.serverless.ts`.

### Prisma connection pooling

Serverless creates a new Prisma client per cold start. On the free tier with many concurrent cold starts, you can hit PostgreSQL connection limits. Consider using PgBouncer or Prisma Accelerate if connection exhaustion becomes an issue.

### Routes

`vercel.json` rewrites `/*` → `api/index.ts`. All paths go through the single handler. The global prefix `api/v1` is set in `main.serverless.ts` (not by Vercel). Frontend calls `${NEXT_PUBLIC_API_URL}/...` where `NEXT_PUBLIC_API_URL` already includes `/api/v1`.

### Vercel cron

Defined in `apps/backend/vercel.json`:
```json
{ "path": "/internal/image-retention/cleanup", "schedule": "0 2 * * *" }
```
Guarded by `Authorization: Bearer ${CRON_SECRET}` or `IMAGE_RETENTION_SECRET` header check in `image-retention.controller.ts`. Keep this endpoint `@Public()`.

## Frontend (Next.js serverless)

### No persistent server memory

Each page render may run in a separate Vercel function. Do not cache API responses in module-level variables — use Next.js `unstable_cache` or React cache if needed.

### `NEXT_PUBLIC_API_URL` must be set at build time

Next.js bakes `NEXT_PUBLIC_*` env vars at build time. If it changes (e.g. backend URL update), the frontend must be redeployed.

### Edge middleware

`src/middleware.ts` runs on the Vercel Edge Runtime — it only checks for `ACCESS_TOKEN` cookie presence. It cannot call the backend or database. Keep it minimal and sync.

## Environment variables — Vercel dashboard

Set these in the Vercel project settings for each app. Do not commit `.env` files with secrets:

**Backend:**
`DATABASE_URL`, `KEYCLOAK_*`, `JWKS_URI`, `TOKEN_ISSUER`, `TOKEN_AUDIENCE`, `APP_BASE_URL`, `FRONT_END_BASE_URL`, `COOKIE_*`, `CRON_SECRET`, `IMAGE_RETENTION_SECRET`, `ORDER_RETENTION_*`, `JOBS_ENABLED`, `MAX_ORDERS_PER_RUN`

**Frontend:**
`NEXT_PUBLIC_API_URL`

## Deployment checklist for auth changes

1. Update Keycloak client `redirect_uri` whitelist if `APP_BASE_URL` changes
2. Update `FRONT_END_BASE_URL` on backend if frontend URL changes
3. Verify `COOKIE_DOMAIN` covers both apps if on subdomains
4. Test login → callback → cookie → /auth/me flow in production after deploy
