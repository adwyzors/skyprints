# Spec: Mobile UI Consistency

## Overview

This feature audits every screen in the Skyprints frontend and makes them fully usable on small screens (≥ 360 px) while keeping the desktop experience unchanged. The primary users are admin staff and managers who access the app on phones between shifts. All changes are purely frontend CSS/layout — no backend routes, no contract changes, and no new data models are involved.

## Scope

**In scope:**
- Filter sidebars (Orders, Billing, Bills, Completed, Reports, Runs) — convert from inline squeeze to overlay drawer on mobile
- Large multi-panel modals (BillingModal, ViewOrderModal, ViewRunModal, ManagerRunModal, CompletedOrderModal) — stack panels vertically on mobile instead of side-by-side
- Reports page header — make search always visible (currently `hidden lg:flex`)
- Dashboard revenue chart — period-picker buttons must wrap instead of overflowing
- Settings page — reduce outer padding on mobile (`p-4 md:p-8`)
- Dashboard Reports `hidden sm:flex` stats in the header — show on mobile
- Consistent bottom padding (`pb-24 md:pb-6`) for pages where the page's own scroll container cuts off the admin bottom nav area
- ConfigurationModal — ensure full-screen on mobile

**Out of scope:**
- Customers / Locations table → mobile card view (table with `overflow-x-auto` is acceptable; card view is a separate enhancement)
- Dashboard WorkflowLifecycleMatrix sticky-column header (complex table, horizontal scroll is acceptable)
- Manager layout route (`/manager/*`) — no bottom-nav on those pages; existing layout is fine
- Any backend, contract, or auth changes

## Depends on

No other feature dependency. Existing layouts, auth, and navigation are in place.

## Contract changes (`@app/contracts`)

No contract changes.

## Backend changes (`apps/backend`)

No backend changes.

## Frontend changes (`apps/frontend`)

### New shared component

**`src/components/layout/FilterDrawer.tsx`** — wraps any filter panel. On `md+` it renders as an inline left sidebar (current behaviour); on `< md` it renders as a fixed overlay drawer (slides in from left) with a semi-transparent backdrop. Props: `open: boolean`, `onClose: () => void`, `children: React.ReactNode`. Used in every page that currently has a manual `w-72 / w-0` sidebar.

### Pages and components to modify

| File | Change |
|------|--------|
| `src/app/admin/orders/page.tsx` | Replace manual sidebar div with `<FilterDrawer>` |
| `src/app/admin/billing/page.tsx` | Replace manual sidebar div with `<FilterDrawer>` |
| `src/app/admin/bills/page.tsx` | Replace manual sidebar div with `<FilterDrawer>` |
| `src/app/admin/completed/page.tsx` | Replace manual sidebar div with `<FilterDrawer>` |
| `src/app/admin/reports/page.tsx` | Replace manual sidebar div with `<FilterDrawer>`; unhide search on mobile |
| `src/app/admin/runs/page.tsx` | Replace manual sidebar div with `<FilterDrawer>` |
| `src/app/admin/settings/page.tsx` | Change outer container `p-8` → `p-4 md:p-8`; add `pb-24 md:pb-6` |
| `src/components/modals/BillingModal.tsx` | On mobile: make outer container `inset-0 rounded-none p-0` (full-screen); stack left summary + right content using tab controls (`sm:flex-row flex-col`) |
| `src/components/modals/ViewOrderModal.tsx` | On mobile: full-screen; replace `w-1/3 / w-2/3` flex-row with mobile tab: "Details" / "Runs" |
| `src/components/modals/ViewRunModal.tsx` | On mobile: full-screen; replace two-panel flex-row with stacked or tab layout |
| `src/components/modals/ManagerRunModal.tsx` | On mobile: full-screen; stack panels |
| `src/components/modals/CompletedOrderModal.tsx` | On mobile: full-screen |
| `src/components/modals/ConfigurationModal.tsx` | On mobile: full-screen (`inset-0 sm:inset-auto sm:p-4`) |
| `src/app/admin/dashboard/DashboardClient.tsx` | Period picker: add `flex-wrap gap-y-1` to button row; unhide stats strip on all screens |
| `src/app/admin/reports/page.tsx` | Bottom padding `pb-24 md:pb-6` on the inner scrollable content div |
| `src/app/admin/bills/page.tsx` | Bottom padding `pb-24 md:pb-6` on the inner scrollable content div |

### FilterDrawer detailed behaviour

```
Mobile (< md):
  - Rendered as `fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl
    transform transition-transform duration-300`
  - When `open=false`: `translate-x-[-100%]`
  - When `open=true`: `translate-x-0`
  - Backdrop: `fixed inset-0 bg-black/30 z-40` shown when open, tapping closes drawer

Desktop (md+):
  - Rendered as `relative flex-shrink-0 bg-white border-r border-gray-200
    transition-all duration-300 overflow-y-auto scrollbar-hide`
  - When `open=false`: `w-0 opacity-0 overflow-hidden pointer-events-none`
  - When `open=true`:  `w-72 opacity-100`
  - No backdrop
```

### Large modal mobile pattern

All multi-panel modals (`BillingModal`, `ViewOrderModal`, `ViewRunModal`, `ManagerRunModal`, `CompletedOrderModal`) use this pattern:

```
Desktop (sm+): existing two-panel flex-row layout unchanged

Mobile (< sm):
  - Outer wrapper: `fixed inset-0 z-50` (no padding, no border-radius)
  - Inner container: `flex flex-col h-full w-full`
  - Tab bar at top: two tabs ("Summary" / "Details" or equivalent label pair)
  - Only one panel visible at a time; tab state is local useState
  - Close button always visible in the tab bar header
```

Use Tailwind's `sm:` prefix to gate the desktop layout — modals with `max-w-5xl / max-w-6xl / max-w-7xl` are unaffected on sm+.

### Reports search fix

Current:
```tsx
<div className="hidden lg:flex items-center relative ml-4">
  <Search ... />
  <input ... />
</div>
```

Replacement: Remove `hidden lg:flex`, move the search input below the page title on mobile using a `flex-col sm:flex-row` wrapper so it's always visible.

### Dashboard period picker fix

Current:
```tsx
<div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
  {PERIODS.map(...)}
</div>
```

Change to `flex flex-wrap items-center gap-1` so the buttons wrap on narrow screens.

## Files to create / modify

**New files:**
- `apps/frontend/src/components/layout/FilterDrawer.tsx`

**Modified files (frontend only):**
- `apps/frontend/src/app/admin/orders/page.tsx`
- `apps/frontend/src/app/admin/billing/page.tsx`
- `apps/frontend/src/app/admin/bills/page.tsx`
- `apps/frontend/src/app/admin/completed/page.tsx`
- `apps/frontend/src/app/admin/reports/page.tsx`
- `apps/frontend/src/app/admin/runs/page.tsx`
- `apps/frontend/src/app/admin/settings/page.tsx`
- `apps/frontend/src/app/admin/dashboard/DashboardClient.tsx`
- `apps/frontend/src/components/modals/BillingModal.tsx`
- `apps/frontend/src/components/modals/ViewOrderModal.tsx`
- `apps/frontend/src/components/modals/ViewRunModal.tsx`
- `apps/frontend/src/components/modals/ManagerRunModal.tsx`
- `apps/frontend/src/components/modals/CompletedOrderModal.tsx`
- `apps/frontend/src/components/modals/ConfigurationModal.tsx`

## New dependencies

No new dependencies.

## Vercel constraints to check

No serverless concerns — all changes are client-side layout only.

## Implementation rules for this feature

- All status transitions must go through `DynamicWorkflowEngine.validateTransition()`
- New endpoints must use `@Permissions('resource:action')` — add the string to `Permission` enum in frontend simultaneously
- Use `PrismaService.transaction()` for multi-step writes; update denormalized counters in the same transaction
- Decimal arithmetic must use `billing/utils/money.ts`; never use native `number` for money
- All frontend API calls must go through `apiRequest` / `apiRequestWithHeaders` — never raw `fetch`
- After editing `apps/packages/contracts/src/`, run `npm run build:contracts`
- Do not change behaviour of existing endpoints without explicit approval — project is live in production
- **Feature-specific:** Use Tailwind breakpoints only (`sm:`, `md:`) — no custom CSS or media query strings in JSX
- **Feature-specific:** FilterDrawer must not re-mount filter children on open/close; use CSS transform, not conditional rendering
- **Feature-specific:** Modal tab state is local `useState` — reset to tab 0 every time the modal opens (use `useEffect` on the open prop or orderId prop)
- **Feature-specific:** Desktop layout of all modals must remain pixel-identical to current — only add `sm:` prefixed classes to restore desktop layout; mobile-first defaults handle the small screen

## Definition of done

- [ ] FilterDrawer component exists at `src/components/layout/FilterDrawer.tsx` and renders as overlay drawer on < md and inline sidebar on md+
- [ ] All 6 pages with filter sidebars (Orders, Billing, Bills, Completed, Reports, Runs) use FilterDrawer — tapping the filter icon on a 390 px screen opens a full-height slide-in drawer with a backdrop
- [ ] BillingModal on a 390 px screen shows a tab bar ("Summary" / "Billing") and is full-screen with no horizontal overflow
- [ ] ViewOrderModal on a 390 px screen shows a tab bar ("Details" / "Runs") and is full-screen
- [ ] ViewRunModal on a 390 px screen is full-screen with stacked panels
- [ ] ManagerRunModal on a 390 px screen is full-screen with stacked panels
- [ ] CompletedOrderModal on a 390 px screen is full-screen
- [ ] ConfigurationModal on a 390 px screen is full-screen
- [ ] Reports page search input is visible and functional on a 390 px screen
- [ ] Dashboard period-picker buttons wrap to two rows on a 390 px screen (no overflow)
- [ ] Settings page content is fully visible with no horizontal scroll on a 390 px screen
- [ ] Bottom nav bar (admin layout) is never obscured by page content on any admin page on a 390 px screen
- [ ] No desktop regression — all pages look and function identically to current on ≥ 768 px viewport
- [ ] `npm run lint` (frontend) passes with no new errors
