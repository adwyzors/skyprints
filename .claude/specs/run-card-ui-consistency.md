# Spec: Run Card UI Consistency — All Process Config Components

**Branch:** `fix/run-card-ui-consistency`
**Scope:** `apps/frontend/src/components/orders/*Config.tsx` (all 10 process configs)

---

## Problem

The collapsed run item card — the clickable row that shows each run's status before the user opens it — is rendered inconsistently across process config components. Two visual languages exist side-by-side, making the Order Configuration page feel unfinished and creating user confusion about whether a run is configured.

**Screenshot evidence:** Spangle shows a gray card with a Palette icon and `"Configured • DESIGN"` subtitle. Diamond and DTF show a green card with a small dot and an inline `✓ Configured` badge. These are the same data state rendered completely differently.

---

## Standard Pattern (Source of Truth)

The **majority of configs** (Diamond, DTF, ScreenPrinting, Embellishment, Positive, Plotter) agree on this pattern. It is the standard:

### Collapsed run row

```tsx
<div
  onClick={() => setOpenRunId(run.id)}
  className={`p-3 border rounded cursor-pointer flex justify-between items-center
    ${run.configStatus === 'COMPLETE'
      ? 'bg-green-50 border-green-200 hover:bg-green-100'
      : 'bg-white border-gray-200 hover:bg-gray-50'
    }`}
>
  {/* LEFT SIDE */}
  <div className="flex items-center gap-2">
    <div className={`w-2 h-2 rounded-full
      ${run.configStatus === 'COMPLETE' ? 'bg-green-500' : 'bg-yellow-500'}`}
    />
    <span className="font-medium text-sm">Run {run.runNumber}</span>
    {run.configStatus === 'COMPLETE' && (
      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> Configured
      </span>
    )}
  </div>

  {/* RIGHT SIDE */}
  <div className="flex items-center gap-1">
    {run.configStatus === 'COMPLETE'
      ? <Eye className="w-4 h-4 text-gray-500" />
      : <Edit className="w-4 h-4 text-gray-500" />
    }
    {/* Delete button (permission-gated) */}
    <ChevronRight className="w-4 h-4 text-gray-400" />
  </div>
</div>
```

### Add Configuration Run button

```tsx
<button className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg
  text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50
  transition-all flex items-center justify-center gap-2 text-sm font-medium">
  <Plus className="w-4 h-4" />
  Add Configuration Run
</button>
```

### Loading spinner (when isAddingRun)

```tsx
<div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
```

---

## Deviations Found

### 1. SpangleConfig — `src/components/orders/SpangleConfig.tsx`

| Property | Current (non-standard) | Required (standard) |
|---|---|---|
| Background (configured) | `bg-gray-50` always | `bg-green-50 border-green-200 hover:bg-green-100` |
| Left border | `border-l-4 border-l-green-500` (accent only) | None — full background color carries the state |
| Left icon | `<Palette w-5 h-5>` in `p-2 rounded-lg bg-green-100` box | `w-2 h-2 rounded-full bg-green-500` dot |
| Status label | `"Configured • {lifecycleStatus}"` as subtitle (`text-xs text-gray-500`) | `<CheckCircle w-3 h-3> Configured` inline badge (`text-xs text-green-600`) |
| Lifecycle status | Shown as part of subtitle always | Not shown in collapsed view |
| Chevron icon | `ChevronDown w-5 h-5` rotating `rotate-180` | `ChevronRight w-4 h-4 text-gray-400` static |
| Expand behaviour | Accordion (header stays, body expands inline) | Row replaced by `renderRun()` |
| Add Run button padding | `py-1 ... rounded` (no `-lg`) | `py-2 ... rounded-lg` |
| Loading spinner | `<Loader2 className="animate-spin w-4 h-4">` | CSS div spinner |

**Files to change:** Lines 570–626 (collapsed header), lines 628–637 (Add Run button)

---

### 2. SublimationConfig — `src/components/orders/SublimationConfig.tsx`

| Property | Current (non-standard) | Required (standard) |
|---|---|---|
| Background (configured) | `bg-gray-50` always | `bg-green-50 border-green-200 hover:bg-green-100` |
| Left border | `border-l-4 border-l-green-500` (accent only) | None |
| Left icon | `<Palette w-5 h-5>` in `p-2 rounded-lg bg-green-100` box | `w-2 h-2 rounded-full bg-green-500` dot |
| Status label | `text-green-600 font-medium "Configured"` / `text-amber-600 "Pending Configuration"` + `{lifecycleStatus}` on separate line | `<CheckCircle w-3 h-3> Configured` inline badge only |
| Lifecycle status | Shown separately as `<span>{run.lifecycleStatus}</span>` | Not shown in collapsed view |
| Chevron icon | `ChevronDown w-5 h-5` with static `rotate-180` swap | `ChevronRight w-4 h-4 text-gray-400` static |
| Expand behaviour | Accordion (header stays visible) | Row replaced by `renderRun()` |

**Files to change:** Lines 759–801 (collapsed header), Add Run button (check line numbers)

---

### 3. LaserConfig & AlloverSublimationConfig — minor chevron variant

| Property | Current | Required |
|---|---|---|
| Chevron icon | `ChevronRight` with `rotate-90` when `openRunId === run.id` | `ChevronRight w-4 h-4 text-gray-400` static (no rotation) |

Background, dot, and status badge are already standard. Only the chevron rotation needs removing.

**Files to change:**
- `LaserConfig.tsx` line 999: remove `${openRunId === run.id ? 'rotate-90' : ''}`
- `AlloverSublimationConfig.tsx` line 1032: remove `${openRunId === run.id ? 'rotate-90' : ''}`

---

## Summary of Changes Required

| Config | Icon box → dot | Background | Status badge | Chevron | Accordion → row-replace | Add Run padding |
|---|---|---|---|---|---|---|
| SpangleConfig | ✅ fix | ✅ fix | ✅ fix | ✅ fix | ✅ fix | ✅ fix |
| SublimationConfig | ✅ fix | ✅ fix | ✅ fix | ✅ fix | ✅ fix | check |
| LaserConfig | — | — | — | ✅ fix (rotation only) | — | — |
| AlloverSublimationConfig | — | — | — | ✅ fix (rotation only) | — | — |
| DiamondConfig | standard | standard | standard | standard | standard | standard |
| DTFConfig | standard | standard | standard | standard | standard | standard |
| ScreenPrintingConfig | standard | standard | standard | standard | standard | standard |
| EmbellishmentConfig | standard | standard | standard | standard | standard | standard |
| PositiveConfig | standard | standard | standard | standard | standard | standard |
| PlotterConfig | standard | standard | standard | standard | standard | standard |

---

## Out of Scope

- The **expanded / open run form** (`renderRun()`) is not in scope — differences there are intentional per process type
- Location badges (PRE/POST) inside the run row are already consistent across all configs
- The `RunCommentEditor` and image upload sections are not in scope

---

## Mobile Notes

The collapsed run row is a single `flex` row with `p-3`. On mobile screens (`< sm`):
- The current Spangle/Sublimation icon box (`p-2 rounded-lg w-5 h-5`) takes more horizontal space than the standard `w-2 h-2` dot, squeezing the run name and status badge. Standardising the icon removes this squeeze.
- The `CheckCircle + Configured` badge in the standard is `text-xs` and fits comfortably on mobile; Sublimation's two-line subtitle wraps and increases row height unpredictably.

No additional mobile-specific changes are needed beyond applying the standard pattern.

---

## Acceptance Criteria

1. All 10 process config components render an identical collapsed run row for the same `configStatus` value.
2. Configured runs: green background (`bg-green-50 border-green-200`), green dot, `✓ Configured` badge.
3. Pending runs: white/light background, yellow dot, no badge.
4. All chevrons are static `ChevronRight` — no rotation state.
5. All "Add Configuration Run" buttons use `py-2 rounded-lg`.
6. No `border-l-4` accent borders on run rows.
7. No Palette icon boxes in run row headers.
8. Verified on desktop and mobile viewport (`< 640px`).
