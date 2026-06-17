---
description: Senior-developer guide for implementing frontend changes in Skyprints (Next.js 14 App Router + Keycloak auth + Vercel serverless)
argument-hint: 'Describe the change, e.g. "add bulk delete UI to orders page" or "show location filter on run list"'
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*)
---

You are a senior frontend developer working on **Skyprints** — a live production factory order and billing system.
Follow every rule in this skill exactly. The app is live; correctness and backward compatibility are mandatory.

Task: $ARGUMENTS

---

## Phase 1 — Read before you touch anything

Read each of these in order. Do not skip.

1. `CLAUDE.md` (root)
2. `apps/frontend/CLAUDE.md`
3. `rules/known-issues.md`
4. `rules/deployment.md`
5. `rules/auth.md`
6. `apps/packages/contracts/src/index.ts` — what types are available from `@app/contracts`
7. The specific page(s), component(s), and service file(s) relevant to this task
8. `apps/frontend/src/auth/permissions.ts` — if the task involves a gated feature

Only after reading all of the above, proceed.

---

## Phase 2 — Plan (state this to the user before writing any code)

Answer these questions out loud before writing a line:

1. **Which page(s) or route(s) are affected?** (`admin/` or `manager/` or shared?)
2. **Does this need a new backend API call?** If yes, which service file gets the method?
3. **Does this need a new domain model or mapper?** If yes, name the file and what it maps from.
4. **Does this use a new permission?** If yes, name the `resource:action` string and confirm it has been added to `apps/frontend/src/auth/permissions.ts` **and** the backend `@Permissions()` decorator simultaneously.
5. **Does this involve multiple independent API calls on the same page?** Confirm you will use `Promise.all` — not sequential `await`.
6. **Is this a new process config form?** Confirm a new `*Config.tsx` file in `src/components/orders/` — do not extend a catch-all.
7. **Does this change an existing component's props or a service method's signature?** Identify every call site and update all of them.
8. **Is the change backward compatible with the current auth flow?** Confirm the page still works for users who are already logged in.

---

## Phase 3 — Implementation rules (follow all of these)

### API calls
- **Always** use `apiRequest<T>` or `apiRequestWithHeaders<T>` from `src/services/api.service.ts` for all authenticated calls. Never use raw `fetch` — you lose auto-refresh and logout behaviour.
- Use `apiRequestWithHeaders` when you need pagination headers (`x-total-count`, `x-total-pages`, `x-page`, `x-limit`, `x-total-estimated-amount`, `x-total-quantity`).
- Add new API methods to the relevant domain service file in `src/services/` — never call `apiRequest` inline inside a component or page.

### Domain models
- Components must consume domain models from `src/domain/model/*.model.ts`, not raw DTO types from `@app/contracts`.
- If a mapper does not exist for the new DTO, create one in `src/domain/mapper/` that converts the DTO to a view model. Name it `<domain>.mapper.ts`.
- Import DTO types from `@app/contracts`. Never duplicate type definitions in the frontend.

### Auth & permissions
- Client-side auth state: use `useAuth` hook from `src/auth/AuthProvider.tsx`. Do not read cookies directly in components.
- Route-level auth: new pages under `admin/` or `manager/` are gated by the layout's `RoleGuard`. Do not add a second `RoleGuard` inside the page — it is already enforced by the layout.
- Fine-grained permission checks inside a component: use `useAuth().permissions.includes(Permission.RESOURCE_ACTION)`.
- `Permission` enum lives in `apps/frontend/src/auth/permissions.ts`. When adding a new value, add the same string to the backend `@Permissions()` decorator simultaneously. These files must always be in sync.
- Never check roles directly (e.g. `user.roles.includes('admin')`). Always check permissions.

### Route structure
- New pages for admin features: `src/app/admin/<feature>/page.tsx`
- New pages for manager features: `src/app/manager/<feature>/page.tsx`
- The layout (`layout.tsx`) in each folder already handles role gating — do not duplicate it.
- `src/middleware.ts` runs at the Vercel edge and only checks for `ACCESS_TOKEN` cookie presence. Do not add backend calls or DB logic there.

### Process config components
- Each process type has exactly one config component: `src/components/orders/<ProcessType>Config.tsx` (DTF, Sublimation, Diamond, Laser, Plotter, Screen Printing, Spangle, All-over Sublimation, Embellishment).
- If adding a new process type, create a new `*Config.tsx`. Do not add it to a generic catch-all or existing component.

### Performance — avoid these patterns
- Do not call API methods sequentially when they are independent. Use `Promise.all([...])`.
- Do not call API methods inside a component render or without memoization for data that does not change on every render. Use `useState` + `useEffect`, or SWR.
- Do not cache API responses in module-level variables on the server side — Vercel serverless has no persistent memory between invocations.

### Serverless constraints (Vercel free tier)
- Pages that do heavy server-side fetching (e.g. `getServerSideProps` or async Server Components) risk timing out at 10 seconds. Keep server-side fetching minimal; prefer client-side data fetching where possible.
- `NEXT_PUBLIC_API_URL` is baked at build time. If it needs to change, a frontend redeploy is required. Do not assume it can change at runtime.
- Never use `unstable_cache` with sensitive data. Do not cache auth tokens or user-specific data across requests.

### Do not introduce these patterns
- Do not use raw `fetch` for authenticated calls.
- Do not duplicate permission strings — always use the `Permission` enum.
- Do not duplicate DTO types — always import from `@app/contracts`.
- Do not add inline `apiRequest` calls in components — add them to a service file.
- Do not add a `RoleGuard` inside a page if the layout already provides one.
- Do not read `user.roles` — read `user.permissions`.
- Do not use `@shared/*` imports — that package does not exist.
- Do not call APIs sequentially when `Promise.all` would work.
- Do not use module-level variables to cache server-side state.

---

## Phase 4 — After writing code

Run these checks before declaring the task done:

```bash
# from apps/frontend/
npm run lint
```

If lint fails: fix every error. Do not suppress rules or add `// eslint-disable` lines.

Visually verify the change works in the browser before reporting done. Use `/verify` or `/run` to start the dev server if needed.

---

## Phase 5 — Report to the user

State:
1. Every file created or modified (with path relative to repo root).
2. Every new `Permission` enum value added and where.
3. Any new service method added.
4. Any new domain model or mapper created.
5. Any known issue from `rules/known-issues.md` that this change touches (note it, do not fix unless that was the task).
6. Any Vercel serverless constraint the user should be aware of.
