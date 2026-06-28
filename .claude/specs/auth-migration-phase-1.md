# Spec: Auth Migration Phase 1 — Internal Auth Behind Flag

**Companion specs:** `.claude/specs/auth-migration-internal.md` (design, accepted risks, exact method logic)
`.claude/specs/auth-migration-implementation-plan.md` (step-by-step order, verification checklist)
**Branch:** `feature/auth-migration-phase-1` (cut from `develop`)
**Status:** Ready to implement

---

## Overview

Implement a bcrypt + HS256 JWT auth module directly inside NestJS as a feature-flag-gated
alternative to the existing Keycloak auth path. When `INTERNAL_AUTH_ENABLED=false` (the
default), every existing behaviour is preserved exactly — Keycloak still handles all auth,
and `POST /auth/login` returns 503 to signal the internal path is disabled. When
`INTERNAL_AUTH_ENABLED=true`, all auth routes through the new internal module. Keycloak
remains live and unmodified throughout Phase 1; this phase never flips the flag in
production.

This phase also delivers the `/login` page, the `/admin/users` user-management UI, and the
Users CRUD API — all required for the internal auth path to be usable. It includes full unit
and integration test coverage for both auth paths (11 spec files total). The seed script for
Phase 2 cutover is explicitly deferred.

---

## Scope

**In scope:**

- Install `bcrypt` + `@types/bcrypt` in `apps/backend` (`@nestjs/jwt` already present)
- Prisma: add `Login` model (with audit fields); add `login Login?` back-relation to `User`; remove `@unique` + `@@index([email])` from `User`; generate migration `add_login_table` and manually append partial-index SQL; run `prisma generate`
- `JWT_SECRET` startup validation in both `main.ts` and `main.serverless.ts`
- 5 new Zod schemas in `@app/contracts`: `PasswordSchema`, `CreateUserSchema`, `UpdateUserSchema`, `UpdatePermissionsSchema`, `ResetPasswordSchema`
- `auth/permissions.map.ts`: `ROLE_PERMISSIONS` map + `ALL_PERMISSIONS` array
- `auth/jwt/internal-jwt.service.ts`: sign/verify HS256 access + refresh tokens with `iss`/`aud`
- `auth/guards/internal-jwt-auth.guard.ts`: extracts `ACCESS_TOKEN` cookie or Bearer header, verifies token, populates `req.user` + `RequestContextStore`
- Rename `auth/guards/jwt-auth.guard.ts` → `keycloak-jwt-auth.guard.ts`, class `JwtAuthGuard` → `KeycloakJwtAuthGuard`; update all imports
- Register `JwtModule` in `auth.module.ts` (not currently registered despite package being present)
- `auth/utils/cookie-domain.util.ts`: fix `httpOnly`/`secure` defaults (flip `=== 'true'` → `!== 'false'`); delete dead `resolveCookieDomain()` function; fix ACCESS_TOKEN TTL `10 * 60` → `15 * 60` in `auth.service.ts`
- `auth/auth.service.ts`: add `login()`, `refreshInternal()`, `logoutInternal()`, `revokeSession()`
- `auth/auth.controller.ts`: add `POST /auth/login @Public()`; dispatch `POST /auth/refresh` and `POST /auth/logout` on flag; fix open redirect in `GET /auth/callback`; add CSRF nonce on `GET /auth/login` + verify on `GET /auth/callback`; add `GET /health @Public()`
- `auth/guards/auth.guard.ts`: inject `InternalJwtAuthGuard` + flag dispatch
- `auth/auth.module.ts`: register `JwtModule.register(...)`, `InternalJwtService`, `InternalJwtAuthGuard`; keep all Keycloak providers
- `app.module.ts`: add `UsersModule` to imports
- New `src/users/` module: `users.service.ts`, `users.controller.ts`, `users.module.ts`
- Frontend `src/services/usersService.ts`: typed `apiRequest` wrapper for all 9 Users endpoints
- Frontend `src/app/login/page.tsx`: email + password form → `POST /auth/login` → redirect
- Frontend `src/app/admin/users/page.tsx`: user list + create modal + all row actions + permissions checklist drawer
- Frontend `src/middleware.ts`: flag-based redirect to `/login` vs Keycloak URL
- All unit tests (6 spec files) + integration tests (5 spec files)

**Out of scope:**

- Seed script (`prisma/seeds/seed-login-records.ts`) — deferred to Phase 2
- Phase 3 Keycloak removal code (Keycloak stays intact throughout Phase 1)
- Phase 3 infra: DigitalOcean Droplet, nginx, PM2, GitHub Actions workflows
- Phase 4 monitoring (UptimeRobot, DO alerts)
- MFA, email password reset, self-service password change, session listing, account lockout

---

## Depends on

- Local PostgreSQL running and accessible (needed for `npx prisma migrate dev`)
- `.env` (backend) must have:
  ```
  JWT_SECRET=<min 32 chars — generate: openssl rand -hex 64>
  JWT_ACCESS_EXPIRES=15m
  JWT_REFRESH_EXPIRES=7d
  BCRYPT_ROUNDS=10
  INTERNAL_AUTH_ENABLED=false
  ```
- Frontend `.env.local` must have `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=false`
- Existing Keycloak env vars remain set — Keycloak path must continue to work
- No UAT environment needed for Phase 1 (local dev + staging only)
- Read both companion specs before implementing; they contain the exact method logic,
  accepted risks, and the ordered implementation steps (1.1–1.18)

---

## Contract changes (`@app/contracts`)

Create 5 new files under `apps/packages/contracts/src/`:

| File                                     | Exports                                               | Used by                                             |
| ---------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `auth/password.schema.ts`              | `PasswordSchema`                                    | `POST /users`, `POST /users/:id/reset-password` |
| `users/create-user.contract.ts`        | `CreateUserSchema`, `CreateUserDto`               | `POST /users`                                     |
| `users/update-user.contract.ts`        | `UpdateUserSchema`, `UpdateUserDto`               | `PATCH /users/:id`                                |
| `users/update-permissions.contract.ts` | `UpdatePermissionsSchema`, `UpdatePermissionsDto` | `PATCH /users/:id/permissions`                    |
| `users/reset-password.contract.ts`     | `ResetPasswordSchema`, `ResetPasswordDto`         | `POST /users/:id/reset-password`                  |

Exact schema definitions are in `auth-migration-internal.md` → "User Management — Contracts section".

`PasswordSchema` rules: min 3 chars, must contain at least one letter.

Modify `src/index.ts`: re-export all 5 new schemas. Run `npm run build:contracts` after.

**Contracts must be updated and built before any backend or frontend change that uses them.**

---

## Backend changes (`apps/backend`)

### New routes (all under `/api/v1`)

| Method     | Path                          | Auth          | Permission                    | Description                                                               |
| ---------- | ----------------------------- | ------------- | ----------------------------- | ------------------------------------------------------------------------- |
| `GET`    | `/health`                   | `@Public()` | none                          | Returns`{ status: 'ok', timestamp: ISO string }`                        |
| `POST`   | `/auth/login`               | `@Public()` | none                          | Internal login. Returns 503 if`INTERNAL_AUTH_ENABLED=false`             |
| `GET`    | `/users`                    | required      | `users:view`                | List all non-deleted users                                                |
| `GET`    | `/users/me`                 | required      | none (any authenticated user) | Own profile +`Login.permissions` from DB                                |
| `GET`    | `/users/:id`                | required      | `users:view`                | Single user including`permissions[]`                                    |
| `POST`   | `/users`                    | required      | `users:create`              | Create`User` + `Login` in one transaction                             |
| `PATCH`  | `/users/:id`                | required      | `users:update`              | Update name, role, locationId, isActive                                   |
| `PATCH`  | `/users/:id/permissions`    | required      | `users:update`              | Replace permission set + increment`tokenVersion`. Self-targeting → 403 |
| `DELETE` | `/users/:id`                | required      | `users:delete`              | Soft-delete:`User.deletedAt` + `Login.isActive=false` in transaction  |
| `POST`   | `/users/:id/revoke-session` | required      | `users:update`              | Increment`tokenVersion`. Self-targeting → 403                          |
| `POST`   | `/users/:id/reset-password` | required      | `users:update`              | Set new bcrypt hash + increment`tokenVersion`                           |

### Modified routes

- `POST /auth/refresh @Public()` — add flag dispatch: if `INTERNAL_AUTH_ENABLED=true` → `authService.refreshInternal(...)`, else → existing Keycloak path
- `POST /auth/logout @Public()` — add flag dispatch: if `INTERNAL_AUTH_ENABLED=true` → `authService.logoutInternal(...)`, else → existing Keycloak path
- `GET /auth/callback` — fix open redirect: validate `redirectTo` starts with `/` not `//`; add CSRF nonce verify (nonce set as cookie on `GET /auth/login`, checked here)

### New/modified services

**`InternalJwtService`** (`auth/jwt/internal-jwt.service.ts`):

- `signAccessToken(payload)` / `signRefreshToken(payload)` — HS256 using `JWT_SECRET`, include `iss: 'skyprints'`, `aud: 'skyprints-api'`
- `verifyAccessToken(token)` / `verifyRefreshToken(token)` — validate signature + `iss` + `aud`
- Uses `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` env vars

**`AuthService`** additions:

- `login(email, password, res, req)` — see exact logic in `auth-migration-internal.md` → "auth/auth.service.ts"
  - Login check order: User exists + `deletedAt IS NULL` → `User.isActive` → `Login` exists → `Login.isActive` → `bcrypt.compare`
  - On fail: increment `failedLoginAttempts` + update `lastFailedLoginAt`
  - On success: reset `failedLoginAttempts = 0`, set `lastLoginAt = now()`
  - Signs both JWTs → `setAuthCookies(res, tokens, req)`
- `refreshInternal(refreshToken, res, req)` — verifies REFRESH_TOKEN, checks `Login.isActive`, checks `tokenVersion` match, reads fresh `Login.permissions`, issues new ACCESS_TOKEN
- `logoutInternal(userId, res, req)` — increments `tokenVersion` + clears both cookies
- `revokeSession(userId)` — increments `tokenVersion` only

**`UsersService`** (`src/users/users.service.ts`):

- `list()`, `findById(id)`, `findMe(userId)`, `create(dto)`, `update(id, dto)`, `updatePermissions(requestingUserId, id, dto)`, `softDelete(id)`, `revokeSession(requestingUserId, id)`, `resetPassword(id, dto)`
- `create()`: validate `locationId` if provided → transaction: `User` + `Login` (permissions = `dto.permissions ?? ROLE_PERMISSIONS[role]`). DB partial index catches duplicate active email → `ConflictException('Email already in use')`
- `updatePermissions()`: self-guard → validate all strings in `ALL_PERMISSIONS` → update + increment `tokenVersion`
- `softDelete()`: transaction: `User.deletedAt = now()` + `Login.isActive = false`
- `revokeSession()`: self-guard → increment `tokenVersion`
- `resetPassword()`: `bcrypt.hash(password, BCRYPT_ROUNDS)` → update `passwordHash` + increment `tokenVersion`
- `findMe()`: reads `Login.permissions` from DB directly (not from JWT)

### Schema changes

Migration name: `add_login_table`

**`schema.prisma` changes:**

1. Add `Login` model — see `auth-migration-internal.md` → "New: Login table" for exact field list with audit fields (`lastLoginAt`, `failedLoginAttempts`, `lastFailedLoginAt`, `tokenVersion`, `isActive`, `permissions String[]`)
2. Add `login Login?` back-relation to `User` model (no other `User` field changes)
3. Remove `@unique` from `User.email`
4. Remove `@@index([email])` from `User`

**Migration file edit** — after `npx prisma migrate dev --name add_login_table`, manually append to the generated SQL:

```sql
-- Remove full unique constraint replaced by partial index below
DROP INDEX IF EXISTS "User_email_key";
-- Enforce uniqueness only for non-deleted users
CREATE UNIQUE INDEX "User_email_active_unique" ON "User" (email) WHERE "deletedAt" IS NULL;
```

Then run `npx prisma generate`.

---

## Frontend changes (`apps/frontend`)

- **New page** `src/app/login/page.tsx`

  - Email + password form (no Keycloak redirect)
  - Calls `POST /auth/login` via `apiRequest`
  - On success: `router.push(searchParams.get('redirectTo') ?? '/')`
  - On error: display error message from API response
  - Page is accessible at all times regardless of flag; middleware only redirects here when `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=true`
- **New page** `src/app/admin/users/page.tsx` (already behind ADMIN `RoleGuard` via `admin/layout.tsx`)

  - User list table: Name, Email, Role, Location, Status (isActive), Permissions count, Actions
  - Create user modal: name, email, role, location (optional), password, permissions checklist pre-checked to role defaults (admin may customise before saving)
  - Row actions per user:
    - Edit details (name, role, location, isActive toggle) → `PATCH /users/:id`
    - Edit permissions → drawer with checklist + "Load role defaults" button; note shown: "Changes take effect on the user's next login or token refresh."
    - Reset password (admin sets directly) → `POST /users/:id/reset-password`
    - Revoke session (confirmation dialog) → `POST /users/:id/revoke-session`. Button disabled for own row.
    - Delete (soft-delete, confirmation dialog) → `DELETE /users/:id`
  - Permissions checklist grouped by domain (see `auth-migration-internal.md` → "Permissions grouping in checklist UI")
- **New service** `src/services/usersService.ts`

  - Typed wrapper around `apiRequest` / `apiRequestWithHeaders`
  - Methods: `list()`, `getById(id)`, `getMe()`, `create(dto)`, `update(id, dto)`, `updatePermissions(id, dto)`, `delete(id)`, `revokeSession(id)`, `resetPassword(id, dto)`
  - **Note:** existing `src/services/user.service.ts` (Keycloak user-sync endpoints) is **not modified**
- **Modified** `src/middleware.ts`

  - Add flag-based redirect when `ACCESS_TOKEN` cookie absent:
    ```typescript
    const isInternal = process.env.NEXT_PUBLIC_INTERNAL_AUTH_ENABLED === 'true';
    const redirectTo = encodeURIComponent(pathname + search);
    const loginUrl = isInternal
      ? `/login?redirectTo=${redirectTo}`
      : `${process.env.NEXT_PUBLIC_API_URL}/auth/login?redirectTo=${redirectTo}`;
    return NextResponse.redirect(new URL(loginUrl, req.url));
    ```

---

## Files to create / modify

### `apps/packages/contracts`

| Action | Path                                         |
| ------ | -------------------------------------------- |
| CREATE | `src/auth/password.schema.ts`              |
| CREATE | `src/users/create-user.contract.ts`        |
| CREATE | `src/users/update-user.contract.ts`        |
| CREATE | `src/users/update-permissions.contract.ts` |
| CREATE | `src/users/reset-password.contract.ts`     |
| MODIFY | `src/index.ts` — add 5 new exports        |

### `apps/backend`

| Action        | Path                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY        | `prisma/schema.prisma`                                                                                                                                         |
| GENERATE+EDIT | `prisma/migrations/<timestamp>_add_login_table/migration.sql`                                                                                                  |
| MODIFY        | `src/main.ts` — JWT_SECRET startup validation                                                                                                                 |
| MODIFY        | `src/main.serverless.ts` — JWT_SECRET startup validation                                                                                                      |
| CREATE        | `src/auth/permissions.map.ts`                                                                                                                                  |
| CREATE        | `src/auth/jwt/internal-jwt.service.ts`                                                                                                                         |
| RENAME+MODIFY | `src/auth/guards/jwt-auth.guard.ts` → `keycloak-jwt-auth.guard.ts` (class `JwtAuthGuard` → `KeycloakJwtAuthGuard`; update all imports across codebase) |
| CREATE        | `src/auth/guards/internal-jwt-auth.guard.ts`                                                                                                                   |
| MODIFY        | `src/auth/guards/auth.guard.ts`                                                                                                                                |
| MODIFY        | `src/auth/utils/cookie-domain.util.ts`                                                                                                                         |
| MODIFY        | `src/auth/auth.service.ts`                                                                                                                                     |
| MODIFY        | `src/auth/auth.controller.ts`                                                                                                                                  |
| MODIFY        | `src/auth/auth.module.ts`                                                                                                                                      |
| MODIFY        | `src/app.module.ts`                                                                                                                                            |
| CREATE        | `src/users/users.service.ts`                                                                                                                                   |
| CREATE        | `src/users/users.controller.ts`                                                                                                                                |
| CREATE        | `src/users/users.module.ts`                                                                                                                                    |
| CREATE        | `src/auth/auth.service.spec.ts`                                                                                                                                |
| CREATE        | `src/auth/jwt/internal-jwt.service.spec.ts`                                                                                                                    |
| CREATE        | `src/auth/guards/internal-jwt-auth.guard.spec.ts`                                                                                                              |
| CREATE        | `src/auth/guards/auth.guard.spec.ts`                                                                                                                           |
| CREATE        | `src/auth/guards/permissions.guard.spec.ts`                                                                                                                    |
| CREATE        | `src/users/users.service.spec.ts`                                                                                                                              |
| CREATE        | `src/auth/auth.integration.spec.ts`                                                                                                                            |
| CREATE        | `src/auth/auth.flag.integration.spec.ts`                                                                                                                       |
| CREATE        | `src/auth/concurrent-session.integration.spec.ts`                                                                                                              |
| CREATE        | `src/auth/permissions.integration.spec.ts`                                                                                                                     |
| CREATE        | `src/users/users.integration.spec.ts`                                                                                                                          |

### `apps/frontend`

| Action | Path                             |
| ------ | -------------------------------- |
| MODIFY | `src/middleware.ts`            |
| CREATE | `src/app/login/page.tsx`       |
| CREATE | `src/app/admin/users/page.tsx` |
| CREATE | `src/services/usersService.ts` |

---

## New dependencies

**`apps/backend`:**

- `bcrypt` — password hashing (runtime)
- `@types/bcrypt` — TypeScript types (devDependency)
- `@nestjs/jwt` — already in `package.json` but NOT registered in `auth.module.ts`; no install needed, only registration

**No new frontend dependencies.**

---

## Vercel constraints to check

**`bcrypt` native module risk (critical — verify first):**
`bcrypt` uses native C++ bindings. Vercel Lambda build environments sometimes reject native
addons. Before writing any other bcrypt code, run a Vercel preview deploy with `bcrypt`
installed. If the build fails with a native module error, replace with `bcryptjs` (pure JS,
drop-in API replacement, no `@types` package needed). The rest of the implementation is
identical either way.

**Runtime timeout:** `bcrypt.compare` at 10 rounds ≈ 100 ms — well within the 10 s limit.
All Users endpoints are lightweight Prisma queries. No timeout risk.

**`@nestjs/jwt`** is pure JS — no native module concern.

---

## Implementation rules for this feature

- All status transitions must go through `DynamicWorkflowEngine.validateTransition()`
- New endpoints must use `@Permissions('resource:action')` — `users:view`, `users:create`, `users:update`, `users:delete` are **already present** in `src/auth/permissions.ts` (frontend `Permission` enum). No enum changes needed.
- Use `PrismaService.transaction()` for multi-step writes; update denormalized counters in the same transaction
- Decimal arithmetic must use `billing/utils/money.ts`; never use native `number` for money
- All frontend API calls must go through `apiRequest` / `apiRequestWithHeaders` — never raw `fetch`
- After editing `apps/packages/contracts/src/`, run `npm run build:contracts`
- Do not change behaviour of existing endpoints without explicit approval — project is live in production
- **Implementation order:** follow steps 1.1–1.18 in `auth-migration-implementation-plan.md` exactly. Contracts first, then migration, then services, then controller, then Users module, then frontend
- `INTERNAL_AUTH_ENABLED=false` is the default. Never flip to `true` in production during Phase 1
- The flag is read from `process.env` at runtime — no rebuild required on flag change
- `POST /auth/login` must return HTTP 503 (not 404 or 401) when `INTERNAL_AUTH_ENABLED=false`, so the client can distinguish "feature not enabled" from "wrong credentials"
- `req.user` shape must remain `{ id, email, permissions[] }` — `InternalJwtAuthGuard` must attach the same shape as the existing Keycloak guard
- `GET /users/me` reads `Login.permissions` directly from the database, not from the JWT payload — always returns the current permission set even if the ACCESS_TOKEN is stale
- Self-modification guards: `PATCH /users/:id/permissions` and `POST /users/:id/revoke-session` must throw `ForbiddenException('You cannot modify your own permissions')` / `ForbiddenException('You cannot revoke your own session')` when `req.user.id === params.id`
- `isActive` semantics — two independent flags, checked in order inside `login()`:
  1. Find `User` by email where `deletedAt IS NULL` → 401 generic if not found
  2. Check `User.isActive` → 401 "Account disabled. Contact administrator." if false
  3. Find `Login` by userId → 401 generic if missing
  4. Check `Login.isActive` → 401 "Login temporarily disabled. Contact administrator." if false
  5. `bcrypt.compare` → 401 "Invalid credentials" on fail (always generic — never reveal which step failed to an attacker)
- `PATCH /users/:id` with `{ isActive: false }` sets only `User.isActive`. `Login.isActive` is changed only programmatically (soft-delete cascade)
- `DELETE /users/:id` must atomically set `User.deletedAt = now()` AND `Login.isActive = false` in a single Prisma transaction
- `POST /auth/refresh` (internal path) must check `Login.isActive` after `tokenVersion` validation — prevents a soft-deleted user with a valid REFRESH_TOKEN from obtaining new ACCESS_TOKENs
- Cookie defaults after fix: `httpOnly` and `secure` default to `true` when env vars are unset (changed from opt-in to opt-out)
- Do not rename or modify `src/services/user.service.ts` (Keycloak user-sync) — it is a different service

---

## Definition of done

### Automated tests

- [ ] `npm test --workspace apps/backend` passes — all 11 spec files green (6 unit + 5 integration)
- [ ] No pre-existing code broken (lint + build pass)

### Backend — flag=false (Keycloak path must be identical to today)

- [ ] Existing Keycloak login flow works end-to-end locally with `INTERNAL_AUTH_ENABLED=false`
- [ ] `POST /auth/login` returns 503 when `INTERNAL_AUTH_ENABLED=false`
- [ ] All existing pages load correctly (orders, runs, billing, etc.)
- [ ] `GET /health` returns `{ status: 'ok', timestamp: "<ISO>" }` without auth cookie

### Backend — flag=true (internal auth path)

- [X] `POST /auth/login` with valid credentials: 200, `ACCESS_TOKEN` + `REFRESH_TOKEN` cookies set
- [X] `POST /auth/login` with wrong password: 401; `failedLoginAttempts` incremented in DB
- [X] `POST /auth/login`, `User.isActive=false`: 401 "Account disabled. Contact administrator."
- [X] `POST /auth/login`, `Login.isActive=false`: 401 "Login temporarily disabled. Contact administrator."
- [X] `GET /auth/me`: same response shape as today — `{ id, alternateEmail, permissions[], user }`
- [X] `POST /auth/refresh` with valid REFRESH_TOKEN: issues new ACCESS_TOKEN; `permissions[]` matches current `Login.permissions` in DB
- [X] `POST /auth/refresh` after `revokeSession`: 401
- [X] `POST /auth/refresh` after `softDelete`: 401 (`Login.isActive=false`)
- [X] `POST /auth/logout`: increments `tokenVersion`; clears cookies; old REFRESH_TOKEN rejected on next refresh attempt
- [X] `ACCESS_TOKEN` cookie: `httpOnly=true`, `secure=true`, `samesite=none`, TTL ≈15 min
- [X] `REFRESH_TOKEN` cookie: `httpOnly=true`, `secure=true`, `samesite=none`, TTL ≈7 days

### Users module

- [X] `GET /users` lists all non-deleted users; requires `users:view`
- [X] `POST /users`: User + Login created in single transaction; `Login.permissions` defaults to `ROLE_PERMISSIONS[role]` when not supplied
- [X] `POST /users` with custom permissions: `Login.permissions` matches the supplied array
- [X] `POST /users` with duplicate active email: 409 ConflictException
- [X] `POST /users` with soft-deleted user's email: 201 (partial unique index allows reuse)
- [X] `POST /users` with non-existent or inactive `locationId`: 400 BadRequestException
- [X] `PATCH /users/:id` role change: `Login.permissions` unchanged (role change does NOT reset permissions)
- [X] `PATCH /users/:id/permissions`: permissions updated + `tokenVersion` incremented; user's next refresh returns new permissions in ACCESS_TOKEN
- [X] `PATCH /users/:id/permissions` targeting self: 403
- [X] `PATCH /users/:id/permissions` with unknown permission string: 400
- [X] `PATCH /users/:id/permissions` with empty array `[]`: succeeds (user has no permissions)
- [X] `POST /users/:id/revoke-session`: `tokenVersion` incremented; affected user's next refresh → 401 → redirected to /login
- [X] `POST /users/:id/revoke-session` targeting self: 403
- [X] `POST /users/:id/reset-password`: new `passwordHash` stored; `tokenVersion` incremented; affected user's old REFRESH_TOKEN rejected on next refresh
- [X] `DELETE /users/:id`: `User.deletedAt` set + `Login.isActive=false` atomically; affected user cannot log in (401 generic)
- [X] `GET /users/me`: returns `Login.permissions` from DB — not from ACCESS_TOKEN payload

### Frontend

- [X] `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=false`: middleware redirects unauthenticated `/admin` and `/manager` to Keycloak URL (no change from today)
- [X] `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=true`: middleware redirects to `/login?redirectTo=...`
- [X] `/login` page renders email + password form
- [X] Login with valid credentials: redirected to `redirectTo` param (or `/`)
- [X] Login with wrong password: error message displayed, no redirect
- [X] `/admin/users` page visible to ADMIN role; not accessible to MANAGER/OPERATOR (existing `RoleGuard` handles this)
- [X] Create user modal: new User + Login appear in list after save
- [X] Permissions drawer: "Load role defaults" pre-checks correct permissions for the selected role
- [X] Revoke session button disabled on own row; shows confirmation dialog and succeeds on other rows
- [X] Soft-delete removes user from list
- [X] Password reset triggers tokenVersion increment (verify via API — the affected user's next refresh returns 401)
