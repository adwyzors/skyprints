# Backend — CLAUDE.md

NestJS 11 + Prisma + PostgreSQL. Feature modules under `src/`. Runs as a persistent PM2
process (`ecosystem.config.js`) on a DigitalOcean droplet behind nginx, reachable at
`api.adwyzors.com`. (The Vercel serverless entrypoint, `api/index.ts` /
`main.serverless.ts`, is being kept temporarily as a rollback fallback during the cutover —
do not build new features against it.)

## Module map

| Module | Purpose |
|---|---|
| `auth` | Internal bcrypt+JWT cookie auth (Keycloak removed). See [rules/auth.md](../../rules/auth.md) |
| `orders` | Order CRUD, status machine, credit-limit enforcement |
| `runs` | ProcessRun configure/lifecycle updates |
| `run-templates` | Templates that define run fields + billing formula |
| `processes` | Process catalogue (DTF, sublimation, etc.) |
| `billing` | Formula engine, BillingContext, BillingSnapshot |
| `workflow` | Generic data-driven status machine |
| `analytics` / `jobs` | Read projections — never write from request handlers |
| `common` | Logger, AsyncLocalStorage context, Cloudflare service |

## Two entrypoints — keep them in sync

`src/main.ts` (local/server) and `src/main.serverless.ts` + `api/index.ts` (Vercel) bootstrap the same `AppModule`. Both must have: global prefix `api/v1`, cookie-parser, CORS with same exposed headers, `ValidationPipe`, `PaginationInterceptor`. `main.serverless.ts` intentionally omits `LoggingInterceptor`. When changing app-level wiring, update both.

## Auth guards (order matters)

Two global `APP_GUARD`s registered in `app.module.ts`:
1. `AuthGuard` — checks `@Public()`, else delegates to `InternalJwtAuthGuard` (validates the
   internal HS256 JWT, secret = `JWT_SECRET`)
2. `PermissionsGuard` — reads `@Permissions(...)` / `@AnyPermissions(...)` metadata, checks
   `req.user.permissions`

**When adding a protected endpoint:** use `@Permissions('resource:action')`. The permission string must also exist in the frontend `Permission` enum (`apps/frontend/src/auth/permissions.ts`). Do not check roles manually.

## Prisma

Schema: `prisma/schema.prisma`. Prisma module: `prisma/prisma.module.ts`. Use `PrismaService` for single queries and `this.prisma.transaction(...)` for multi-step writes.

Key domain shape: `Order → OrderProcess → ProcessRun`. Counters on `Order` (`totalProcesses`/`completedProcesses`) and `OrderProcess` (`totalRuns`/`configCompletedRuns`/`lifecycleCompletedRuns`/`remainingRuns`) are **denormalized** — update them in the same transaction as the runs they track.

`ProcessRun` has two independent status fields:
- `statusCode` — config workflow side (`CONFIGURE` / `IN_PROGRESS` / `COMPLETE`)
- `lifeCycleStatusCode` — production lifecycle (workflow-defined string codes)

Never conflate them. All status transitions must go through `DynamicWorkflowEngine.validateTransition()`.

## Billing

Formulas stored on `RunTemplate.billingFormula`, evaluated at runtime. Use `billing/utils/money.ts` for decimal arithmetic and `formula-checksum.ts` for integrity checks — do not re-implement either inline. `BillingSnapshot`s are append-only; `isLatest` flags the current version. Never mutate a snapshot in place.

## Response shape

Controllers must return mapped DTOs via `src/mappers/*.mapper.ts`, not raw Prisma models. Read DTOs live in `@app/contracts` (`*.read.contract.ts`).

Pagination metadata goes into response headers (`x-total-count`, `x-total-pages`, `x-page`, `x-limit`, `x-total-estimated-amount`, `x-total-quantity`), set by `PaginationInterceptor`. Keep those header names stable.

## Request context

`RequestContextMiddleware` seeds `AsyncLocalStorage` on every request (`common/context/request-context.store.ts`). `RequestContextStore.getStore()?.user` is how services access the logged-in user without injecting `Request`. All services assume this is set — verify it's non-null before use.

## Environment variables required

```
DATABASE_URL
JWT_SECRET              # min 32 chars, validated at startup — app refuses to boot without it
JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES
FRONT_END_BASE_URL      # frontend URL — used for CORS origin
COOKIE_HTTP_ONLY, COOKIE_SECURE, COOKIE_SAMESITE, COOKIE_DOMAIN, COOKIE_PATH
PORT                    # defaults to 3001
NODE_ENV                # 'prod' gates cron execution + CRON_SECRET auth checks
IMAGE_RETENTION_DAYS    # cleanup now runs via @Cron in image-retention.service.ts (daily
                         # 02:00), only when NODE_ENV=prod
CRON_SECRET, IMAGE_RETENTION_SECRET   # still used to auth manual POST /internal/image-retention/cleanup calls
ORDER_RETENTION_ENABLED, ORDER_RETENTION_CRON, ORDER_RETENTION_DAYS   # order-retention job (currently disabled/commented out)
JOBS_ENABLED
MAX_ORDERS_PER_RUN
CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_BUCKET_NAME, CLOUDFLARE_PUBLIC_URL, CLOUDFLARE_ENDPOINT
```

## Testing

Jest is wired up (pattern `.*\.spec\.ts$`, rootDir `src`) but there are **zero spec files**. Do not assume coverage exists. When adding tests, use `@nestjs/testing` and real Prisma against a test DB, not mocks.

## Known issues to fix (not now, but track)

See [rules/known-issues.md](../../rules/known-issues.md) for the full list. Key items:
- `getAll` and `getOrderCards` in `orders.service.ts` duplicate ~200 lines of `where`-clause logic
- ProcessRun creation uses a per-run `create` loop instead of `createMany` (appears in 4 places)
- The `allRuns` sub-query for `totalEstimatedAmount` fetches all run fields for every page load — use the stored `estimatedAmount` on `Order` instead
- `resolveCookieDomain` in `cookie-domain.util.ts` is defined but never called (dead code)
- `SYSTEM_USER_ID` hardcoded in `orders.service.ts` line 20
