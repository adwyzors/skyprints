# Auth — internal JWT flow, security notes, known issues

Keycloak has been fully removed (Phase 3 of the auth migration). Auth is now a self-hosted
`bcrypt` + JWT scheme backed by the `Login` table.

## Flow overview

```
Browser → POST /auth/login { username, password } (backend, @Public)
        → AuthService.login: look up Login by username, fall back to User.email,
          bcrypt.compare password, check User.isActive + Login.isActive
        → Set ACCESS_TOKEN (15 min) + REFRESH_TOKEN (7 days) cookies, keyed by
          loginIndex for multi-account support (ACCESS_TOKEN_1, REFRESH_TOKEN_2, ...)

Frontend 401 → POST /auth/refresh (sends REFRESH_TOKEN_<index> cookie)
             → AuthService.refreshInternal: verifies refresh token, checks tokenVersion
               against Login.tokenVersion, re-reads permissions from DB, issues a fresh
               ACCESS_TOKEN
             → On failure → POST /auth/logout → clear cookies at that index

POST /auth/logout       → AuthService.logoutInternal: bumps Login.tokenVersion (invalidates
                           all other sessions using that account), clears cookies at index
POST /auth/logout-all   → revokes every account index present in cookies (up to 5)
GET  /auth/profiles     → lists which account indices have a live session (for the
                           multi-account switcher)
POST /auth/switch       → flips active_account_index cookie to another already-logged-in index

GET /auth/me  → returns { id, alternateEmail, permissions[], user } — reads fresh from DB,
                not just the JWT
GET /users/me → same idea, available without users:view permission
```

## JWT validation

`InternalJwtAuthGuard` (`auth/guards/internal-jwt-auth.guard.ts`) verifies the token via
`InternalJwtService` (`auth/jwt/internal-jwt.service.ts`, HS256, secret = `JWT_SECRET`).
Tokens carry `iss: 'skyprints'`, `aud: 'skyprints-api'`. Token extracted from the
`ACCESS_TOKEN[_index]` cookie or `Authorization: Bearer` header. `AuthGuard`
(`auth/guards/auth.guard.ts`) is the single `APP_GUARD`: it lets `@Public()` routes through,
otherwise delegates straight to `InternalJwtAuthGuard`. `PermissionsGuard` runs after it and
checks `req.user.permissions` against `@Permissions(...)` / `@AnyPermissions(...)` metadata.

## Cookie config env vars

All cookie security settings come from env vars — ensure production values are set correctly:

| Var | Production value | Risk if wrong |
|---|---|---|
| `COOKIE_HTTP_ONLY` | `true` (default; only `'false'` disables) | Cookies readable by JS → XSS token theft |
| `COOKIE_SECURE` | `true` (default; only `'false'` disables) | Cookies sent over HTTP → interception |
| `COOKIE_SAMESITE` | `none` (frontend and backend are cross-site — Vercel frontend, DO-hosted API) | CSRF exposure / cookies silently dropped cross-site |
| `COOKIE_DOMAIN` | unset (cross-site cookies can't share a domain anyway) | — |

`cookieOptions()` in `auth/utils/cookie-domain.util.ts` already defaults `httpOnly`/`secure`
to `true` unless explicitly set to `'false'`.

## Known issues — fix before next auth change

### `JWT_SECRET` rotation has no grace period
Rotating `JWT_SECRET` invalidates every live session instantly (all `ACCESS_TOKEN`s fail
verification, all `REFRESH_TOKEN`s fail verification) — there's no dual-secret window. Fine
for the current ~5-6 user scale; would need a `JWT_SECRET_PREVIOUS` fallback if that changes.

### `GET /users/me` vs `GET /auth/me` overlap
Two endpoints return overlapping user data by different shapes. Not a bug, but worth
consolidating if a third consumer shows up.

## Adding new protected endpoints

```typescript
@Get('resource')
@Permissions(Permission.RESOURCE_VIEW)  // import from @app/contracts or local enum
async getResource() { ... }
```

Simultaneously add the permission string to `apps/frontend/src/auth/permissions.ts`
`Permission` enum.

## Rate limiting

`/auth/login` is rate-limited at the nginx layer on the DigitalOcean droplet
(`limit_req_zone` in `/etc/nginx/conf.d/skyprints-ratelimit.conf`, enforced in the
`skyprints-api` nginx site) — there is no in-app rate limiting on the login endpoint.
