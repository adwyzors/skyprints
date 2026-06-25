# Spec: DTF Variable Fusing Cost Inputs

**Branch:** `feature/dtf-variable-fusing-cost`  
**Session:** DTF5x2

---

## Problem

The DTF fusing cost calculation currently uses two hardcoded constants:

```
Fusing Cost = 5 × 2 × PCS  (or Custom PCS when Job Diff is on)
```

These values (`5` and `2`) cannot be changed per run. Different jobs may require different fusing rates, so they must become user-editable inputs.

---

## Goal

Replace the static `5 × 2` with two numeric input fields visible whenever **Fusing is enabled**, so the formula becomes:

```
Fusing Cost = [Fusing Rate] × [Sheets per Garment] × PCS
```

Both values default to their current hardcoded equivalents (`5` and `2`) so existing saved runs are unaffected.

---

## Scope

**Frontend only.** The `values` blob is stored as-is in the DB via the existing `configureRun` API — no backend or contracts changes needed.

Files to change:
1. `apps/frontend/src/domain/model/run.model.ts` — extend `DTFRunValues`
2. `apps/frontend/src/components/orders/DTFConfig.tsx` — UI inputs + calculation

---

## Data Model Change

### `DTFRunValues` (run.model.ts)

Add two optional numeric fields:

```ts
export interface DTFRunValues {
  // ... existing fields ...
  fusingRate: number;       // formerly hardcoded 5
  fusingSheets: number;     // formerly hardcoded 2
}
```

Default both to their current hardcoded values so existing runs (which lack these keys) continue to calculate correctly via `?? 5` / `?? 2` fallback.

---

## UI Changes (DTFConfig.tsx)

### Where to show the inputs

Inside the existing fusing section (the row that contains the Fusing / Job Diff checkboxes), add two numeric inputs that appear **only when `isFusing === true`**, alongside the checkboxes.

**Edit mode layout** (conceptual):

```
[ ✓ Fusing ]  [ Fusing Rate: [5] ]  [ Sheets/Garment: [2] ]  [ ☐ Job Diff ]  [ Custom PCS: [...] ]
```

The two new inputs sit between the Fusing checkbox and the Job Diff checkbox. They should:
- Be `type="number"` with `min="0"` and `step="0.01"`
- Have small, compact labels above them: **"Fusing Rate"** and **"Sheets/Garment"**
- Be disabled (read-only display) in view mode, just like the other fields

### Fusing Cost display (bottom summary panel)

Change the formula hint text from:
```
5 x 2 x Custom PCS
```
to:
```
{fusingRate} x {fusingSheets} x Custom PCS
```
(reflecting the live values from the form state)

---

## Calculation Change (getTotals)

Current (line ~357–361 in DTFConfig.tsx):
```ts
actualFusingCost = 5 * 2 * fusingPcs;
```

New:
```ts
const fusingRate = form.fusingRate ?? 5;
const fusingSheets = form.fusingSheets ?? 2;
actualFusingCost = fusingRate * fusingSheets * fusingPcs;
```

The `?? 5` / `?? 2` fallbacks preserve backward compatibility for runs saved before this change.

---

## initialFormState Update

```ts
const initialFormState: DTFRunValues = {
  particulars: '',
  isFusing: false,
  isJobDifference: false,
  pcs: 0,
  customPcs: 0,
  fusingRate: 5,     // ← new
  fusingSheets: 2,   // ← new
  rate: 0,
  items: [],
};
```

---

## Edit-form initialisation (useEffect on openRunId)

When loading an existing run's values into `editForm`, hydrate the new fields:

```ts
setEditForm({
  // ... existing fields ...
  fusingRate: values.fusingRate ?? 5,
  fusingSheets: values.fusingSheets ?? 2,
});
```

---

## Saved API Payload

No special handling needed. `apiValues` spreads `editForm`, so `fusingRate` and `fusingSheets` will be included automatically in the `values` blob sent to `configureRun`.

---

## Backward Compatibility

| Scenario | Behaviour |
|---|---|
| Run saved before this change (no `fusingRate`/`fusingSheets` keys) | `?? 5` and `?? 2` fallbacks restore the original calculation |
| Run saved after this change with defaults (5 and 2) | Identical result to pre-change |
| Run saved after this change with custom values | Uses those custom values |

No DB migration required.

---

## Out of Scope

- No backend changes
- No contracts changes
- No changes to `billing-calculator.ts` (it reads `Fusing Cost` from stored values, which is already computed and stored on save)
- No changes to billing views or billing snapshot logic

---

## Acceptance Criteria

1. When Fusing is **off**: no new inputs visible.
2. When Fusing is **on**: two numeric inputs appear — "Fusing Rate" (default 5) and "Sheets/Garment" (default 2).
3. Changing either input immediately updates the Fusing Cost displayed in the summary panel.
4. The formula hint text reflects the live input values (e.g. `7 x 3 x PCS`).
5. Saving persists the values; reopening the run in edit mode restores the saved values.
6. Existing runs without these fields calculate identically to before (backward compatible).
7. View mode shows the saved values as read-only (no inputs rendered).
