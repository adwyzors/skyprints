# Auth Migration: Implementation Plan

**Companion to:** `auth-migration-internal.md`
**Branch:** `feature/internal-auth`

This file tracks exact implementation order per phase, and what must be verified after
each phase before proceeding.

---

## Phase 1 — Internal auth behind flag

**Goal:** Full internal auth implemented and tested. Keycloak still live. System behaves
identically to today when `INTERNAL_AUTH_ENABLED=false`.

### 1.1 — Install packages (backend)

```bash
npm install --workspace apps/backend @nestjs/jwt bcrypt
npm install --workspace apps/backend --save-dev @types/bcrypt
```

### 1.2 — Prisma schema changes

In `apps/backend/prisma/schema.prisma`:

1. Add `Login` model (with audit fields: `lastLoginAt`, `failedLoginAttempts`, `lastFailedLoginAt`)
2. Add `login Login?` back-relation to `User` model
3. Remove `@unique` from `User.email`
4. Remove `@@index([email])` from `User` model

Generate and edit the migration:

```bash
cd apps/backend
npx prisma migrate dev --name add_login_table
```

Then **manually edit** the generated migration file to add:
```sql
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_email_active_unique" ON "User" (email) WHERE "deletedAt" IS NULL;
```

Then: `npx prisma generate`

### 1.3 — Startup validation

Add to `src/main.ts` and `src/main.serverless.ts` (both files):
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET env var is missing or too short (min 32 chars). App cannot start.');
}
```

### 1.4 — Contracts package

In `apps/packages/contracts/src/`:

1. Create `auth/password.schema.ts` — `PasswordSchema`
2. Create `users/create-user.contract.ts` — `CreateUserSchema`
3. Create `users/update-user.contract.ts` — `UpdateUserSchema`
4. Create `users/update-permissions.contract.ts` — `UpdatePermissionsSchema`
5. Create `users/reset-password.contract.ts` — `ResetPasswordSchema`
6. Re-export all from `src/index.ts`
7. Run `npm run build:contracts`

### 1.5 — `auth/permissions.map.ts`

Create `apps/backend/src/auth/permissions.map.ts` with `ROLE_PERMISSIONS` and `ALL_PERMISSIONS`.

### 1.6 — `auth/jwt/internal-jwt.service.ts`

Create the service. Methods: `signAccessToken`, `signRefreshToken`, `verifyAccessToken`,
`verifyRefreshToken`. Include `iss: 'skyprints'`, `aud: 'skyprints-api'` in all tokens.
Use env vars `JWT_ACCESS_EXPIRES` and `JWT_REFRESH_EXPIRES`.

### 1.7 — `auth/guards/internal-jwt-auth.guard.ts`

Create the guard. Extract from `ACCESS_TOKEN` cookie or `Authorization: Bearer` header.
Call `verifyAccessToken`. Attach `{ id: decoded.sub, email, permissions }` to `req.user`
and `RequestContextStore`.

### 1.8 — Rename existing JWT guard

Rename `auth/guards/jwt-auth.guard.ts` → `auth/guards/keycloak-jwt-auth.guard.ts`.
Rename class `JwtAuthGuard` → `KeycloakJwtAuthGuard`. Update all imports.

### 1.9 — Fix `cookie-domain.util.ts`

- Change `httpOnly: process.env.COOKIE_HTTP_ONLY === 'true'` → `!== 'false'`
- Change `secure: process.env.COOKIE_SECURE === 'true'` → `!== 'false'`
- Delete `resolveCookieDomain()` function and its comment
- Fix ACCESS_TOKEN TTL in `auth.service.ts`: `10 * 60` → `15 * 60`

### 1.10 — Update `auth/auth.service.ts`

Add methods: `login()`, `refreshInternal()`, `logoutInternal()`, `revokeSession()`.
See spec for full implementation details of each method.

### 1.11 — Update `auth/auth.controller.ts`

- Fix open redirect in `GET /auth/callback` (safeRedirect validation)
- Fix CSRF nonce: add nonce cookie on `GET /auth/login`, verify on `GET /auth/callback`
- Add `POST /auth/login @Public()`
- Modify `POST /auth/refresh` — dispatch on flag
- Modify `POST /auth/logout` — dispatch on flag
- Add `GET /health @Public()`

### 1.12 — Update `auth/guards/auth.guard.ts`

Inject `InternalJwtAuthGuard` alongside `KeycloakJwtAuthGuard`. Add flag dispatch.

### 1.13 — Update `auth/auth.module.ts`

Register `JwtModule`, `InternalJwtService`, `InternalJwtAuthGuard`. Keep Keycloak providers.

### 1.14 — Create `users/` module

In order:
1. `users/users.service.ts` — all CRUD + self-modification guards
2. `users/users.controller.ts` — all endpoints including `GET /users/me`
3. `users/users.module.ts`
4. Register `UsersModule` in `app.module.ts`

### 1.15 — Frontend: `usersService.ts`

Create `apps/frontend/src/services/usersService.ts` following existing `apiRequest` pattern.
Endpoints: list, getById, create, update, updatePermissions, delete, revokeSession, resetPassword.

### 1.16 — Frontend: `/login` page

Create `apps/frontend/src/app/login/page.tsx`.
Email + password form → `POST /auth/login` → `router.push(redirectTo ?? '/')`.
On error: display error message. No redirect to Keycloak.

### 1.17 — Frontend: `/admin/users` page

Create `apps/frontend/src/app/admin/users/page.tsx`.
User list table + create modal + row actions (edit, permissions drawer, reset password,
revoke session, delete). Permissions checklist grouped by domain. "Load role defaults" button.

### 1.18 — Frontend: update `middleware.ts`

Add flag-based redirect: if `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=true` → redirect to `/login`,
else → redirect to Keycloak login URL.

### 1.19 — Seed script

Create `apps/backend/prisma/seeds/seed-login-records.ts`.
Reads all active users, skips existing Login records, creates Login with hashed temp password
and `ROLE_PERMISSIONS[user.role]`.

---

## Phase 1 — Verification checklist

Run all tests, then manually verify each of the following before proceeding to Phase 2.

### Automated tests (must all pass)

```bash
npm test --workspace apps/backend
```

Expected: all unit + integration tests green (auth.service, jwt.service, guards,
users.service, auth.integration, auth.flag.integration, concurrent-session.integration,
permissions.integration, users.integration).

### Manual verification (flag=false — Keycloak path unchanged)

- [ ] `INTERNAL_AUTH_ENABLED=false` (default) — existing Keycloak login flow works end-to-end
- [ ] `POST /auth/login` returns 503 when flag=false
- [ ] All existing pages load correctly (orders, runs, billing, etc.)
- [ ] `GET /health` returns `{ status: 'ok' }` without auth

### Manual verification (flag=true — internal auth path)

- [ ] `/login` page renders correctly
- [ ] Login with valid credentials → redirected to home → pages load
- [ ] Login with wrong password → error message shown
- [ ] `GET /auth/me` response: `{ id, alternateEmail, permissions[], user }` — same shape
- [ ] ADMIN role sees `/admin/users` page
- [ ] Create user (all 3 roles) → Login record created in DB
- [ ] Edit user permissions → re-login → new permissions enforced (try with/without access)
- [ ] `GET /users/me` returns fresh permissions for OPERATOR and MANAGER users
- [ ] Revoke session → within 15 min → forced to /login on next action
- [ ] Logout → re-login required → old REFRESH_TOKEN rejected
- [ ] Session revocation of self → button disabled in UI, 403 from API
- [ ] Soft-delete user → that user cannot login (401)
- [ ] Reset password → old REFRESH_TOKEN rejected after next refresh

### Cookie security check

- [ ] ACCESS_TOKEN cookie: `httpOnly=true`, `secure=true`, `samesite=none`, TTL ~15 min
- [ ] REFRESH_TOKEN cookie: `httpOnly=true`, `secure=true`, `samesite=none`, TTL ~7 days

---

## Phase 2 — Enable flag in production

**Prerequisite:** Phase 1 verification complete. All tests passing. Flag=true stable on
UAT for ≥1 week.

### 2.1 — Run seed script on UAT DB

```bash
DATABASE_URL=<uat-db-url> npx ts-node prisma/seeds/seed-login-records.ts
```

Verify: all active users have Login records with correct permissions.

### 2.2 — Flip flags (UAT → then production)

**UAT first:**
1. Set `INTERNAL_AUTH_ENABLED=true` in UAT env
2. Set `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=true` in Vercel (UAT environment)
3. Run full Phase 1 manual verification on UAT

**Production (after ≥1 week UAT validation):**
1. Set `INTERNAL_AUTH_ENABLED=true` in production env
2. Set `NEXT_PUBLIC_INTERNAL_AUTH_ENABLED=true` in Vercel (production)

### 2.3 — Force password reset for all 5-6 users

Admin uses `/admin/users` → "Reset password" for each user. Communicate temp passwords.

### 2.4 — Monitor (1–2 weeks)

Watch: logs for 401 spikes, `/health` endpoint, user complaints.
If anything breaks: flip both flags back to `false` → Keycloak immediately resumes.

---

## Phase 2 — Verification checklist

### After flag flip in production

- [ ] Each of the 5-6 users can log in with temp password
- [ ] All roles (ADMIN, MANAGER, OPERATOR) can access their respective pages
- [ ] Permission enforcement correct per user
- [ ] Keycloak still running (not yet decommissioned)
- [ ] No unexpected 401s in logs
- [ ] `GET /health` returning 200

### After 1–2 weeks stable

- [ ] No production incidents related to auth
- [ ] All users reporting normal access
- [ ] Ready to proceed to Phase 3

---

## Phase 3 — Drop Keycloak, shift backend to Droplet

**Prerequisite:** Phase 2 stable for ≥1 week. All Phase 3 infra ready.

### 3.1 — Infra setup (do before code changes)

On DigitalOcean Droplet:

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2

# nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# SSL cert (--email required for failure alerts)
sudo certbot --nginx -d api.yourdomain.com --email your@email.com --agree-tos

# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# nginx rate limiting config (see spec)
# Edit /etc/nginx/sites-available/skyprints

pm2 startup    # generates systemd unit — run the printed command
```

Create GitHub Actions secrets: `PROD_DROPLET_HOST`, `PROD_DROPLET_USER`,
`PROD_DROPLET_SSH_KEY`, `PROD_DATABASE_URL` (and UAT equivalents).

### 3.2 — Code: remove Keycloak

1. Delete: `auth/keycloak/keycloak.service.ts`, `keycloak.types.ts`, `auth/jwt/jwks.provider.ts`,
   `auth/guards/keycloak-jwt-auth.guard.ts`
2. Uninstall: `npm uninstall --workspace apps/backend jwks-rsa`
3. Remove flag checks: `auth.guard.ts` → always use `InternalJwtAuthGuard`
4. Remove flag-dispatch from `auth.controller.ts` → internal paths only
5. Delete `GET /auth/login` (Keycloak redirect) and `GET /auth/callback`
6. Remove all `KEYCLOAK_*`, `JWKS_URI`, `TOKEN_ISSUER`, `TOKEN_AUDIENCE`, `APP_BASE_URL`
   from `.env.example` and docs
7. Remove `INTERNAL_AUTH_ENABLED` flag entirely — internal is now permanent
8. Update `auth.module.ts` to remove Keycloak providers + JwksProvider

### 3.3 — Code: native cron jobs

Replace Vercel cron HTTP endpoint workaround with `@nestjs/schedule` decorators.
(Scope: whatever cron jobs currently exist — check existing `CRON_SECRET` usage.)

### 3.4 — CI/CD workflow files

Create `.github/workflows/deploy-backend-uat.yml` and `.github/workflows/deploy-backend-prod.yml`
(see spec for full YAML). Commit to feature branch.

### 3.5 — Add `ecosystem.config.js`

Create `apps/backend/ecosystem.config.js` (see spec).

### 3.6 — Add `vercel-build` script

In `apps/backend/package.json`:
```json
"vercel-build": "prisma generate && prisma migrate deploy && nest build"
```

### 3.7 — Cutover (late night, users = 0)

Follow Phase 3 cutover checklist in `auth-migration-internal.md` exactly.

---

## Phase 3 — Verification checklist

### Immediately after cutover

- [ ] Droplet: `pm2 status` shows `skyprints-api` online
- [ ] `GET https://api.yourdomain.com/api/v1/health` → 200
- [ ] Login flow works end-to-end from production frontend
- [ ] All 3 roles can access their pages
- [ ] nginx rate limiting on `/auth/login` active (verify with `curl` spam → 429)
- [ ] SSL cert valid (HTTPS works, no browser warnings)
- [ ] Keycloak stopped after successful verification

### 24h post-cutover

- [ ] Vercel backend decommissioned (or kept as read-only for another week — your call)
- [ ] DO CPU/RAM alerts enabled
- [ ] UptimeRobot HTTPS monitor on `GET /health` configured
- [ ] `deploy-backend-prod.yml` triggers successfully on test push to `main`
- [ ] `deploy-backend-uat.yml` triggers successfully on test push to `develop`

### nginx rate limit test

```bash
# Should get 429 after 5 rapid requests from same IP
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.yourdomain.com/api/v1/auth/login; done
```

---

## Phase 4 — Infra hardening

### 4.1 — DO CPU/RAM email alerts

In DigitalOcean dashboard: Monitoring → Alerts → Create alert for CPU >80% and Memory >80%.
Email: your@email.com.

### 4.2 — UptimeRobot

1. Create account at uptimerobot.com
2. Add monitor: HTTPS, `https://api.yourdomain.com/api/v1/health`, interval 5 min
3. Alert contacts: email
4. UptimeRobot HTTPS monitors automatically check SSL cert validity and alert before expiry

### Phase 4 — Verification checklist

- [ ] DO alert fires on simulated CPU spike (or verify settings visually)
- [ ] UptimeRobot shows monitor as "UP"
- [ ] UptimeRobot shows SSL cert expiry date (confirms HTTPS cert check is active)
- [ ] PM2 log rotation: `pm2 logs` shows rotated files, none exceed 10M

---

## Merge strategy

```
feature/internal-auth
  ↓ PR to develop (after Phase 1 verification)
develop
  ↓ auto-deploy to UAT
  ↓ [Phase 2: flip flags in UAT, validate ≥1 week]
  ↓ PR to main (after Phase 2 UAT validation)
main
  ↓ auto-deploy to prod (Phase 2 production flag flip)
  ↓ [Phase 3 code changes go on new branch: feature/keycloak-removal]
feature/keycloak-removal
  ↓ PR to develop → UAT → main → Phase 3 cutover
```

Keep Keycloak removal (Phase 3 code) as a separate PR from Phase 1 (internal auth
implementation). This keeps diffs reviewable.
