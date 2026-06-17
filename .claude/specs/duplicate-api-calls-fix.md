# Spec: Duplicate API Calls Fix

## Overview

On page reload, three pages make duplicate API calls: the Run Activity page (`/admin/runs`), the Orders page (`/admin/orders`), and the Reports page (`/admin/reports`). All are pure frontend performance bugs — no server changes needed. The first two share the same root cause (URL-defaulting init effect cascading into extra data-fetch runs); the reports page has a related but independent double-mount fetch caused by a `debouncedSearch` effect initialising with an empty value. The fix eliminates all cascading re-runs while preserving existing filter, pagination, and URL-sync behaviour.

## Scope

- **In scope:**
  - Fix duplicate `getRuns` calls on `/admin/runs` (Run Activity page)
  - Fix duplicate `getOrderCards` calls on `/admin/orders` (Orders page)
  - Fix duplicate `getBilledOrdersReport` calls on `/admin/reports` (Reports page)
  - Fix the URL-defaulting init effect running multiple times per page load on runs and orders
  - Guard data-fetch effects so they skip stale runs caused by init-effect cascades

- **Out of scope:**
  - Adding debounce/SWR/caching layer
  - Fixing unrelated known issues (B1–B10, F1–F4)
  - Any backend changes
  - The `getLocations()` and `getProcessLifecycleStatuses()` calls on the runs page (already stable `[]` / `[filters.processId]` deps)

## Depends on

No feature dependencies. The pages and auth layer already exist.

## Contract changes (`@app/contracts`)

No contract changes.

## Backend changes (`apps/backend`)

None.

## Frontend changes (`apps/frontend`)

### Root cause analysis

**`apps/frontend/src/app/admin/runs/page.tsx`** (and orders page — same pattern):

There are three `useEffect` calls in `RunsPageContent` / `AdminOrdersContent` that interact badly:

1. **Init effect** — runs to apply URL defaults (`status`, `limit`, location) via `router.replace()`. Its dep array includes `searchParams.toString()`. When `router.replace()` fires, the URL changes → `searchParams.toString()` changes → **the init effect re-fires**. On that second run `changed = false` so no further navigation, but the re-run is still a wasted render.
2. **`filters` useMemo** — deps include `searchParams.toString()`. Each URL change (even the one caused by the init effect setting defaults) creates a **new `filters` object reference**, even when filter *values* haven't changed.
3. **Data fetch effect** — depends on `filters`. Because `filters` is a new object reference after the URL-defaults are applied, the data fetch fires a second time even though the actual filter values are identical to what was used for the first fetch.

Result on reload: data fetch fires → (300 ms debounce) → init effect applies URL defaults → URL changes → `filters` gets a new reference → data fetch fires again. The debounce window is often not enough to cancel the first fetch, so two full API calls go out.

### Files to modify

#### `apps/frontend/src/app/admin/runs/page.tsx`

**Change 1 — init effect runs only once per mount**

Add `const hasInitializedRef = useRef(false)` near the top of `RunsPageContent`.

In the init effect (currently `useEffect(fn, [user, hasPermission, searchParams.toString(), pathname, router])`):

- At the very top of the effect body, add: `if (hasInitializedRef.current) return; hasInitializedRef.current = true;`
- Remove `searchParams.toString()` from the dependency array (the effect reads `searchParams` via closure at call time, so reading inside the effect is still correct on first run; subsequent URL changes must not re-trigger it).
- New dep array: `[user, hasPermission, pathname, router]`

This makes the init effect run exactly once after the component mounts with a valid user (guaranteed by `withAuth`). It will never re-fire due to URL changes it itself caused.

**Change 2 — data fetch effect guards on initialization**

Add `const isMountedRef = useRef(false)` (a ref, not state, to avoid extra renders).

At the start of the data fetch effect body:

```ts
if (!isMountedRef.current) return;
```

Set `isMountedRef.current = true` at the end of the init effect body (after applying defaults or deciding not to).

This ensures the first data fetch does not fire until the init effect has had a chance to apply URL defaults. The data fetch then fires exactly once with the final, initialized URL params.

**Note:** The existing `cancelled` ref + 300 ms `setTimeout` debounce is correct and should be kept — it handles rapid user-initiated filter changes.

#### `apps/frontend/src/app/admin/orders/page.tsx`

Apply the same two changes as above:

- `hasInitializedRef` to make the init effect idempotent.
- `isMountedRef` (replacing the existing `isMounted` state which was already trying to solve this, but the data-fetch effect never checked it and the state-based approach causes an extra render).

Remove `isMounted` state and its `setIsMounted(true)` call. Replace the SSR guard (`if (!isMounted) return null`) with `if (!isMountedRef.current) return null` — same behaviour, no extra state render.

#### `apps/frontend/src/app/admin/reports/page.tsx`

**Root cause — different from runs/orders**

The reports page does not have a URL-defaulting init effect. Its bug is in the interaction between two effects:

1. The component initialises `query` state as `{ ..., page: 1, limit: 20 }` (no `search` key).
2. A `useEffect(() => { setQuery(prev => ({ ...prev, search: debouncedSearch, page: 1 })); }, [debouncedSearch])` fires on mount with `debouncedSearch = ''`, adding `search: ''` to the query object.
3. Setting state creates a **new `query` object reference**, which triggers the data fetch effect `useEffect(() => { fetchData(); }, [query])` a second time — even though the search value is empty and the result would be identical.

Result: on every page load, `getBilledOrdersReport` is called twice within milliseconds of each other.

**Fix**

Skip the `setQuery` call when `debouncedSearch` is empty and there is no existing `search` in the current query (i.e., no-op on initial mount):

In the `debouncedSearch` sync effect, add an early return:
```ts
useEffect(() => {
    if (!debouncedSearch && !query.search) return;
    setQuery(prev => ({ ...prev, search: debouncedSearch || undefined, page: 1 }));
}, [debouncedSearch]);
```

This stops the spurious initial `setQuery` call when both the new and current search values are empty, eliminating the double fetch on mount. User-initiated searches (non-empty string) are unaffected.

**Note:** The `query` dep in `useEffect(() => { fetchData(); }, [query])` should also be replaced with individual stable deps to avoid other accidental re-fires in future, but that is a larger refactor. The targeted fix above is sufficient to eliminate the duplicate call.

### New service methods

None.

## Files to create / modify

```
apps/frontend/src/app/admin/runs/page.tsx     — init effect run-once guard + data fetch init guard
apps/frontend/src/app/admin/orders/page.tsx   — init effect run-once guard + data fetch init guard
apps/frontend/src/app/admin/reports/page.tsx  — skip no-op setQuery on initial mount
```

No other files.

## New dependencies

No new dependencies.

## Vercel constraints to check

No serverless concerns. All changes are client-side React hooks — no server functions touched.

## Implementation rules for this feature

- All status transitions must go through `DynamicWorkflowEngine.validateTransition()`
- New endpoints must use `@Permissions('resource:action')` — add the string to `Permission` enum in frontend simultaneously
- Use `PrismaService.transaction()` for multi-step writes; update denormalized counters in the same transaction
- Decimal arithmetic must use `billing/utils/money.ts`; never use native `number` for money
- All frontend API calls must go through `apiRequest` / `apiRequestWithHeaders` — never raw `fetch`
- After editing `apps/packages/contracts/src/`, run `npm run build:contracts`
- Do not change behaviour of existing endpoints without explicit approval — project is live in production
- **Feature-specific:** The 300 ms debounce and `cancelled` ref pattern in data fetch effects must be preserved — it handles rapid user filter changes correctly
- **Feature-specific:** `hasInitializedRef.current` must be set inside the init effect body (not outside) so it fires only after the effect actually runs, not on the render where the component mounts

## Definition of done

- [ ] Reload `/admin/runs` → exactly **one** `GET /runs` request is made (verified in browser DevTools Network tab)
- [ ] Reload `/admin/orders` → exactly **one** `GET /orders` request is made
- [ ] Reload `/admin/reports` → exactly **one** `GET /reports/billed-orders` request is made
- [ ] Applying a filter (e.g., changing status pill or date range) after load still triggers a new fetch on all three pages
- [ ] Changing page or page size still triggers a new fetch on all three pages
- [ ] Typing in the search box on `/admin/reports` still triggers a debounced fetch (search still works)
- [ ] URL defaults (`status`, `limit`) are still applied on fresh load with no URL params on `/admin/runs` and `/admin/orders`
- [ ] Location restriction for non-global-view users is still enforced in the URL on load (behaviour unchanged)
- [ ] The SSR guard (returns `null` during SSR) still works on orders page — no hydration errors in console
- [ ] The manager `/manager/runs` page is unaffected
