# Spec: Manager Stage-Based Production Queue

**Supersedes:** `manager-run-view-stage-complete.md` (fixed executorId + PRODUCTION-only
visibility) — that model is retired entirely, not extended.

## Overview

Replaces the existing MANAGER dashboard (`/manager/runs`, `ManagerRunModal.tsx`), which today
hardcodes visibility to "runs where I am `executorId` and the stage is exactly `PRODUCTION`",
with a fully data-driven Process + Lifecycle Stage permission grid that an ADMIN assigns per
manager. A run becomes visible to every manager permitted for its current (process, stage)
pair; whoever clicks **Start Work** first claims it exclusively (atomic, race-safe); the
claiming manager alone can **Complete Stage** (advances the workflow exactly as
`AdminProcessService.transition()` already does) or **Release Job** (returns it to the shared
queue, no history lost). This works at every lifecycle stage, not just PRODUCTION. Completed
stages are recorded in an immutable history table used to show "who worked this stage, when it
started/ended" on the admin run-detail view and the billing screen, and to support future
analytics without another migration.

This is a same-role change — `MANAGER` already exists, already authenticates via Keycloak, and
already holds `runs:view` / `runs:lifecycle:update`. No new role, no auth changes, no new
top-level permission strings (one narrow addition for admin override — see below).

## Scope

**In scope:**

- `ManagerStagePermission` table — data-driven Process + Lifecycle Stage grid per manager,
  admin-assigned, applies to **any** lifecycle stage of **any** process (not fixed to
  PRODUCTION)
- `ProcessRun.claimedBy` / `claimedAt` — atomic single-claim mechanism, reused across every
  stage a manager is permitted for
- `ProcessRunStageHistory` — immutable per-completed-stage record (manager, claim/complete
  timestamps, duration), schema designed for the future analytics listed in the original brief
- New `manager-queue` backend module: queue list, active-jobs list, claim, release, complete,
  admin force-release
- Retiring the `MANAGER`-role special-casing inside `AdminProcessService.getAllRuns()` (added
  by the superseded spec) — Manager's dashboard stops calling `GET /process/runs` entirely
- Rebuilding `ManagerRunModal.tsx` and `/manager/runs/page.tsx` around claim/release/complete
  instead of a raw, unconditional "Mark Complete" transition button hardcoded to `PRODUCTION`
- New Assign Stage Permissions panel on `/admin/users` for MANAGER-role users
- Backfilling `claimedBy`/`claimedAt` from existing `executorId` for in-flight runs, done
  incrementally as the admin rolls out stage-permission coverage process by process (not a
  one-off script — see "Cutover & backfill" below)
- Surfacing manager attribution (who worked a stage, start/end, duration) in
  `ViewRunModal.tsx`'s existing Activity History panel, and a new sidebar in `BillingModal.tsx`
  (`/admin/billing`) showing the same per-run lifecycle + attribution when a run row is
  expanded

**Out of scope:**

- Any analytics dashboards/UI (Worker/Manager Productivity, Stage Analytics, Factory
  Analytics) — only the schema/indexes to support them later
- A separate `WORKER` role — explicitly dropped; this feature is for the existing `MANAGER`
  role only
- Auth changes of any kind — Manager keeps using Keycloak exactly as today
- Reassigning any of MANAGER's existing broader permissions (`orders:*`, `billings:*`,
  `customers:*`, etc.) — unchanged
- Reviewer-based visibility — unchanged, out of scope as in the superseded spec

## Depends on

- `AdminProcessService.transition()` (existing) — reused as-is for stage advancement, plus one
  additive optional parameter (see below)
- `GET /process/:processId/lifecycle-statuses` (existing) — reused as-is to populate the Assign
  Stage Permissions checklist
- `ProcessRunLifecycleHistory` (existing) — the source of truth for "when did this run enter
  its current stage," used both by the attribution mapper and the backfill

## Grilling notes — decisions made, and one still-open assumption to confirm

Resolved via interview:
1. This is the literal `MANAGER` role, replacing its old flow — not a new role.
2. A **Release** action exists (same manager who claimed it can give it back; no history row
   recorded for a release, only for completions).
3. The "rate configuration" screen in the brief is `/admin/billing` → `BillingModal.tsx`; a
   sidebar there shows lifecycle + attribution when a run row is expanded. `ViewRunModal.tsx`'s
   existing Activity History panel gets the same treatment.
4. This applies to **every** lifecycle stage of **every** process the admin chooses to assign,
   not just PRODUCTION — fully data-driven, replacing the fixed restriction.
5. In-flight runs get backfilled: `claimedBy = executorId` treated as an existing claim, not
   left to finish under old rules.
6. Completing a claim also sets `executorId = managerId`, so `UserPerformance` analytics and
   the existing "Executor" field in `ViewRunModal`/`ManagerRunModal` keep working unchanged.
7. ADMIN gets a force-release action for stuck claims (e.g. manager on leave).
8. **Confirmed:** if the same manager who completes stage N also holds permission for stage
   N+1 of the same process, the run goes back to the **open shared queue** for stage N+1 — the
   manager must explicitly re-claim it via `POST /manager-queue/:runId/claim`, exactly like any
   other eligible manager would. `complete()` never auto-transfers or pre-assigns the next
   claim; every stage boundary is a fresh "whoever claims it first" decision, with no special
   case for the manager who just finished the previous stage.

## Contract changes (`@app/contracts`)

Create under `apps/packages/contracts/src/manager-queue/`:

| File | Exports | Used by |
|---|---|---|
| `stage-permission.contract.ts` | `StagePermissionEntrySchema` `{processId: uuid, lifecycleStageId: uuid}`, `AssignStagePermissionsSchema = z.array(...)`, `ManagerStagePermissionSchema`/`Dto` (read shape: `processId, processName, lifecycleStageId, stageCode`) | `PUT/GET /users/:id/stage-permissions` |
| `queue-item.read.contract.ts` | `ManagerQueueItemSchema`/`Dto`: `id, runNumber, orderId, orderCode, customerName, quantity: number \| null, processName, lifeCycleStatusCode, comments: string \| null, artworkUrl: string \| null, createdAt` | `GET /manager-queue` |
| `active-job.read.contract.ts` | `ManagerActiveJobSchema`/`Dto`: queue item shape + `claimedAt: string` | `GET /manager-queue/active` |

Modify `src/index.ts`: re-export all new schemas. Run `npm run build:contracts` after.

`ProcessRunDetailSchema.lifecycleHistory` items (existing, `process-run.read.contract.ts`)
gain one optional field: `manager: { id: string; name: string } | undefined` — additive, wire
format unchanged for stages nobody claimed via this flow.

**Contracts must be updated and built before any backend or frontend change that uses them.**

## Backend changes (`apps/backend`)

### Schema (`prisma/schema.prisma`)

Migration name: `add_manager_stage_queue`

1. **New model `ManagerStagePermission`:**
   ```prisma
   model ManagerStagePermission {
     id               String @id @default(uuid())
     managerId        String
     processId        String
     lifecycleStageId String

     manager        User           @relation("ManagerStagePermissions", fields: [managerId], references: [id])
     process        Process        @relation(fields: [processId], references: [id])
     lifecycleStage WorkflowStatus @relation(fields: [lifecycleStageId], references: [id])

     createdAt DateTime @default(now())

     @@unique([managerId, processId, lifecycleStageId])
     @@index([managerId])
     @@index([processId, lifecycleStageId])
   }
   ```
   `lifecycleStageId` references `WorkflowStatus.id`, not a duplicated string code — each
   `Process` maps 1:1 to exactly one lifecycle `WorkflowType` (via `ProcessRunDefinition`
   `sortOrder=1`), so a `WorkflowStatus.id` already unambiguously identifies "this stage of
   this process's lifecycle." Adding a new process/stage in the existing workflow admin makes
   it immediately assignable here, no code change — satisfies "data-driven, not hardcoded."

2. **`ProcessRun` — add claim fields:**
   ```prisma
   claimedBy String?
   claimedAt DateTime?
   claimedByUser User? @relation("ProcessRunClaimedBy", fields: [claimedBy], references: [id])

   @@index([claimedBy])
   ```

3. **New model `ProcessRunStageHistory`:**
   ```prisma
   model ProcessRunStageHistory {
     id               String   @id @default(uuid())
     processRunId     String
     processId        String
     lifecycleStageId String
     managerId        String

     claimedAt       DateTime
     completedAt     DateTime
     durationSeconds Int

     createdAt DateTime @default(now())

     processRun     ProcessRun     @relation(fields: [processRunId], references: [id], onDelete: Cascade)
     process        Process        @relation(fields: [processId], references: [id])
     lifecycleStage WorkflowStatus @relation(fields: [lifecycleStageId], references: [id])
     manager        User           @relation("ManagerStageHistory", fields: [managerId], references: [id])

     @@index([processRunId])
     @@index([managerId, completedAt])
     @@index([processId, lifecycleStageId])
     @@index([completedAt])
   }
   ```
   Never updated after insert. Index rationale (no future migration needed):
   `[managerId, completedAt]` → per-manager productivity (jobs completed today/this week,
   avg/fastest/slowest via `durationSeconds` aggregates). `[processId, lifecycleStageId]` →
   stage analytics (avg duration per stage/process, bottlenecks). `[completedAt]` → daily
   throughput. "Pending jobs" is a real-time count off `ProcessRun.claimedBy IS NULL`, not
   historical.

4. **`User` model** — add back-relations only: `managerStagePermissions
   ManagerStagePermission[] @relation("ManagerStagePermissions")`, `claimedRuns ProcessRun[]
   @relation("ProcessRunClaimedBy")`, `stageHistories ProcessRunStageHistory[]
   @relation("ManagerStageHistory")`.

5. **`Process` / `WorkflowStatus` models** — add back-relations only: `managerStagePermissions
   ManagerStagePermission[]`, `stageHistories ProcessRunStageHistory[]`.

Run `npx prisma migrate dev --name add_manager_stage_queue`, then `npx prisma generate`. No
manual SQL edit needed.

### Permissions

**No changes to `ROLE_PERMISSIONS.MANAGER`** — it already has `runs:view` and
`runs:lifecycle:update`, which is all this feature needs (list/claim/release/complete gated by
those two existing strings).

One narrow addition for the admin override only: add `runs:claim:override` to
`ROLE_PERMISSIONS.SUPER_ADMIN` and `ROLE_PERMISSIONS.ADMIN` (not `MANAGER`). Add
`RUNS_CLAIM_OVERRIDE = "runs:claim:override"` to the frontend `Permission` enum
(`apps/frontend/src/auth/permissions.ts`).

### Retire the old MANAGER branch in `getAllRuns`

File: `apps/backend/src/processes/admin-process.service.ts`

Remove the `if (callerRole === 'MANAGER') { query.executorUserId = ...; query.lifeCycleStatusCode = 'PRODUCTION'; query.orderStatus = 'IN_PRODUCTION'; }`
block added by the superseded spec. The Manager frontend no longer calls `GET /process/runs`
for its dashboard — this becomes dead code and should be deleted, not left as an inert branch.
`ADMIN` behavior is completely unaffected (that block never touched the `ADMIN` path).

### New module: `src/manager-queue/`

**`manager-queue.module.ts`** — imports `ProcessesModule` (for `AdminProcessService`).

**`manager-queue.service.ts`:**

- `listQueue(managerId)`:
  1. Load `ManagerStagePermission` rows for `managerId`, `include: { lifecycleStage: { select:
     { code: true } } }` → group into `Map<processId, string[] codes>`.
  2. If empty, return `[]`.
  3. Single query, one `OR` branch per permitted process (correct at the SQL level, no
     tuple-IN needed):
     ```ts
     this.prisma.processRun.findMany({
       where: {
         claimedBy: null,
         statusCode: 'IN_PROGRESS',
         orderProcess: { order: { statusCode: 'IN_PRODUCTION', deletedAt: null } },
         OR: Array.from(grouped.entries()).map(([processId, codes]) => ({
           orderProcess: { processId },
           lifeCycleStatusCode: { in: codes },
         })),
       },
       include: { orderProcess: { include: { process: true, order: { include: { customer: true } } } } },
     })
     ```
  4. Map to `ManagerQueueItemDto` (quantity resolution: try `fields.Quantity`, then
     `fields['Total Quantity']`, then `fields.pcs`, then `fields.total_quantity`, else `null` —
     `fields` keys are inconsistent across process types today; this is a display fallback,
     not new architecture).
- `listActive(managerId)`: `findMany({ where: { claimedBy: managerId } })`, same mapper +
  `claimedAt`. No stage-permission re-check — an active claim stays visible regardless of
  later permission changes; only the queue-list and claim path re-check permissions.
- `claim(managerId, runId)` — `prisma.transaction`:
  1. Load run with `orderProcess.processId` + `lifeCycleStatusCode`.
  2. Re-validate the caller has a `ManagerStagePermission` for this exact
     `(processId, lifeCycleStatusCode→lifecycleStageId)` pair — re-check at claim time, not
     just list time (stage may have advanced or permission may have been revoked since the
     queue was fetched). `ForbiddenException` otherwise.
  3. Atomic claim: `tx.processRun.updateMany({ where: { id: runId, claimedBy: null }, data: {
     claimedBy: managerId, claimedAt: new Date() } })`. If `result.count === 0` →
     `ConflictException('Run already claimed')`. This conditional `UPDATE ... WHERE claimedBy
     IS NULL` is what makes the claim atomic under Postgres row locking — no `SELECT ... FOR
     UPDATE` needed.
- `release(managerId, runId)`:
  1. Load run; if `run.claimedBy !== managerId` → `ForbiddenException`.
  2. `prisma.processRun.update({ where: { id: runId }, data: { claimedBy: null, claimedAt:
     null } })`. No `ProcessRunStageHistory` row — history only records **completed** stages.
- `forceRelease(adminId, runId)` — **new**, gated by `runs:claim:override`:
  1. No ownership check. `prisma.processRun.update({ where: { id: runId }, data: { claimedBy:
     null, claimedAt: null } })`.
  2. `logger.warn('Claim force-released by admin=... on run=...')` — audit trail via existing
     logging, no new schema field.
- `complete(managerId, runId)` — `prisma.transaction`:
  1. Load run; if `run.claimedBy !== managerId` → `ForbiddenException`.
  2. Resolve the run's lifecycle `WorkflowStatus` row (workflowTypeId from
     `runTemplate.lifecycleWorkflowTypeId`, code = `run.lifeCycleStatusCode`) → gives
     `lifecycleStageId`.
  3. Find the single outgoing `WorkflowTransition` from this status (no `condition`, or one
     the empty `context` satisfies). If more than one candidate exists, throw
     `BadRequestException('Ambiguous next stage — use the admin run view')` — managers only
     auto-advance the single default path, matching "cannot skip workflow stages."
  4. Call `adminProcessService.transition(orderProcessId, runId, nextStatusCode, undefined,
     tx)` — see signature change below. Does everything the admin flow already does (status
     update, `ProcessRunLifecycleHistory` bookkeeping, terminal/`OrderProcess` counter
     handling) — untouched behavior.
  5. `tx.processRun.update({ where: { id: runId }, data: { executorId: managerId, claimedBy:
     null, claimedAt: null } })` — sets `executorId` so `UserPerformance` analytics and the
     existing "Executor" UI field keep working, and clears the claim in the same statement.
  6. Insert `ProcessRunStageHistory`: `processRunId`, `processId` (from
     `orderProcess.processId`), `lifecycleStageId` (the stage **just completed**, from step
     2), `managerId`, `claimedAt: run.claimedAt`, `completedAt: now`, `durationSeconds:
     Math.round((now - run.claimedAt) / 1000)`.

**`manager-queue.controller.ts`:**

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/manager-queue` | `runs:view` | Unclaimed runs matching caller's stage permissions |
| `GET` | `/manager-queue/active` | `runs:view` | Runs currently claimed by caller |
| `POST` | `/manager-queue/:runId/claim` | `runs:lifecycle:update` | Atomic claim |
| `POST` | `/manager-queue/:runId/release` | `runs:lifecycle:update` | Release own claim |
| `POST` | `/manager-queue/:runId/complete` | `runs:lifecycle:update` | Complete stage, advance workflow |
| `POST` | `/manager-queue/:runId/force-release` | `runs:claim:override` | Admin-only: clear any claim |

`managerId`/`adminId` is always `req.user.id` — no query param, no injection surface.

### Modified: `AdminProcessService.transition()` (additive only)

File: `apps/backend/src/processes/admin-process.service.ts`

Add an optional trailing param so a caller already inside a transaction can join it, instead of
`transition()` always opening its own:
```ts
async transition(
  orderProcessId: string,
  processRunId: string,
  targetStatusCode: string,
  expectedDate?: string,
  tx?: PrismaExecutor,
) {
  const run = async (executor: PrismaExecutor) => { /* existing body, using `executor` instead of `this.prisma` inside the transaction callback */ };
  if (tx) return run(tx);
  return this.prisma.transaction(run);
}
```
Every existing call site omits the 5th param and behaves exactly as today. Only
`manager-queue.service.ts#complete()` passes its own transaction executor.

### Direct-API bypass guard on the raw transition endpoint

File: `apps/backend/src/processes/admin-process.controller.ts` /
`admin-process.service.ts#transition()`

Today `POST /process/:opId/runs/:runId/transition` is reachable by anyone with
`runs:lifecycle:update` — including `MANAGER`, with no claim check. Once this ships, a manager
could still call this endpoint directly (or via the existing `ViewRunModal`/legacy button
paths) and advance a run they never claimed, bypassing the whole queue mechanic. Add a guard
inside `transition()`: if the caller's role is `MANAGER` and the run's current
`(processId, lifeCycleStatusCode)` has any `ManagerStagePermission` row assigned at all (i.e.
this stage is under claim-based management), require `run.claimedBy === callerId` or throw
`ForbiddenException('Claim this run before advancing it')`. `ADMIN`/`SUPER_ADMIN` callers are
exempt (unaffected, same as today). This closes the gap without touching behavior for
processes/stages nobody has assigned via the new grid.

### Extended: Users module (`src/users/`)

Two new endpoints on the existing `UsersController`/`UsersService`:

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/users/:id/stage-permissions` | `users:view` | List a manager's `(processId, processName, lifecycleStageId, stageCode)` rows |
| `PUT` | `/users/:id/stage-permissions` | `users:update` | Replace-all: delete existing rows for the manager, insert the supplied set, in one transaction |

`PUT` validates: target user's `role === 'MANAGER'` (`BadRequestException` otherwise), and each
`lifecycleStageId`'s `WorkflowStatus` actually belongs to the given `processId`'s lifecycle
workflow type (same lookup pattern `getLifeCycleStatusesByProcess` already uses).

### Cutover & backfill (live-production safe rollout)

Not a one-off script — folded into `PUT /users/:id/stage-permissions`. Whenever a save adds
coverage for a `(processId, lifecycleStageId)` pair that had **no** prior
`ManagerStagePermission` row (i.e. this is the first time this process+stage becomes
claim-managed), run, inside the same transaction:
```ts
await tx.processRun.updateMany({
  where: {
    claimedBy: null,
    executorId: { not: null },
    lifeCycleStatusCode: newlyCoveredStageCode,
    orderProcess: { processId: newlyCoveredProcessId },
  },
  data: { /* cannot copy executorId → claimedBy in one updateMany without a per-row value */ },
});
```
`updateMany` can't copy one column into another per-row — so this must be a `findMany` (ids +
`executorId`) followed by per-row `update` calls inside the transaction (small volume: bounded
by in-flight runs at that exact stage, not the whole table). For `claimedAt`, look up each
run's `ProcessRunLifecycleHistory` row where `statusCode = newlyCoveredStageCode AND
completedAt IS NULL` and use its `createdAt` (the moment the run entered this stage); fall back
to the run's own `createdAt` if no such history row exists (defensive — should not happen for
runs already at a non-initial stage).

This keeps the migration correct as the admin rolls out coverage process-by-process, rather
than requiring one big-bang cutover moment.

### Run-detail timeline enrichment (surfacing manager attribution)

File: `apps/backend/src/mappers/*.mapper.ts` (wherever `ProcessRunDetailDto.lifecycleHistory`
is built for `getRunById`) — for each `ProcessRunLifecycleHistory` entry, look up a matching
`ProcessRunStageHistory` row (`processRunId` + `lifecycleStageId` via the entry's `statusCode`
resolved to a `WorkflowStatus.id`) and attach an optional `manager: { id, name } | undefined`
field. Additive, backward compatible — absent for stages nobody claimed via this flow (e.g.
pre-PRODUCTION stages an admin hasn't assigned to any manager).

## Frontend changes (`apps/frontend`)

- **New service** `src/services/managerQueueService.ts` — `listQueue()`, `listActive()`,
  `claim(runId)`, `release(runId)`, `complete(runId)`, `forceRelease(runId)` (admin-only), all
  via `apiRequest`.
- **Rewritten** `src/app/manager/runs/page.tsx` — two tabs, "Production Queue" (polls
  `listQueue()` every 7s) and "My Active Jobs" (polls `listActive()` every 7s). Queue cards:
  Run Number, Order Number, Customer Name, artwork thumbnail if present, Quantity, Process
  Name, Current Stage, Comments, "Start Work" → `claim(runId)` (on `409` show a toast "Already
  claimed" and refetch). Active cards: Run, Started At, live-ticking Elapsed Time from
  `claimedAt`, Current Stage, "Complete Stage" → `complete(runId)`, "Release Job" →
  `release(runId)` with a confirm dialog.
- **Rewritten** `src/components/modals/ManagerRunModal.tsx` — remove the hardcoded `step.code
  === 'PRODUCTION'` gate on the "Mark Complete" button entirely. Replace with claim-state-aware
  actions: if unclaimed and caller has permission → "Start Work"; if `claimedBy === self` →
  "Complete Stage" + "Release Job"; otherwise read-only ("Claimed by {name}" — a transient
  state between polls, since a claimed-by-other run shouldn't be in the queue view at all).
  Works for whatever stage the run is actually at, not just PRODUCTION.
- **Modified** `src/app/admin/users/page.tsx` — when the selected user's `role === 'MANAGER'`,
  show an "Assign Stage Permissions" action opening
  `src/components/users/StagePermissionsPanel.tsx` — fetches enabled processes (`GET
  /process`) + each process's stages (`GET /process/:id/lifecycle-statuses`, existing
  endpoint), loads current assignments (`GET /users/:id/stage-permissions`), renders a
  checklist grouped by process name, saves via `PUT /users/:id/stage-permissions`.
- **Modified** `src/components/modals/ViewRunModal.tsx` — Activity History entries render
  `h.manager?.name` when present, right under the existing status/date lines (~line 440).
- **Modified** `src/components/modals/BillingModal.tsx` — when a run row is expanded
  (`toggleRunExpansion`, existing state), lazily fetch `getRunById(run.id)` (existing service
  call, already returns the enriched `lifecycleHistory`) and render a compact sidebar/section:
  stage name, manager name, start/end time, duration. No new backend endpoint — reuses the
  same enriched `getRunById` response as `ViewRunModal`.
- **Modified** `src/auth/permissions.ts` — add `RUNS_CLAIM_OVERRIDE = "runs:claim:override"`.

## Files to create / modify

### `apps/packages/contracts`

| Action | Path |
|---|---|
| CREATE | `src/manager-queue/stage-permission.contract.ts` |
| CREATE | `src/manager-queue/queue-item.read.contract.ts` |
| CREATE | `src/manager-queue/active-job.read.contract.ts` |
| MODIFY | `src/process-run.read.contract.ts` — optional `manager` field on lifecycle history entries |
| MODIFY | `src/index.ts` |

### `apps/backend`

| Action | Path |
|---|---|
| MODIFY | `prisma/schema.prisma` |
| GENERATE | `prisma/migrations/<timestamp>_add_manager_stage_queue/migration.sql` |
| MODIFY | `src/auth/permissions.map.ts` — add `runs:claim:override` to SUPER_ADMIN/ADMIN only |
| MODIFY | `src/processes/admin-process.service.ts` — remove old MANAGER branch in `getAllRuns`; `transition()` optional `tx` param; claim-bypass guard |
| CREATE | `src/manager-queue/manager-queue.module.ts` |
| CREATE | `src/manager-queue/manager-queue.service.ts` |
| CREATE | `src/manager-queue/manager-queue.controller.ts` |
| MODIFY | `src/users/users.service.ts` — `getStagePermissions`, `updateStagePermissions` (incl. incremental backfill) |
| MODIFY | `src/users/users.controller.ts` — 2 new endpoints |
| MODIFY | `src/app.module.ts` — register `ManagerQueueModule` |
| MODIFY | `src/mappers/*.mapper.ts` (run-detail mapper) — attach `manager` to lifecycle history entries |
| CREATE | `src/manager-queue/manager-queue.service.spec.ts` |
| CREATE | `src/manager-queue/manager-queue.integration.spec.ts` (claim race condition test) |
| CREATE | `src/users/stage-permissions.integration.spec.ts` |

### `apps/frontend`

| Action | Path |
|---|---|
| MODIFY | `src/auth/permissions.ts` |
| CREATE | `src/services/managerQueueService.ts` |
| MODIFY | `src/services/usersService.ts` — stage-permission methods |
| REWRITE | `src/app/manager/runs/page.tsx` — queue + active tabs |
| REWRITE | `src/components/modals/ManagerRunModal.tsx` — claim-aware actions, any stage |
| CREATE | `src/components/users/StagePermissionsPanel.tsx` |
| MODIFY | `src/app/admin/users/page.tsx` |
| MODIFY | `src/components/modals/ViewRunModal.tsx` |
| MODIFY | `src/components/modals/BillingModal.tsx` |

## New dependencies

No new npm packages.

## Vercel constraints to check

- Claim/release/complete are single-row conditional updates or small transactions — well
  within the 10 s limit.
- Queue/active polling at 7 s per logged-in manager is the main new load. At factory scale
  (per domain.md's ~20-40 orders/day, a handful of managers) this is negligible.
- The incremental backfill inside `PUT /users/:id/stage-permissions` is bounded by in-flight
  runs at one specific (process, stage) pair — small, well within limits even as a per-row
  loop instead of `updateMany`.
- No websockets/SSE — polling is the mechanism, consistent with `NotificationBell.tsx`'s
  existing pattern (just faster, at 7s vs its 30s).

## Implementation rules for this feature

- All status transitions must go through `DynamicWorkflowEngine.validateTransition()` /
  `AdminProcessService.transition()` — the complete flow never writes `lifeCycleStatusCode`
  directly
- Use `PrismaService.transaction()` for multi-step writes (claim, complete, backfill); update
  denormalized counters only via the existing `transition()` path, never duplicated
- All frontend API calls must go through `apiRequest` / `apiRequestWithHeaders` — never raw
  `fetch`
- After editing `apps/packages/contracts/src/`, run `npm run build:contracts`
- Do not change behaviour of existing endpoints for `ADMIN` callers — every guard added here
  (`getAllRuns` cleanup, transition bypass check) is scoped to `MANAGER` only
- A run can only ever have one non-null `claimedBy` — enforced by the conditional
  `updateMany(... WHERE claimedBy IS NULL)`, never by an app-level lock
- `ProcessRunStageHistory` rows are created only on `complete()`, never on `release()` or
  `forceRelease()`, and are never updated or deleted afterward
- Managers only ever auto-advance along a single unconditional next transition; ambiguous
  (multi-target) transitions are rejected with a clear error, not resolved by guessing
- `executorId` is set to the completing manager on every `complete()` call, keeping
  `UserPerformance` and existing UI fields correct

## Definition of done

- [ ] `npm test --workspace apps/backend` passes, including the new claim-race and
      stage-permission integration tests
- [ ] Lint + build pass across all three workspaces
- [ ] `POST /manager-queue/:runId/claim` — two concurrent requests for the same run: exactly
      one succeeds (200), the other gets `409 Conflict`
- [ ] A manager only ever sees runs in `GET /manager-queue` matching their assigned
      `(Process, Lifecycle Stage)` pairs, at any stage (not just PRODUCTION) — verified with a
      manager assigned to a subset (e.g. Screen Print→Production, DTF→Tracing) confirming
      other processes/stages never appear
- [ ] After Manager A claims a run, it disappears from Manager B's `GET /manager-queue` (same
      permissions) on next poll, and appears in Manager A's `GET /manager-queue/active`
- [ ] `POST /manager-queue/:runId/release` clears the claim and the run reappears in every
      eligible manager's queue; releasing another manager's claim returns `403`
- [ ] `POST /manager-queue/:runId/force-release` works for ADMIN regardless of who holds the
      claim; a MANAGER calling it gets `403` (no `runs:claim:override` permission)
- [ ] `POST /manager-queue/:runId/complete` advances `lifeCycleStatusCode` exactly as an
      equivalent ADMIN-driven `transition()` call would, sets `executorId`, creates one
      `ProcessRunStageHistory` row with correct `durationSeconds`, clears the claim, and
      terminal-stage handling (OrderProcess counters) still fires correctly
- [ ] Completing an ambiguous (multi-transition) stage returns a clear `400`
- [ ] A MANAGER calling `POST /process/:opId/runs/:runId/transition` directly (bypassing the
      queue) for a claim-managed stage they haven't claimed gets `403`; the same call by ADMIN
      is unaffected
- [ ] Admin can assign/edit a manager's stage permissions via the new panel on
      `/admin/users`; saving a newly-covered (process, stage) pair backfills `claimedBy` from
      `executorId` for any currently-unclaimed, in-flight runs at that exact pair
- [ ] `ViewRunModal`'s Activity History shows "by {manager name}" for stages completed via this
      flow, nothing extra for stages outside its coverage
- [ ] `BillingModal`'s new sidebar shows the same lifecycle + manager + start/end + duration
      when a run row is expanded
- [ ] An ADMIN calling `GET /api/v1/process/runs` without filters still sees all runs as
      before — no regression from removing the old MANAGER branch
