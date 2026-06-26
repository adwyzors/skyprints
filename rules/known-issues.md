

# Known Issues & Patterns to Avoid

This is a living list of problems found during analysis. Fix these incrementally. **Do not fix while doing unrelated work** — keep changes scoped.

## Backend

### B1 — `getAll` and `getOrderCards` are ~200 lines duplicated (orders.service.ts)

Both methods build the identical `where` clause from `OrdersQueryDto`, run the same 4-query transaction, and compute `totalEstimatedAmount` identically. They differ only in what `findMany` selects. Extract the `where` builder and the `totalEstimatedAmount` aggregation into helpers.

### B2 — `totalEstimatedAmount` computed by fetching all matching run fields (orders.service.ts ~282, ~470)

Both list endpoints run `prisma.processRun.findMany({ where: { orderProcess: { order: where } }, select: { fields: true } })` and extract `fields['Estimated Amount']` in JS. This is unbounded and redundant — `estimatedAmount` is already stored on `Order`. **Fix:** use `order.aggregate._sum.estimatedAmount` instead.

### B3 — ProcessRun creation loop instead of `createMany` (4 places)

`create` and `reorder` in `orders.service.ts`, `addProcessToOrder`, and `addRunToProcess` all loop `tx.processRun.create(...)` one-by-one. The reason is that `createMany` doesn't return created records (needed for `processRunLifecycleHistory`). **Fix:** use `createMany` for the runs, then batch-insert lifecycle history using the deterministic `orderProcessId + runNumber` to find the created run IDs in a single `findMany`.

### B4 — `SYSTEM_USER_ID` hardcoded (orders.service.ts line 20)

`const SYSTEM_USER_ID = 'a98afcd6-e0d9-4948-afb8-11fb4d18185a'` — this constant is never used in the file (search shows no usage). Remove it.

### B5 — `getInitialRunStatus` hits DB on every call (runs.service.ts)

Queries `workflowStatus` table on each invocation. This doesn't change at runtime. Cache the result after first fetch, or pass it in as a parameter.

### B6 — `locationId` filter in orders doesn't check pre/post production locations

`getAll` filters by `locationId` on runs but the schema now has `preProductionLocationId` and `postProductionLocationId`. The filter misses runs that only have the split location fields set.

### B7 — `@me` returns `roles` containing permissions (auth.service.ts)

`getMe` returns `{ roles: authUser.permissions ?? [] }` — misnamed field. Frontend reads it as permissions but the key says `roles`. Rename to `permissions` in both the backend response and the frontend consumer (`authClient.ts` / `AuthProvider.tsx`). **Needs coordinated frontend + backend change.**

### B8 — No input validation on `updatePreferences`

`POST /auth/preferences` routes `req.body` directly into a Prisma update with no schema. Any client can write arbitrary keys to the `preferences` JSON column. Add a contract in `@app/contracts`.

### B9 — `deleteBulk` doesn't adjust `outstandingAmount` (orders.service.ts)

`delete` (single) correctly decrements `customer.outstandingAmount` for orders in PRODUCTION_READY/IN_PRODUCTION/COMPLETE. `deleteBulk` calls `updateMany` with no such adjustment. A bulk delete of billed orders will leave stale outstanding amounts on customers.

### B10 — `deleteRunFromProcess` uses string literal for lifecycle-complete check

```typescript
const wasLifecycleComplete = run.lifeCycleStatusCode === 'COMPLETE';
```

Lifecycle status codes come from the workflow engine — `'COMPLETE'` may not be the terminal code for all workflow types. Should check `isTerminal` on the `WorkflowStatus` instead.

## Frontend

### F1 — No test suite

No Vitest, Jest, or any test runner is configured. Before any significant refactor, add at minimum unit tests for service helpers and mappers.

### F2 — `NEXT_PUBLIC_API_URL` undefined throws at module load

`api.service.ts` line 7: `throw new Error('NEXT_PUBLIC_API_URL is not defined')`. This crash happens at import time, producing a confusing Next.js error rather than a clear startup message. Move the check to a lazy initialiser or a startup function.

### F3 — `Permission` enum in frontend must mirror backend manually

`apps/frontend/src/auth/permissions.ts` is a manual copy of the permission strings the backend uses in `@Permissions(...)`. There is no compile-time check that they match. Consider moving the enum into `@app/contracts` so both apps share a single source.

### F4 — Waterfall API requests on some pages

Several pages call multiple service methods sequentially in `useEffect` without `Promise.all`. This creates unnecessary waterfalls. Profile and parallelize where the calls are independent.

## Contracts

### C1 — `@shared/*` alias points to a non-existent package

`tsconfig.base.json` declares `@shared/*` → `apps/packages/shared/src/*`. That directory does not exist. Any import using `@shared/` will fail at compile time. Either create the package or remove the alias.
