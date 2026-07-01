# Spec: Manager Role — Scoped Run View and Stage Completion

> **SUPERSEDED (2026-07-01)** — the executorId + fixed-PRODUCTION-only visibility model
> described below is being replaced by a data-driven Process+Stage permission grid with
> exclusive claiming. See `.claude/specs/2026-07-01-manager-stage-queue.md`. This file is kept
> for history/context on the flow it replaces; do not implement further against it.

## Overview

When a user with `role = MANAGER` logs in, they should see only the `ProcessRun` rows where they are the assigned **executor** (not reviewer), and only for runs currently at the `PRODUCTION` lifecycle stage. Runs before `PRODUCTION` (e.g. `DESIGN`, `SIZE/COLOR`, `SAMPLE`, `RANGE`) are not visible yet. Runs that have passed `PRODUCTION` (e.g. `WAITING`, `CUTTING/WEEDING`, `FUSING`, `QC&COUNTING`, `COMPLETE`) are no longer visible. The manager's job is to mark their run's `PRODUCTION` stage complete, which advances it to the next stage and removes it from their view. A partial implementation already exists (manager layout, runs page, `assignedUserId` query param in the backend) — this spec closes the remaining gaps with the updated visibility rules.

---

## Current state audit (what already works)

| Area                                                        | Status  | Location                                        |
| ----------------------------------------------------------- | ------- | ----------------------------------------------- |
| `RoleGuard` routing MANAGER → `/manager/runs`          | ✅ Done | `apps/frontend/src/auth/RoleGuard.tsx:30`     |
| `/manager/runs` page fetching `assignedUserId`          | ✅ Done | `apps/frontend/src/app/manager/runs/page.tsx` |
| Backend `assignedUserId` filter in `getAllRuns`         | ✅ Done | `admin-process.service.ts:307`                |
| Lifecycle `transition` endpoint logic + terminal handling | ✅ Done | `admin-process.service.ts:1073`               |

| Area                                                               | Status     | Gap                                                              |
| ------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------- |
| Visibility scoped to**executor only** (not reviewer)         | ❌ Missing | Current filter uses OR executor/reviewer                         |
| Visibility restricted to `lifeCycleStatusCode = PRODUCTION` only | ❌ Missing | Currently excludes COMPLETE/BILLED but not pre-PRODUCTION stages |
| Backend enforces manager sees only own executor runs (server-side) | ❌ Missing | Client passes its own userId; server trusts it unconditionally   |
| `orderStatus` restricted to `IN_PRODUCTION` for managers       | ❌ Missing | Manager can see CONFIGURE / PRODUCTION_READY orders              |
| `@Permissions()` on `GET /process/runs`                        | ❌ Missing | Endpoint has no permission guard                                 |
| `@Permissions()` on `POST /process/transition`                 | ❌ Missing | Same — no guard                                                 |
| "Mark Complete" action on manager RunCard                          | ❌ Missing | RunCard is display-only                                          |
| RunCard navigate target for manager                                | ❌ Missing | Hardcoded to `/admin/orders/${id}` — broken for MANAGER       |
| Manager run detail page                                            | ❌ Missing | No `/manager/orders/[orderId]` route exists                    |
| Keycloak MANAGER role permissions configured                       | ❓ Unknown | Depends on Keycloak realm setup; verify separately               |

---

## Scope

**In scope:**

- Server-side scoping in `getAllRuns`: when caller is MANAGER, force `executorId = callerId` (not `assignedUserId` OR) and force `lifeCycleStatusCode = PRODUCTION` and `orderStatus = IN_PRODUCTION`
- Add `@Permissions('runs:view')` to `GET /process/runs` and `GET /process/runs/:id`
- Add `@Permissions('runs:lifecycle:update')` to `POST /process/:opId/runs/:runId/transition`
- "Mark Complete" button on the manager RunCard — advances the `PRODUCTION` stage to the next lifecycle stage (e.g. `WAITING`), which removes the run from the manager's view immediately
- Fix `RunCard` navigation: in manager context, navigate to `/manager/orders/[orderId]`
- Create `/manager/orders/[orderId]` — shows this manager's runs for that order at `PRODUCTION` stage, with transition controls

**Out of scope:**

- Reviewer-based visibility (reviewers do not get their own manager view)
- Any visibility of runs before `PRODUCTION` or after `PRODUCTION` from the manager view
- Billing, configure, or any write operations other than lifecycle stage transition
- Creating, deleting, or re-configuring runs
- Analytics for managers
- Keycloak realm permission configuration (manual; documented below)

---

## Depends on

- `ProcessRun.executorId` must be set (via admin configure flow) for the run to appear for the manager
- The run's `lifeCycleStatusCode` must be `PRODUCTION` — this is set by the admin/previous-stage operator advancing through `DESIGN → ... → PRODUCTION`
- `RequestContextStore.getStore()?.user` available in all service calls (already wired via `RequestContextMiddleware`)

---

## Contract changes (`@app/contracts`)

No new Zod schemas required. Existing `ProcessRunListItemDto` and `TransitionProcessRunDto` are sufficient.

`RUNS_LIFECYCLE_UPDATE = "runs:lifecycle:update"` and `RUNS_VIEW = "runs:view"` already exist in `apps/frontend/src/auth/permissions.ts` — confirm they match `@Permissions()` strings exactly.

**No contract changes needed.**

---

## Backend changes (`apps/backend`)

### 1. Role-aware scoping in `AdminProcessService.getAllRuns`

File: `apps/backend/src/processes/admin-process.service.ts`

Read the caller's role and ID from `RequestContextStore` at the top of `getAllRuns`. For MANAGER callers, override three query properties regardless of what the client sent:

```ts
const ctx = RequestContextStore.getStore();
const callerRole = ctx?.user?.role;
const callerId   = ctx?.user?.id;

if (callerRole === 'MANAGER') {
  // Force executor-only filter (replace any client-supplied assignedUserId)
  query.executorUserId = callerId;
  query.assignedUserId = undefined;   // clear so the OR branch is not triggered
  // Force lifecycle stage to PRODUCTION only
  query.lifeCycleStatusCode = 'PRODUCTION';
  // Force order must be actively in production
  query.orderStatus = 'IN_PRODUCTION';
}
```

The existing `executorUserId` filter in `getAllRuns` (line ~319) already handles `executorId: executorUserId` as a top-level `where` clause — no new Prisma query logic needed.

> **Why `executorUserId` not `assignedUserId`:** `assignedUserId` adds `OR [executorId, reviewerId]`. We want executor-only, so use `executorUserId` directly which maps to `executorId = value` without the OR.

### 2. Add `@Permissions()` guards to process controller

File: `apps/backend/src/processes/admin-process.controller.ts`

```ts
import { Permissions } from '../auth/decorators/permissions.decorator';

@Get('runs')
@Permissions('runs:view')
async getRuns(...) { ... }

@Get('runs/:id')
@Permissions('runs:view')
async getRun(...) { ... }

@Post(':orderProcessId/runs/:processRunId/transition')
@Permissions('runs:lifecycle:update')
async transition(...) { ... }
```

No new permission strings — both already exist in the frontend `Permission` enum.

### 3. No schema migration needed

`User.role` is already a free-form `String` column; `MANAGER` is already a valid value. No Prisma migration required.

---

## Frontend changes (`apps/frontend`)

### 1. Fix `RunCard` navigation for manager context

File: `apps/frontend/src/components/runs/RunCard.tsx` (~line 148)

Add an optional `context?: 'admin' | 'manager'` prop. When `context === 'manager'`, navigate to `/manager/orders/${run.orderProcess?.order?.id}` instead of `/admin/orders/...`.

In `apps/frontend/src/app/manager/runs/page.tsx`, pass `context="manager"` to each `<RunCard>`.

### 2. Add "Mark Complete" button on manager RunCard

In the manager context, replace the card's click-through navigation with an inline "Mark PRODUCTION Complete →" button at the bottom of the card body. On click:

1. Call `transitionLifeCycle(orderId, orderProcessId, runId, { statusCode: <nextStage> })` — the next stage after `PRODUCTION` is `WAITING` for most processes (see domain.md lifecycle charts)
2. On success, call `fetchRuns()` to refresh the list — the run will disappear because its `lifeCycleStatusCode` is no longer `PRODUCTION`

Since the next stage after `PRODUCTION` differs by process (most go to `WAITING`, Plotter goes directly to `CUTTING/WEEDING`), do not hardcode the next stage. Instead, fetch the run detail (`getRunById`) when the card loads, which returns `lifecycle` progress array with the next non-completed stage. Pass the next stage code to the button.

Alternatively (simpler and avoids N+1 fetches): have the backend include `nextLifecycleStage` in the `ProcessRunListItemDto`. Add a `nextLifecycleStage?: string` field computed from the `WorkflowTransition` table for the run's current status. This requires a small backend change to `getAllRuns` and a contract update.

**Chosen approach:** fetch `getRunById` lazily on card click/expand (not on list load) to avoid N+1. Show a "View & Advance" button on the card; on click, open a small slide-over/modal with lifecycle progress and the "Mark PRODUCTION Complete" button. This avoids adding a full page route while still showing context.

### 3. New page: `/manager/orders/[orderId]`

File: `apps/frontend/src/app/manager/orders/[orderId]/page.tsx` (create)

- Fetch `getRunById(runId)` for each run the manager has at `PRODUCTION` stage for this order
- Display: order code, customer name, process name, lifecycle progress bar, current stage = `PRODUCTION` highlighted
- "Mark Complete" button calls `transitionLifeCycle` and navigates back to `/manager/runs` on success
- Read-only — no edit/configure/delete controls
- Protected with `withAuth(page, { permission: Permission.RUNS_LIFECYCLE_UPDATE })`

### 4. Manager runs page — remove `assignedUserId` param

File: `apps/frontend/src/app/manager/runs/page.tsx`

Remove the `assignedUserId: user.id` param from the `getRuns()` call — the server now enforces this. The frontend call becomes simply `getRuns({})` for the manager, keeping the payload clean. The server will apply all MANAGER-role filters automatically.

---

## Files to create / modify

### `apps/backend`

| File                                          | Action                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `src/processes/admin-process.service.ts`    | Modify `getAllRuns` — add MANAGER role-aware scoping block (~line 198) |
| `src/processes/admin-process.controller.ts` | Add `@Permissions()` decorator to 3 endpoints                           |

### `apps/frontend`

| File                                          | Action                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/runs/RunCard.tsx`           | Add `context` prop; fix nav target; add "View & Advance" button in manager context      |
| `src/app/manager/runs/page.tsx`             | Remove `assignedUserId` param; pass `context="manager"`; wire post-transition refresh |
| `src/app/manager/orders/[orderId]/page.tsx` | **Create** — run detail + transition action for manager                            |

---

## New dependencies

No new npm packages.

---

## Vercel constraints to check

- `getAllRuns` does an in-memory sort over all matching runs. For a MANAGER the result set is bounded to runs at exactly `PRODUCTION` stage where they are executor — typically a small number (<20). No timeout risk.
- The new manager order detail page fetches one run at a time via `getRunById` — well within the 10 s limit.

---

## Implementation rules for this feature

- All status transitions must go through the existing `transition()` service method — do not write raw Prisma status updates anywhere in this feature
- New endpoints must use `@Permissions('resource:action')` — both `runs:view` and `runs:lifecycle:update` already exist in the frontend `Permission` enum
- Use `PrismaService.transaction()` for multi-step writes — the existing `transition()` already does this
- All frontend API calls must go through `apiRequest` / `apiRequestWithHeaders` — never raw `fetch`
- Do not change behaviour of existing endpoints for ADMIN callers — the scoping block must be inside `if (callerRole === 'MANAGER')` only
- `RequestContextStore.getStore()` can return `null` — always guard before accessing `.user`

### Keycloak note (manual step required)

The MANAGER Keycloak realm role must have `runs:view` and `runs:lifecycle:update` permissions assigned in the Keycloak admin UI. Without this, the JWT will not carry these permissions and the `PermissionsGuard` will return 403 even for valid manager users.

---

## Definition of done

- [ ] A MANAGER logging in sees only runs where `executorId = their own id` AND `lifeCycleStatusCode = PRODUCTION` AND `order.statusCode = IN_PRODUCTION`
- [ ] Runs at `DESIGN`, `SIZE/COLOR`, `SAMPLE`, `RANGE` stages are **not** visible to the manager
- [ ] Runs at `WAITING`, `CUTTING/WEEDING`, `FUSING`, `QC&COUNTING`, `COMPLETE` stages are **not** visible to the manager
- [ ] A MANAGER cannot see runs they are only the reviewer of (executor-only scoping)
- [ ] A MANAGER calling `GET /api/v1/process/runs?executorUserId=<otherId>` is silently scoped to their own ID — they cannot see another executor's runs
- [ ] The "Mark PRODUCTION Complete" action successfully transitions the run to the next stage (`WAITING` or process-equivalent)
- [ ] After marking complete, the run disappears from `/manager/runs` immediately (list refreshes)
- [ ] Clicking a run card navigates to `/manager/orders/[orderId]` not `/admin/orders/...`
- [ ] An ADMIN calling `GET /api/v1/process/runs` without filters still sees all runs as before — no regression
- [ ] `GET /api/v1/process/runs` returns `403` for a caller without `runs:view` permission
