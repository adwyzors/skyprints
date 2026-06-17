# Auth — Keycloak flow, security notes, known issues

## Flow overview

```
Browser → GET /auth/login (backend, @Public)
       → Redirect to Keycloak /auth with state=base64(redirectTo)
       → Keycloak → GET /auth/callback?code=...&state=... (backend, @Public)
       → Exchange code for tokens (KeycloakService.exchangeCode)
       → Set ACCESS_TOKEN (10 min) + REFRESH_TOKEN (7 days) cookies
       → Redirect to ${FRONT_END_BASE_URL}${redirectTo}

Frontend 401 → POST /auth/refresh (sends REFRESH_TOKEN cookie)
             → New ACCESS_TOKEN cookie set
             → On failure → POST /auth/logout → clear cookies

GET /auth/me → returns { id, user, roles: permissions[] }
             → checks user is active and not soft-deleted in DB
```

## JWT validation

`JwtAuthGuard` validates via JWKS (Keycloak's public key endpoint). Provider: `auth/jwt/jwks.provider.ts`. Keys are cached for 10 min (`cacheMaxAge`). Algorithm pinned to RS256. Checks `TOKEN_ISSUER` and `TOKEN_AUDIENCE` env vars + 5 s clock tolerance. Token extracted from `ACCESS_TOKEN` cookie or `Authorization: Bearer` header.

## Cookie config env vars

All cookie security settings come from env vars — ensure production values are set correctly:

| Var | Production value | Risk if wrong |
|---|---|---|
| `COOKIE_HTTP_ONLY` | `true` | Cookies readable by JS → XSS token theft |
| `COOKIE_SECURE` | `true` | Cookies sent over HTTP → interception |
| `COOKIE_SAMESITE` | `none` (cross-site) or `lax` | CSRF exposure |
| `COOKIE_DOMAIN` | `.yourdomain.com` | Cookies not shared across subdomains |

## Known security issues — fix before next auth change

### 1. No `redirectTo` origin validation (open redirect risk)
`/auth/callback` decodes `state` and redirects to `${FRONT_END_BASE_URL}${redirectTo}`. If `redirectTo` is `//evil.com/path`, most browsers treat `https://yourapp.com//evil.com/path` as a redirect to `evil.com`. **Fix:** validate that `redirectTo` starts with `/` and does not start with `//` before using it.

```typescript
// Add this to auth.controller.ts callback before res.redirect
const safeRedirect = (path: string) =>
  path.startsWith('/') && !path.startsWith('//') ? path : '/';
redirectTo = safeRedirect(redirectTo);
```

### 2. No CSRF nonce in OAuth state
State is just `base64(JSON({ redirectTo }))` — no random nonce. A malicious page can craft a login URL with a forged state. **Fix:** add a random nonce to state and verify it (store in a short-lived cookie during login, compare on callback).

### 3. Cookie security defaults to env var — missing values = insecure
`cookieOptions` returns `httpOnly: process.env.COOKIE_HTTP_ONLY === "true"` — if the var is unset, defaults to `false`. This should default to `true` and be overridable only to `false` for dev. **Fix:**

```typescript
httpOnly: process.env.COOKIE_HTTP_ONLY !== "false",   // default true
secure:   process.env.COOKIE_SECURE !== "false",       // default true
```

### 4. `/auth/preferences` — no schema validation
`updatePreferences` accepts raw `req.body` without any Zod or class-validator schema. Any key/value can be written to the `preferences` JSON field. **Fix:** define a contract in `@app/contracts` and validate against it.

### 5. `getMe` returns `roles` but contains permissions
`auth.service.ts` `getMe` returns `{ roles: authUser.permissions }` — the field is misnamed. The frontend reads `roles` and treats them as permissions, which works but is confusing. **Fix:** rename to `permissions` in both backend response and frontend consumer.

## Adding new protected endpoints

```typescript
@Get('resource')
@Permissions(Permission.RESOURCE_VIEW)  // import from @app/contracts or local enum
async getResource() { ... }
```

Simultaneously add the permission string to `apps/frontend/src/auth/permissions.ts` `Permission` enum.

## Dead code

`resolveCookieDomain()` in `auth/utils/cookie-domain.util.ts` is exported but never called — the call site in `auth.service.ts` is commented out. It can be removed.
