# Frontend — CLAUDE.md

Next.js 14 App Router. Deployed on Vercel serverless (free tier). No test runner configured.

## Route structure

```
src/app/
  admin/          # admin role — layout.tsx gates with RoleGuard
  manager/        # manager role — layout.tsx gates with RoleGuard
  403/            # shown on permission denial
```

`src/middleware.ts` runs at the edge: redirects `/admin` and `/manager` to `${NEXT_PUBLIC_API_URL}/auth/login` if `ACCESS_TOKEN` cookie is absent. This is a presence check only — full permission checks happen inside layouts via `auth/RoleGuard.tsx` and `auth/withAuth.tsx`.

## API calls — always use the helpers

`src/services/api.service.ts` exports two helpers:

- `apiRequest<T>(endpoint, options)` — for standard JSON calls
- `apiRequestWithHeaders<T>(endpoint, options)` — when you need response headers (pagination metadata)

Both auto-retry once on 401 by calling `/auth/refresh`, then log the user out if refresh fails. **Never bypass these with raw `fetch` for authenticated calls** or you lose the refresh/logout behaviour.

Pagination metadata arrives in response headers: `x-total-count`, `x-total-pages`, `x-page`, `x-limit`, `x-total-estimated-amount`, `x-total-quantity`. Use `apiRequestWithHeaders` to read them.

## Auth

`src/auth/AuthProvider.tsx` + `useAuth` hook provide the current user and permissions client-side. The `Permission` enum (`src/auth/permissions.ts`) must stay in sync with backend `@Permissions(...)` strings. When adding a new permission, add it to both files simultaneously.

`authClient.ts` calls `GET /auth/me` on load to hydrate the user context. `token.ts` handles cookie reads.

## Services

One file per domain in `src/services/`. Each wraps `apiRequest`/`apiRequestWithHeaders` calls to a specific backend resource. When adding a new endpoint, add the corresponding method here rather than calling `apiRequest` inline in a component.

## Domain models

`src/domain/model/*.model.ts` — view models shaped for the UI, mapped from `@app/contracts` DTOs by `src/domain/mapper/`. Components should consume domain models, not raw DTO types, where a mapper exists.

## Process config components

`src/components/orders/*Config.tsx` — one component per process type (DTF, Sublimation, Diamond, Laser, Plotter, Screen Printing, Spangle, All-over Sublimation, Embellishment). Each renders that process's configure form fields. New process types get their own `*Config.tsx`; do not add to a generic catch-all.

## Environment variables

```
NEXT_PUBLIC_API_URL     # backend base URL (e.g. https://api.skyprints.in/api/v1)
```

If `NEXT_PUBLIC_API_URL` is not set, `api.service.ts` throws at module load time. Set it in `.env.local` for local dev.

## Vercel constraints (free tier)

- Serverless functions time out at 10 seconds. Pages that do heavy server-side data fetching will fail under load.
- No persistent memory between invocations — do not cache anything in module-level variables on the frontend server side.
- Cold starts are frequent on the free tier; keep `getServerSideProps` / route handlers lean.

## Known issues to fix (not now, but track)

See [rules/known-issues.md](../../rules/known-issues.md). Key frontend items:
- No test runner — add Vitest or Jest with React Testing Library before any refactor
- `NEXT_PUBLIC_API_URL` undefined throws at module level in `api.service.ts` — should be a graceful startup error
- Some pages fetch data client-side on every render without memoisation or SWR, causing waterfall requests
- Permission checks in some components are duplicated between `RoleGuard` and inline `useAuth` checks
