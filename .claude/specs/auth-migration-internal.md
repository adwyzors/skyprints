# Auth Migration: Keycloak → Internal JWT Auth

**Decision date:** 2026-06-27
**Grilled & updated:** 2026-06-28
**Status:** Planned — not yet implemented
**Branch:** `feature/internal-auth` (cut from `develop`, never commit directly to `develop` or `main`)
**Scope:** Internal auth module + Login table + User management UI + flag-based phased rollout + DO deployment

---

## Decision summary

Drop Keycloak entirely. Replace with a custom auth module embedded in NestJS (bcrypt +
HS256 JWT). Move the NestJS backend from Vercel serverless to the existing DigitalOcean
Droplet (2GB RAM, ₹1000/month). Next.js frontend stays on Vercel (unchanged).

**Why:** Keycloak (Java) at ~90% RAM on the 2GB Droplet is one GC pause from OOM.
5-6 active users, no SAML/LDAP/social OAuth needed. NestJS on Vercel serverless has cold
starts, 10s timeout, Prisma connection pooling pressure, and native cron can't run.

**Rollout strategy:** Flag-based, 4 phases. No big-bang cutover. Keycloak stays running
until Phase 3. At no point is there a window where auth is completely broken.

---

## Accepted risks (explicit decisions)

| Risk | Decision |
|---|---|
| No rate limiting on `POST /auth/login` during Phase 1–2 (Vercel) | Accepted. nginx rate limiting added in Phase 3 (Droplet). Phase 1-2 window is short and monitored. |
| REFRESH_TOKEN not rotated on each use | Accepted. 7-day validity window acceptable for 5-6 user factory app with session revocation via `tokenVersion`. |
| Flag-flip race window (~60s) | Accepted. Flipped only when active users = 0 (late night). `POST /auth/login` returns 503 during brief mismatch window. |
| ACCESS_TOKEN revocation lag (up to 15 min) | Accepted. On `revokeSession` or `logout`, current ACCESS_TOKEN stays valid until expiry. REFRESH_TOKEN is invalidated immediately on next refresh attempt. |
| Admin sets initial passwords for all users | Accepted. 5-6 people; admin is the main authority. No self-service password reset needed. |
| tokenVersion read race during concurrent refresh | Accepted. Two simultaneous refreshes both succeeding is benign. Revocation lag is ≤15 min (already documented). |

---

## Git branch

```bash
git checkout develop
git pull
git checkout -b feature/internal-auth
```

All work for this migration goes on `feature/internal-auth`. PRs merge to `develop`.
Do not commit auth migration work directly to `develop` or `main`.

---

## Architecture after full migration (Phase 3+)

```
Browser
  └── Next.js frontend (Vercel, unchanged)
        ├── /login page (new — replaces Keycloak UI)
        ├── /admin/users page (new — user management)
        └── All other pages (unchanged)

NestJS backend (DigitalOcean Droplet, port 3001)
  └── nginx (port 443 → 3001, Let's Encrypt SSL)
  └── PM2 (process manager, auto-restart)
  └── Internal auth module (bcrypt + HS256 JWT)
  └── Users module (CRUD + session revocation)
  └── @nestjs/schedule cron jobs (native, replaces Vercel cron workaround)
  └── Prisma → hosted PostgreSQL (unchanged)
  └── Cloudflare R2 (unchanged)
```

Cross-origin: frontend (`app.yourdomain.com`) → backend (`api.yourdomain.com`).
Cookies: `samesite=none; secure=true; httpOnly=true` — same as today, no regression.

---

## Phased rollout plan

### Phase 1 — Internal auth behind flag (Keycloak still live)

- Implement internal auth backend (Login table, JwtService, new auth endpoints)
- Implement frontend /login page and user management UI
- Both auth paths (Keycloak + internal) exist simultaneously in the codebase
- `INTERNAL_AUTH_ENABLED=false` → system behaves exactly as today
- `INTERNAL_AUTH_ENABLED=true` → routes through new internal auth
- Add unit tests + integration tests
- Toggle flag true in staging, test rigorously

### Phase 2 — Enable flag in production, Keycloak still running

- `INTERNAL_AUTH_ENABLED=true` in production env vars
- Force-reset passwords for all 5-6 users via `/admin/users`
- Monitor for 1-2 weeks with both systems reachable
- If anything breaks: flip flag back to false, Keycloak immediately resumes

### Phase 3 — Drop Keycloak, shift backend to Droplet

- Remove Keycloak env vars, remove KeycloakService, remove flag check (internal is now default)
- `@nestjs/schedule` cron jobs work natively — remove Vercel cron HTTP endpoint workaround
- Deploy NestJS to DigitalOcean Droplet
- Update `NEXT_PUBLIC_API_URL` on Vercel to point to Droplet API domain
- Decommission Keycloak on Droplet
- **Rollback plan:** Keep Vercel backend live for 24h after cutover. If Droplet is broken,
  flip `NEXT_PUBLIC_API_URL` back to Vercel URL in Vercel env vars and investigate.
  Acceptable downtime: ≤1 hour (flip only at late night when users = 0).

### Phase 4 — Infra hardening

- Monitoring: DO built-in alerts + UptimeRobot + SSL cert alert (via UptimeRobot HTTPS + certbot email)
- Health check endpoint `/health` already added in Phase 1

---

## Prisma schema changes

### Email uniqueness strategy

**Problem:** `User.email` has `@unique` which prevents re-using an email after soft-delete.
**Industry standard:** PostgreSQL partial unique index — uniqueness enforced only for active (non-deleted) rows.

In schema.prisma: remove `@unique` from `User.email` and remove `@@index([email])`.
In the migration file (`add_login_table`), add after auto-generated SQL:

```sql
-- Remove full unique index on email (replaced by partial index below)
DROP INDEX IF EXISTS "User_email_key";

-- Enforce uniqueness only for non-deleted users; allows email reuse after soft-delete
CREATE UNIQUE INDEX "User_email_active_unique" ON "User" (email) WHERE "deletedAt" IS NULL;
```

Application behaviour: creating a user with an email belonging to a soft-deleted user succeeds.
Creating a user with an email belonging to an active user → DB constraint → caught as `ConflictException`.

### New: Login table

```prisma
model Login {
  id           String   @id @default(uuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  passwordHash String
  permissions  String[] // per-user permission list; pre-populated from role defaults on creation, editable by admin
  tokenVersion Int      @default(0)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Audit trail
  lastLoginAt         DateTime?
  failedLoginAttempts Int       @default(0)
  lastFailedLoginAt   DateTime?

  @@index([userId])
}
```

**Audit field behaviour:**
- `lastLoginAt` — updated to `now()` on every successful login
- `failedLoginAttempts` — incremented on each failed bcrypt compare; reset to 0 on successful login
- `lastFailedLoginAt` — updated to `now()` on each failed attempt

No account lockout (5-6 users, low risk). Fields exist for audit investigation only.

`permissions` stores the exact permission strings this user has. Role is used for UI routing
and as the default template when creating a user, but runtime enforcement reads from `Login.permissions`.

`tokenVersion` is the session revocation mechanism. Incrementing it invalidates all current
REFRESH_TOKENs for that user (forced re-login on next refresh attempt).

`User` model gets a back-relation added (no other field changes):

```prisma
model User {
  // ... existing fields unchanged ...
  login Login?
}
```

Migration name: `add_login_table`

---

## isActive flag semantics

Two separate `isActive` flags with distinct meanings:

| State | User.isActive | Login.isActive | Behaviour in login() |
|---|---|---|---|
| Normal active user | true | true | Login succeeds |
| Deactivated user | false | true | 401 `{ message: 'Account disabled. Contact administrator.' }` |
| Login locked (maintenance) | true | false | 401 `{ message: 'Login temporarily disabled. Contact administrator.' }` |
| Soft-deleted | n/a | false (cascaded on delete) | 401 (generic, user not found) |

`PATCH /users/:id` with `{ isActive: false }` → sets only `User.isActive = false`.
`Login.isActive` is set only programmatically: to `false` when User is soft-deleted.

`POST /auth/login` checks in order:
1. Find User by email where `deletedAt IS NULL` → 401 generic if not found
2. Check `User.isActive` → 401 "Account disabled" if false
3. Find Login by userId → 401 if missing
4. Check `Login.isActive` → 401 "Login temporarily disabled" if false
5. `bcrypt.compare` → 401 "Invalid credentials" on fail (generic — don't reveal which step failed)

Steps 2 and 4 use specific messages because the cause is admin-controlled, not a wrong password.

### Soft-delete cascade

`DELETE /users/:id` must in a **single Prisma transaction**:
1. Set `User.deletedAt = now()`
2. Set `Login.isActive = false`

`POST /auth/refresh` (internal path) must check `Login.isActive` after tokenVersion
validation. If `Login.isActive = false` → throw `UnauthorizedException`. This prevents
a soft-deleted user with a valid REFRESH_TOKEN from obtaining new ACCESS_TOKENs.

---

## Feature flag mechanism

Two env vars — one per app:

| Env var | Location | Values | Default |
|---|---|---|---|
| `INTERNAL_AUTH_ENABLED` | Backend (.env / Droplet) | `true` / `false` | `false` |
| `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED` | Frontend (Vercel env vars) | `true` / `false` | `false` |

Always flip together. Flip only at late night when active users = 0.

### JWT_SECRET startup validation

In `src/main.ts` AND `src/main.serverless.ts`, before `app.listen()`:

```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET env var is missing or too short (min 32 chars). App cannot start.');
}
```

Fail on startup, not at first sign attempt.

### Backend: flag-switched AuthGuard

```typescript
// auth/guards/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly publicGuard: PublicAuthGuard,
    private readonly keycloakGuard: KeycloakJwtAuthGuard,  // renamed from JwtAuthGuard
    private readonly internalGuard: InternalJwtAuthGuard,  // new
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.publicGuard.canActivate(ctx)) return true;
    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';
    return useInternal
      ? this.internalGuard.canActivate(ctx)
      : this.keycloakGuard.canActivate(ctx);
  }
}
```

### Frontend: flag-switched middleware

```typescript
// src/middleware.ts
if (!accessToken) {
  const isInternal = process.env.NEXT_PUBLIC_INTERNAL_AUTH_ENABLED === 'true';
  const redirectTo = encodeURIComponent(pathname + search);
  const loginUrl = isInternal
    ? `/login?redirectTo=${redirectTo}`
    : `${process.env.NEXT_PUBLIC_API_URL}/auth/login?redirectTo=${redirectTo}`;
  return NextResponse.redirect(new URL(loginUrl, req.url));
}
```

---

## Current auth flow (Keycloak) — for reference

```
1. User visits /admin or /manager route
2. middleware.ts: no ACCESS_TOKEN → redirects to ${API}/auth/login?redirectTo=...
3. GET /auth/login: encodes redirectTo in base64 state, redirects to Keycloak UI
4. Keycloak shows login page, user enters credentials
5. Keycloak redirects → GET /auth/callback?code=...&state=...
6. Backend: exchanges code via KeycloakService.exchangeCode()
7. Backend: sets ACCESS_TOKEN cookie (10 min) + REFRESH_TOKEN cookie (7 days)
8. Backend: redirects to ${FRONT_END_BASE_URL}${redirectTo}
9. AuthProvider: calls GET /auth/me → { id, alternateEmail, permissions[], user }
10. Any 401 → api.service.ts calls POST /auth/refresh → retries → if fails → logout
```

---

## New auth flow (internal) — same UX, no Keycloak

```
1. User visits /admin or /manager route
2. middleware.ts: no ACCESS_TOKEN → redirects to /login?redirectTo=... (own page)
3. Frontend /login page: email + password form
4. User submits → POST /auth/login { email, password }
5. Backend: validate isActive flags (see isActive semantics section); bcrypt.compare
6. Backend: update lastLoginAt / failedLoginAttempts
7. Backend: read login.permissions[] directly (per-user list stored in Login table)
8. Backend: sign ACCESS_TOKEN JWT (15 min, HS256) + REFRESH_TOKEN JWT (7 days, HS256)
9. Backend: set ACCESS_TOKEN + REFRESH_TOKEN cookies (same names, same config as today)
10. Backend: return { ok: true }
11. Frontend: router.push(searchParams.get('redirectTo') ?? '/')
12. AuthProvider: calls GET /auth/me → same response shape as today (no frontend change)
13. Any 401 → api.service.ts calls POST /auth/refresh
    → backend verifies REFRESH_TOKEN + checks Login.isActive + checks tokenVersion
    → if valid: reads fresh Login.permissions from DB, issues new ACCESS_TOKEN cookie
    → if invalid/expired/revoked/inactive: 401 → frontend logs out → redirects to /login
```

JWT validation: local HS256 verify with `JWT_SECRET` (no HTTP call, instant).
Logout: increments `Login.tokenVersion` + clears both cookies (invalidates all other sessions).

### JWT payload

```
ACCESS_TOKEN: {
  sub: login.userId,
  email: user.email,
  permissions: login.permissions[],
  tokenVersion: login.tokenVersion,
  iss: 'skyprints',
  aud: 'skyprints-api'
}

REFRESH_TOKEN: {
  sub: login.userId,
  tokenVersion: login.tokenVersion,
  iss: 'skyprints',
  aud: 'skyprints-api'
}
```

`iss` and `aud` validated on every verify call. Wrong service or wrong `JWT_SECRET` → verification fails.

### Password validation

Defined as a shared Zod schema in `@app/contracts`:

```typescript
export const PasswordSchema = z.string()
  .min(3, 'Password must be at least 3 characters')
  .refine(s => /[a-zA-Z]/.test(s), { message: 'Password must contain at least one letter' });
```

Applied to: `POST /users` (initial password), `POST /users/:id/reset-password`.

---

## Session revocation

**Mechanism:** `Login.tokenVersion` (int, starts at 0).

1. Admin clicks "Revoke Session" → `POST /users/:id/revoke-session`
2. Backend: `prisma.login.update({ where: { userId: id }, data: { tokenVersion: { increment: 1 } } })`
3. Current ACCESS_TOKEN remains valid until expiry (~15 min). Accepted risk.
4. On `POST /auth/refresh`:
   - Verify REFRESH_TOKEN signature + `iss`/`aud`
   - Check `Login.isActive` → 401 if false
   - Compare `decoded.tokenVersion !== login.tokenVersion` → 401 if mismatch
   - Read fresh `login.permissions` from DB
   - Issue new ACCESS_TOKEN
5. `api.service.ts` refresh fails → `logout()` → cookies cleared → redirect to `/login`

**Concurrent sessions (multiple devices):** All devices share the same `tokenVersion`.
Revocation invalidates ALL devices simultaneously on their next refresh attempt.

**Logout also revokes all sessions:** `POST /auth/logout` (internal path):
1. Increment `Login.tokenVersion` (invalidates any stolen/lingering REFRESH_TOKENs)
2. Clear `ACCESS_TOKEN` and `REFRESH_TOKEN` cookies on the calling browser

**Self-modification guards:**
- `POST /users/:id/revoke-session`: if `req.user.id === params.id` → `ForbiddenException('You cannot revoke your own session')`
- `PATCH /users/:id/permissions`: if `req.user.id === params.id` → `ForbiddenException('You cannot modify your own permissions')`

---

## Permissions system

`PermissionsGuard`, `@Permissions()` decorator, `req.user.permissions[]` shape — all unchanged.

**Permissions on refresh:** `refreshInternal()` always re-reads `Login.permissions` from DB
when issuing a new ACCESS_TOKEN. Permission changes take effect within 15 min (one ACCESS_TOKEN
cycle) even without full logout, since `PATCH /users/:id/permissions` also increments
`tokenVersion` which forces a refresh on next cycle.

**Role change does NOT update permissions:** `PATCH /users/:id` with `{ role: 'MANAGER' }`
changes only `User.role`. `Login.permissions` stays as-is. Admin uses "Load role defaults"
button in the permissions editor to reset to role defaults.

### Role → Permissions map (default template — not runtime source of truth)

Define in `apps/backend/src/auth/permissions.map.ts`. Used **only** when creating a new user.

```typescript
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'orders:view', 'orders:create', 'orders:create-test', 'orders:update',
    'orders:delete', 'orders:reorder', 'orders:start-production',
    'process:view', 'process:create', 'process:update', 'process:delete',
    'runs:view', 'runs:create', 'runs:delete', 'runs:update',
    'runs:lifecycle:rollback', 'runs:lifecycle:update',
    'runs:transition:digital', 'runs:transition:fusing',
    'rates:view', 'rates:create', 'rates:update', 'rates:delete',
    'billings:view', 'billings:create', 'billings:create-test',
    'billings:update', 'billings:delete',
    'customers:view', 'customers:create', 'customers:update', 'customers:delete',
    'analytics:view', 'analytics:sync',
    'users:view', 'users:create', 'users:update', 'users:delete',
    'locations:view', 'locations:create', 'locations:update', 'locations:delete',
    'locations:all:view', 'settings:view',
  ],
  MANAGER: [
    'orders:view', 'orders:create', 'orders:update', 'orders:reorder',
    'orders:start-production',
    'process:view',
    'runs:view', 'runs:create', 'runs:update',
    'runs:lifecycle:update', 'runs:transition:digital', 'runs:transition:fusing',
    'rates:view',
    'billings:view', 'billings:create', 'billings:update',
    'customers:view',
    'analytics:view',
    'locations:view',
  ],
  OPERATOR: [
    'runs:view', 'runs:update', 'runs:lifecycle:update',
    'orders:view',
    'process:view',
  ],
};

// Used to validate permission strings in PATCH /users/:id/permissions
export const ALL_PERMISSIONS = Array.from(
  new Set(Object.values(ROLE_PERMISSIONS).flat())
).sort();
```

---

## Backend — files to create / modify / delete

### Phase 1: Create (new files)

**`auth/jwt/internal-jwt.service.ts`**
Sign and verify HS256 JWTs using `@nestjs/jwt`.
Methods: `signAccessToken(payload)`, `signRefreshToken(payload)`, `verifyAccessToken(token)`,
`verifyRefreshToken(token)`. All include `iss`/`aud` validation.

**`auth/guards/internal-jwt-auth.guard.ts`**
- Extracts token from `ACCESS_TOKEN` cookie or `Authorization: Bearer` header
- Calls `internalJwtService.verifyAccessToken(token)` — validates `iss` and `aud`
- Attaches `{ id: decoded.sub, email: decoded.email, permissions: decoded.permissions }` to `req.user` and `RequestContextStore`

**`auth/permissions.map.ts`**
`ROLE_PERMISSIONS` map + `ALL_PERMISSIONS` array (see above).

**`users/users.module.ts`**, **`users/users.service.ts`**, **`users/users.controller.ts`**
New module for user management (see User Management section).

### Phase 1: Modify (existing files)

**`auth/guards/jwt-auth.guard.ts`**
Rename to `auth/guards/keycloak-jwt-auth.guard.ts`, class to `KeycloakJwtAuthGuard`.
No logic changes.

**`auth/guards/auth.guard.ts`**
Add `InternalJwtAuthGuard` injection + flag dispatch (see Feature Flag section).

**`auth/auth.controller.ts`**

- Keep `GET /auth/login` — unchanged (Keycloak path, flag=false)
- Keep `GET /auth/callback` — fix open redirect (validate `redirectTo` starts with `/` not `//`) + fix CSRF (add nonce cookie on GET, verify on callback)
- Add `POST /auth/login @Public()` — internal login. Returns 503 if `INTERNAL_AUTH_ENABLED=false`
- Modify `POST /auth/refresh @Public()` — dispatch on flag:
  - flag=true: `authService.refreshInternal(refreshToken, res, req)`
  - flag=false: `keycloakService.refresh(refreshToken)` as today
- Modify `POST /auth/logout @Public()` — dispatch on flag:
  - flag=true: `authService.logoutInternal(req.user.id, res, req)` (increments tokenVersion + clears cookies)
  - flag=false: Keycloak end-session + clear cookies as today
- Keep `GET /auth/me` — unchanged
- Keep `POST /auth/preferences` — unchanged
- Add `GET /health @Public()` — `{ status: 'ok', timestamp: new Date().toISOString() }`

**`auth/auth.service.ts`**

Add `login(email, password, res, req)`:
1. Find User by email where `deletedAt IS NULL` → 401 if not found
2. Check `User.isActive` → 401 "Account disabled. Contact administrator." if false
3. Find Login by userId → 401 if missing
4. Check `Login.isActive` → 401 "Login temporarily disabled. Contact administrator." if false
5. `bcrypt.compare` → on fail: increment `failedLoginAttempts`, update `lastFailedLoginAt`, throw 401 "Invalid credentials"
6. On success: reset `failedLoginAttempts = 0`, set `lastLoginAt = now()`
7. Sign both JWTs with `iss`/`aud` claims
8. `setAuthCookies(res, tokens, req)`

Add `refreshInternal(refreshToken, res, req)`:
1. `verifyRefreshToken(refreshToken)` — validates `iss`/`aud`
2. Load Login from DB (include `User.isActive`)
3. Check `Login.isActive` → 401 if false
4. Compare `decoded.tokenVersion !== login.tokenVersion` → 401 if mismatch
5. Read fresh `login.permissions` from DB
6. Sign new ACCESS_TOKEN with fresh permissions
7. `setAccessCookie(res, newToken, req)`

Add `logoutInternal(userId, res, req)`:
1. `prisma.login.update({ where: { userId }, data: { tokenVersion: { increment: 1 } } })`
2. `clearCookies(res, req)`

Add `revokeSession(userId)`:
`prisma.login.update({ where: { userId }, data: { tokenVersion: { increment: 1 } } })`

Fix cookie security defaults in `cookie-domain.util.ts`:
```typescript
httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',  // was: === 'true'
secure:   process.env.COOKIE_SECURE !== 'false',      // was: === 'true'
```

Fix ACCESS_TOKEN TTL: `10 * 60` → `15 * 60` (10 min → 15 min, consistent with spec).

Delete dead code: `resolveCookieDomain()` function and its comment.

**`auth/auth.module.ts`**
Add `JwtModule.register(...)`, `InternalJwtAuthGuard`, `InternalJwtService`.
Keep Keycloak providers. Remove them in Phase 3.

**`src/main.ts`** and **`src/main.serverless.ts`**
Add JWT_SECRET startup validation.

**`app.module.ts`**
Add `UsersModule` to imports.

### Phase 3: Delete (after Keycloak is dropped)

- `auth/keycloak/keycloak.service.ts`
- `auth/keycloak/keycloak.types.ts`
- `auth/jwt/jwks.provider.ts`
- `auth/guards/keycloak-jwt-auth.guard.ts`
- Remove all flag checks (`INTERNAL_AUTH_ENABLED` — internal is now the only mode)
- Remove `GET /auth/login` (Keycloak redirect) and `GET /auth/callback`
- Remove `jwks-rsa` package
- Remove all `KEYCLOAK_*` and `JWKS_URI` env vars

---

## User Management module (new in Phase 1)

### Backend: `src/users/`

**Endpoints:**

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/users` | `users:view` | List all users |
| GET | `/users/me` | *(authenticated, no permission required)* | Own profile + permissions from DB |
| GET | `/users/:id` | `users:view` | Single user detail including permissions[] |
| POST | `/users` | `users:create` | Create User + Login; permissions from role default if not supplied |
| PATCH | `/users/:id` | `users:update` | Update name, role, locationId, isActive |
| PATCH | `/users/:id/permissions` | `users:update` | Replace permission set; increments tokenVersion. Cannot target self. |
| DELETE | `/users/:id` | `users:delete` | Soft-delete: sets deletedAt + Login.isActive=false in transaction |
| POST | `/users/:id/revoke-session` | `users:update` | Increment tokenVersion. Cannot target self. |
| POST | `/users/:id/reset-password` | `users:update` | Admin sets new password; increments tokenVersion |

**`GET /users/me`** — available to all authenticated users (no special permission).
Returns: `{ id, name, email, role, location, isActive, permissions[], lastLoginAt }`.
Reads `Login.permissions` from DB directly — always fresh (not from JWT).
This is how any non-admin user sees their own current permission set.

**Contracts in `@app/contracts`:**

```typescript
export const PasswordSchema = z.string()
  .min(3, 'Password must be at least 3 characters')
  .refine(s => /[a-zA-Z]/.test(s), { message: 'Password must contain at least one letter' });

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']),
  locationId: z.string().uuid().optional(),
  password: PasswordSchema,
  permissions: z.array(z.string()).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']).optional(),
  locationId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.string()), // [] is valid — removes all permissions
});

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
});
```

**`POST /users` implementation:**
1. Validate body with `CreateUserSchema`
2. If `locationId`: `prisma.location.findUnique({ where: { id: locationId, isActive: true } })` → `BadRequestException('Invalid or inactive locationId')` if not found
3. Prisma transaction: create User + Login. `Login.permissions` = body.permissions ?? `ROLE_PERMISSIONS[role]`
4. DB partial unique index enforces email uniqueness for active users → catch constraint error as `ConflictException('Email already in use')`

**`PATCH /users/:id/permissions` implementation:**
1. If `req.user.id === params.id` → `ForbiddenException('You cannot modify your own permissions')`
2. Validate all permission strings in `ALL_PERMISSIONS` → `BadRequestException('Unknown permission: X')` if any invalid
3. Update `Login.permissions`, increment `tokenVersion`

**`DELETE /users/:id` implementation:**
Single Prisma transaction: set `User.deletedAt = now()` + set `Login.isActive = false`

**`POST /users/:id/revoke-session` implementation:**
1. If `req.user.id === params.id` → `ForbiddenException('You cannot revoke your own session')`
2. Increment `Login.tokenVersion`

**`POST /users/:id/reset-password` implementation:**
`bcrypt.hash(password, BCRYPT_ROUNDS)` → update `Login.passwordHash` + increment `tokenVersion`

### Frontend: `/admin/users` (new in Phase 1)

Route: `src/app/admin/users/page.tsx` — already behind ADMIN RoleGuard.

**UI sections:**

1. **User list table** — Name, Email, Role, Location, Status, Permissions count, Actions
2. **Create user** → modal: name, email, role, location, password + permissions checklist
   (pre-checked by selected role; admin customises before saving)
3. **Row actions** per user:
   - Edit details (name, role, location, isActive toggle)
   - Edit permissions → drawer with checklist + "Load role defaults" button
     Note: "Changes take effect on the user's next login or token refresh."
   - Reset password (admin sets directly)
   - Revoke session (confirmation → `POST /users/:id/revoke-session`). Button disabled for self.
   - Delete (soft-delete, confirmation)

**Permissions grouping in checklist UI:**

```
Orders       [ ] view  [ ] create  [ ] update  [ ] delete  [ ] reorder  [ ] start-production  [ ] create-test
Processes    [ ] view  [ ] create  [ ] update  [ ] delete
Runs         [ ] view  [ ] create  [ ] update  [ ] delete  [ ] lifecycle:update  [ ] lifecycle:rollback  [ ] transition:digital  [ ] transition:fusing
Billing      [ ] view  [ ] create  [ ] update  [ ] delete  [ ] create-test
Customers    [ ] view  [ ] create  [ ] update  [ ] delete
Rates        [ ] view  [ ] create  [ ] update  [ ] delete
Analytics    [ ] view  [ ] sync
Users        [ ] view  [ ] create  [ ] update  [ ] delete
Locations    [ ] view  [ ] create  [ ] update  [ ] delete  [ ] all:view
Settings     [ ] view
```

Add `usersService.ts` in `src/services/` following the same `apiRequest` pattern.

---

## Password migration from Keycloak

Keycloak hashes (PBKDF2) incompatible with bcrypt. Do not attempt hash porting.

Steps during Phase 2 cutover:
1. Seed Login records for all users with a temporary `passwordHash` via seed script
2. Admin communicates temp passwords to each user (5-6 people, ~10 min task)
3. Flip `INTERNAL_AUTH_ENABLED=true`
4. Users log in with temp password

No forced password-change flow. Admin is the password authority for this system.

---

## Environment variables

### Phase 1/2: Add

```
INTERNAL_AUTH_ENABLED=false
JWT_SECRET                        # min 32 chars: openssl rand -hex 64
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
BCRYPT_ROUNDS=10
```

Frontend (Vercel):
```
NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=false
```

### Phase 3: Remove

```
KEYCLOAK_TOKEN_URL, KEYCLOAK_AUTH_URL, KEYCLOAK_LOGOUT_URL
KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET
JWKS_URI, TOKEN_ISSUER, TOKEN_AUDIENCE
APP_BASE_URL
INTERNAL_AUTH_ENABLED
NEXT_PUBLIC_INTERNAL_AUTH_ENABLED
```

### Keep unchanged (all phases)

```
DATABASE_URL
FRONT_END_BASE_URL
COOKIE_HTTP_ONLY, COOKIE_SECURE, COOKIE_SAMESITE, COOKIE_DOMAIN, COOKIE_PATH
CRON_SECRET, IMAGE_RETENTION_SECRET
ORDER_RETENTION_ENABLED, ORDER_RETENTION_CRON, ORDER_RETENTION_DAYS
JOBS_ENABLED, MAX_ORDERS_PER_RUN, PORT
```

---

## Known issues fixed in this migration

| Issue | Fix | Phase |
|---|---|---|
| Open redirect in `/auth/callback` | Add `safeRedirect()` validation | Phase 1 |
| No CSRF nonce in OAuth state | Add nonce cookie on GET /auth/login, verify on callback | Phase 1 |
| Cookie defaults insecure when env var unset | Change `=== 'true'` to `!== 'false'` in `cookie-domain.util.ts` | Phase 1 |
| `resolveCookieDomain()` dead code | Delete function and comment | Phase 1 |
| `getMe` returns `roles` misnamed | Already fixed (B7) | Done |
| `/auth/preferences` no schema validation | Already fixed | Done |

---

## Testing plan

All tests in `apps/backend/src/` with `.spec.ts` suffix. Use `@nestjs/testing` + real test DB.

### Unit tests

**`auth/auth.service.spec.ts`**
- `login()`: success; wrong password (failedLoginAttempts incremented); user not found; User.isActive=false ("Account disabled"); Login.isActive=false ("Login temporarily disabled"); Login record missing
- `login()`: success after prior failures → failedLoginAttempts reset to 0, lastLoginAt updated
- `refreshInternal()`: valid token + matching tokenVersion + Login.isActive=true → new ACCESS_TOKEN with fresh DB permissions
- `refreshInternal()`: stale tokenVersion → 401; Login.isActive=false → 401; expired token; wrong iss/aud
- `refreshInternal()`: permissions in new ACCESS_TOKEN come from DB, not old token payload
- `logoutInternal()`: tokenVersion incremented + cookies cleared
- `revokeSession()`: increments tokenVersion; idempotent on repeat calls
- `setAuthCookies()`: ACCESS_TOKEN TTL = 15 min; cookie flags correct
- `clearCookies()`: both cookies cleared

**`auth/jwt/internal-jwt.service.spec.ts`**
- `signAccessToken()`: correct claims (sub, email, permissions, tokenVersion, iss, aud)
- `signRefreshToken()`: correct claims (sub, tokenVersion, iss, aud)
- `verifyAccessToken()`: valid pass; expired throws; wrong secret throws; tampered throws; wrong iss throws; wrong aud throws
- `verifyRefreshToken()`: same cases

**`auth/guards/internal-jwt-auth.guard.spec.ts`**
- Cookie token: valid → req.user populated; invalid → 401
- Authorization header: valid → req.user populated
- No token → 401
- `req.user` shape: `{ id, email, permissions[] }`

**`auth/guards/auth.guard.spec.ts`** (flag switching)
- `INTERNAL_AUTH_ENABLED=false` → delegates to KeycloakJwtAuthGuard
- `INTERNAL_AUTH_ENABLED=true` → delegates to InternalJwtAuthGuard
- `@Public()` endpoint → always allowed regardless of flag

**`auth/guards/permissions.guard.spec.ts`**
- No `@Permissions()` → always allowed
- User has permission → allowed
- User missing permission → 403
- User has partial match → 403

**`users/users.service.spec.ts`**
- `create()` with explicit permissions → Login.permissions matches
- `create()` without permissions → defaults to ROLE_PERMISSIONS[role]
- `create()` duplicate email (active) → ConflictException
- `create()` email of soft-deleted user → succeeds
- `create()` invalid locationId → BadRequestException
- `create()` inactive locationId → BadRequestException
- `create()` → User + Login in single transaction (atomic)
- `update()` → name, role, locationId, isActive updated correctly
- `update()` role change → Login.permissions unchanged
- `updatePermissions()` → permissions updated, tokenVersion incremented
- `updatePermissions()` unknown string → BadRequestException
- `updatePermissions()` empty array → allowed
- `updatePermissions()` self-targeting → ForbiddenException
- `softDelete()` → User.deletedAt set + Login.isActive=false in same transaction
- `revokeSession()` → tokenVersion incremented; idempotent
- `revokeSession()` self-targeting → ForbiddenException
- `resetPassword()` → passwordHash updated + tokenVersion incremented
- `getMe()` → returns Login.permissions from DB (not from request context)

### Integration tests

**`auth/auth.integration.spec.ts`** (flag=true)
- Login → GET /auth/me: permissions matches Login.permissions exactly
- Login → JWT has per-user permissions (not role-derived)
- Wrong password → 401; failedLoginAttempts incremented
- User.isActive=false → 401 "Account disabled"
- Login.isActive=false → 401 "Login temporarily disabled"
- Soft-deleted user → 401
- POST /auth/refresh: valid token → new ACCESS_TOKEN, permissions from DB
- POST /auth/refresh after revokeSession → 401
- POST /auth/refresh after logoutInternal → 401 (tokenVersion incremented by logout)
- POST /auth/refresh with Login.isActive=false → 401
- POST /auth/logout → tokenVersion incremented → cookies cleared → GET /auth/me → 401
- POST /auth/logout → old REFRESH_TOKEN rejected on next refresh → 401
- GET /auth/me without cookie → 401
- GET /health → 200 (no auth required)
- POST /auth/login with flag=false → 503

**`auth/auth.flag.integration.spec.ts`**
- flag=false: GET /auth/login redirects to Keycloak URL
- flag=false: POST /auth/login → 503
- flag=true: POST /auth/login with valid credentials → 200
- Keycloak RS256 token rejected when flag=true

**`auth/concurrent-session.integration.spec.ts`**
- Login from Device A and Device B → both REFRESH_TOKENs tokenVersion=0
- Both can independently refresh → get ACCESS_TOKENs
- Admin revokes → tokenVersion → 1
- Device A next refresh → 401
- Device B next refresh → 401
- User re-logs in from Device A (tokenVersion=1 in new REFRESH_TOKEN) → refresh succeeds
- Device B old REFRESH_TOKEN (tokenVersion=0) → still 401

**`auth/permissions.integration.spec.ts`**
- User with `orders:create` → POST /orders → 201
- User without `orders:create` → POST /orders → 403 (even if role=MANAGER)
- Two users same role different permissions → different access results
- PATCH /users/:id/permissions → next refresh → new permissions in ACCESS_TOKEN
- `@Public()` endpoints accessible regardless of permission list
- User with [] permissions → can login, GET /auth/me succeeds, all protected → 403

**`users/users.integration.spec.ts`**
- ADMIN can CRUD users
- Non-ADMIN without `users:create` → POST /users → 403
- Create without permissions → Login.permissions = ROLE_PERMISSIONS[role]
- Create with custom permissions → Login.permissions matches
- Create with invalid locationId → 400
- PATCH /users/:id role change → Login.permissions unchanged
- PATCH /users/:id/permissions → permissions updated, tokenVersion incremented
- PATCH /users/:id/permissions unknown string → 400
- PATCH /users/:id/permissions [] → user has no permissions
- PATCH /users/:id/permissions self → 403
- GET /users/me → returns DB permissions (fresh, not from JWT)
- Reset password → tokenVersion incremented → old REFRESH_TOKEN rejected
- Revoke session → next refresh → 401
- Revoke session self → 403
- Soft-delete → Login.isActive=false → login → 401; refresh → 401
- Create user with soft-deleted email → 201

### Running tests

```bash
npm test --workspace apps/backend
npx jest apps/backend/src/auth/auth.service.spec.ts  # single file
```

---

## Database migration strategy

| Environment | DB | When |
|---|---|---|
| Local dev | Local PostgreSQL | Always |
| UAT | Separate DB (`skyprints_uat`) | Phase 1 onwards |
| Production | Hosted PostgreSQL | Phase 2 cutover |

```bash
# Development
npx prisma migrate dev --name add_login_table   # from apps/backend/

# UAT / Production (never use migrate dev)
npx prisma migrate deploy
```

After generating the migration file, manually add the partial unique index SQL (see Email
uniqueness section). Commit the edited migration file.

### Seed script (`apps/backend/prisma/seeds/seed-login-records.ts`)

1. Read all active users (isActive=true, deletedAt=null)
2. Skip if Login record already exists (idempotent — safe to re-run)
3. Create Login with hashed temp password + `ROLE_PERMISSIONS[user.role]`

Run: `npx ts-node prisma/seeds/seed-login-records.ts`

---

## Prisma connection management on Droplet

No code changes needed. NestJS `PrismaService` singleton creates a persistent connection
pool appropriate for a long-running Node process. Moving from Vercel serverless (new pool
per cold start) to Droplet (persistent pool) actually improves connection management.
The flag-based approach requires no Prisma changes between phases.

---

## CI/CD — auto-deploy

### Frontend (Vercel) — unchanged

### Backend (Vercel, Phase 1-2) — unchanged

Add to `apps/backend/package.json`:
```json
"vercel-build": "prisma generate && prisma migrate deploy && nest build"
```

### Backend (DigitalOcean Droplet, Phase 3)

`build:backend` exists in root `package.json` (confirmed). CI/CD workflows:

**`.github/workflows/deploy-backend-uat.yml`** (triggers on push to `develop`)
```yaml
name: Deploy Backend — UAT
on:
  push:
    branches: [develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.UAT_DROPLET_HOST }}
          username: ${{ secrets.UAT_DROPLET_USER }}
          key: ${{ secrets.UAT_DROPLET_SSH_KEY }}
          script: |
            cd /opt/skyprints
            git pull origin develop
            npm ci --workspace apps/backend
            npm run build:backend
            DATABASE_URL=${{ secrets.UAT_DATABASE_URL }} npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
            pm2 reload skyprints-api-uat --update-env
```

**`.github/workflows/deploy-backend-prod.yml`** (triggers on push to `main`)
```yaml
name: Deploy Backend — Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_DROPLET_HOST }}
          username: ${{ secrets.PROD_DROPLET_USER }}
          key: ${{ secrets.PROD_DROPLET_SSH_KEY }}
          script: |
            cd /opt/skyprints
            git pull origin main
            npm ci --workspace apps/backend
            npm run build:backend
            DATABASE_URL=${{ secrets.PROD_DATABASE_URL }} npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
            pm2 reload skyprints-api --update-env
```

Exactly two workflow files for two environments. (Earlier spec draft incorrectly referenced
a third file `deploy-backend.yml` — corrected.)

### Required GitHub secrets

| Secret | Used by |
|---|---|
| `UAT_DROPLET_HOST/USER/SSH_KEY` | UAT workflow |
| `UAT_DATABASE_URL` | UAT migration |
| `PROD_DROPLET_HOST/USER/SSH_KEY` | Prod workflow |
| `PROD_DATABASE_URL` | Prod migration |

---

## DigitalOcean Droplet setup (Phase 3)

### nginx config

```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location /api/v1/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### PM2 ecosystem file (`apps/backend/ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: 'skyprints-api',
    script: 'dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: { NODE_ENV: 'production', PORT: 3001 },
  }],
};
```

### PM2 log rotation (Phase 3 — not deferred to Phase 4)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### SSL

```bash
# --email required for renewal failure notifications
certbot --nginx -d api.yourdomain.com --email your@email.com --agree-tos
# Auto-renews via certbot systemd timer; failure emails sent to --email address
```

### Startup on reboot

```bash
pm2 startup
pm2 save
```

---

## Phase 4 monitoring (free)

1. Enable DO CPU/RAM email alerts (zero config, DO dashboard)
2. Add UptimeRobot HTTPS monitor on `GET /health` — covers both downtime AND SSL cert expiry
3. Certbot email alerts configured at cert issuance (Step 1 above)

Skip Grafana/Prometheus until a specific need arises.

---

## npm packages

### Add to `apps/backend`

```
@nestjs/jwt
bcrypt
@types/bcrypt
```

### Remove (Phase 3)

```
jwks-rsa
```

---

## What does NOT change

- `PermissionsGuard`, `@Permissions()`, `@CurrentUser()` — no changes
- `RequestContextStore` — shape unchanged
- `GET /auth/me` response shape — unchanged
- `AuthProvider.tsx` — role routing logic unchanged
- `api.service.ts` — auto-refresh on 401 flow unchanged
- `Permission` enum in frontend — all permission strings unchanged
- Cookie names — `ACCESS_TOKEN`, `REFRESH_TOKEN` unchanged
- All other backend modules — untouched
- Hosted PostgreSQL, Cloudflare R2 — untouched
- Frontend Vercel deployment — untouched

## Out-of-scope (explicit decisions)

- **MFA:** Out of scope
- **Email-based password reset:** Out of scope; admin resets directly
- **Self-service password change:** Out of scope; admin is password authority
- **Session listing:** Out of scope; admin can revoke, users cannot list sessions
- **Account lockout after N failures:** Out of scope; `failedLoginAttempts` tracked for audit only

---

## Phase 3 cutover checklist

**Pre-cutover (infra)**
- [ ] Node 20 installed on Droplet
- [ ] nginx configured with rate limiting on /auth/login
- [ ] SSL cert issued via certbot (with `--email` flag)
- [ ] PM2 installed, `ecosystem.config.js` in place, `pm2 startup` + `pm2 save` run
- [ ] PM2 log rotation configured (pm2-logrotate)
- [ ] GitHub Actions secrets set
- [ ] UAT CI/CD workflow tested successfully

**Database**
- [ ] UAT DB: Login table + partial unique index on User.email (migration applied)
- [ ] Login records seeded for all UAT users, permissions verified
- [ ] Prod DB migration dry-run verified

**Code readiness**
- [ ] All unit + integration tests passing (including concurrent session tests)
- [ ] `INTERNAL_AUTH_ENABLED=true` on UAT for ≥1 week without issues
- [ ] All 3 roles tested on UAT
- [ ] Per-user permission editing tested: change → re-login → enforced
- [ ] Session revocation tested: revoke → refresh → 401 → /login
- [ ] Logout tested: logout → old REFRESH_TOKEN → 401
- [ ] GET /users/me tested for MANAGER and OPERATOR roles
- [ ] Seed script run and verified on UAT

**Production cutover (late night, users = 0)**
1. [ ] Merge `develop` → `main` → CI/CD deploys to Droplet + runs migration
2. [ ] Run Login seed script against prod DB
3. [ ] Flip `INTERNAL_AUTH_ENABLED=true` in Droplet env → `pm2 reload --update-env`
4. [ ] Flip `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=true` in Vercel → redeploy frontend
5. [ ] Test: login → /admin/users → permissions → verify
6. [ ] Communicate temp passwords to all users
7. [ ] Monitor 30 min: logs, `/health`, DO metrics
8. [ ] Stop Keycloak

**Rollback (if needed, ≤1h window)**
- Set `NEXT_PUBLIC_API_URL` back to Vercel backend URL → redeploy frontend
- Keep Vercel backend live 24h post-cutover for this purpose

**Post-cutover**
- [ ] `NEXT_PUBLIC_API_URL` points to Droplet
- [ ] DO CPU/RAM alerts enabled
- [ ] UptimeRobot HTTPS monitor on `/health`
- [ ] `deploy-backend-prod.yml` confirmed triggering on `main` push
- [ ] Vercel backend decommissioned after 24h
