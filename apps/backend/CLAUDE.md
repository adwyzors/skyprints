# Backend — CLAUDE.md

NestJS 11 + Prisma + PostgreSQL. Feature modules under `src/`. Deployed as Vercel serverless via `api/index.ts`.

## Module map

| Module | Purpose |
|---|---|
| `auth` | Keycloak OAuth + cookie auth. See [rules/auth.md](../../rules/auth.md) |
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
1. `AuthGuard` — checks `@Public()`, else delegates to `JwtAuthGuard` (validates Keycloak JWT via JWKS)
2. `PermissionsGuard` — reads `@Permissions(...)` metadata, checks `req.user.permissions`

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
KEYCLOAK_TOKEN_URL, KEYCLOAK_AUTH_URL, KEYCLOAK_LOGOUT_URL
KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET
JWKS_URI
TOKEN_ISSUER, TOKEN_AUDIENCE
APP_BASE_URL           # backend public URL (used for OAuth callback redirect_uri)
FRONT_END_BASE_URL     # frontend URL (used for post-login redirect)
COOKIE_HTTP_ONLY, COOKIE_SECURE, COOKIE_SAMESITE, COOKIE_DOMAIN, COOKIE_PATH
PORT                   # defaults to 3001
CRON_SECRET, IMAGE_RETENTION_SECRET
ORDER_RETENTION_ENABLED, ORDER_RETENTION_CRON, ORDER_RETENTION_DAYS
JOBS_ENABLED
MAX_ORDERS_PER_RUN
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
