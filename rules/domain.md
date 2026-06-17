# Skyprints Domain Knowledge

Derived from the live production DB dump (2026-06-17). Use this as authoritative ground truth for all feature development.

---

## Business Context

Skyprints is a tshirt printing **factory** in Mumbai that takes printing orders from clothing brands/manufacturers (customers) and runs them through one or more decoration processes (screen printing, embellishment, DTF, etc.). Each order goes through: intake → process runs → billing.

**Scale (live data):** ~20–40 billed orders per day · 2,000–8,000+ units/day · daily revenue ₹25K–₹3L INR. FY 25-26 reached ORD8671 and R2287 (receipt). FY 26-27 is live (as of 2026-06-17: ORD630, R292).

**Locations:** Two workstations — `BHIWANDI` (main production site) and `PRIME` (Prime Plaza, Prabhadevi — office/secondary).

---

## Order Lifecycle

```
CONFIGURE → PRODUCTION_READY → IN_PRODUCTION → COMPLETE → BILLED → GROUP_BILLED
```

- **CONFIGURE**: Order created but not yet sent to production floor. Config for processes happens here.
- **PRODUCTION_READY**: All processes are configured; order is queued for production.
- **IN_PRODUCTION**: At least one process run is actively being worked on.
- **COMPLETE**: All process runs lifecycle-complete. Ready to bill.
- **BILLED**: Billed individually (ORDER-type billing context).
- **GROUP_BILLED**: Included in a group receipt/challan (GROUP-type billing context).

**Order code format:** `ORD{sequenceNumber}/{fiscalYear}` (e.g., `ORD591/26-27`). Test orders use `TESTORD` prefix.

---

## OrderProcess Lifecycle

Each `Order` has one `OrderProcess` per `Process` assigned to it.

```
CONFIGURE → IN_PROGRESS → COMPLETE
```

Counters on `OrderProcess`:

- `totalRuns` — how many `ProcessRun` rows exist
- `configCompletedRuns` — runs that finished the config workflow (CONFIGURE→COMPLETE)
- `lifecycleCompletedRuns` — runs that finished the lifecycle workflow (reached terminal status)
- `remainingRuns` — derived; used to detect if all production work is done

---

## ProcessRun Lifecycle

Each `OrderProcess` has one or more `ProcessRun` rows (a run is one execution batch of a process for an order).

```
statusCode (outer): CONFIGURE → IN_PROGRESS → COMPLETE
lifeCycleStatusCode (inner): per-process workflow stages (see below)
```

- **CONFIG workflow** (same for all processes): `CONFIGURE → COMPLETE`
- **LIFECYCLE workflow**: process-specific multi-stage state machine (see per-process details below)
- A run has an `executorId` (who did the work) and `reviewerId` (who signed off)
- `locationId` / `preProductionLocationId` / `postProductionLocationId` track physical movement
- `fields` JSONB stores all process-specific data captured during config/execution
- `comments` for any notes
- `ProcessRunLifecycleHistory` records each lifecycle status transition with timestamps and expected dates

---

## Processes & Their Workflows

### 10 Enabled Production Processes

| Process                        | RunTemplate billing formula   | Key config fields                                                                                                                                                                                                             |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Printing**      | `quantity * new_rate`       | Design, Fabric Color, Print Type, Number of Colors, Fabric Type, Area, Farma Size, Quantity, Estimated Rate, New Rate                                                                                                         |
| **Embellishment**        | `quantity * new_rate`       | Particulars, Process Name, Quantity, Estimated Rate, New Rate                                                                                                                                                                 |
| **Spangle**              | `quantity * new_rate`       | Design, Fabric Color, Print Type, Number of Colors, Colors, Area, Farma Size, Quantity, Estimated Rate, New Rate                                                                                                              |
| **Direct to Film (DTF)** | `pcs * new_rate`            | particulars, pcs, rate, New Rate, isFusing, isJobDifference, customPcs, Layout Amount, Actual Meter Cost, Fusing Cost, Actual Total, Efficiency%, Per PC Cost, Total Area, Total Layouts, items, fusingFactor1, fusingFactor2 |
| **Diamond**              | `new_rate * total_quantity` | particulars, Total Quantity, End Rate, New Rate, Total Amount, Estimated Amount, items                                                                                                                                        |
| **Allover Sublimation**  | `new_rate * total_mtr`      | particulars, Total Mtr, Total Quantity, rate_per_meter, New Rate, Total Amount, Estimated Amount, items, panna, printer                                                                                                       |
| **Sublimation**          | `new_rate * totalquantity`  | New Rate, rate, avgRate, columnHeaders, totalAmount, totalMeters, totalQuantity, Estimated Amount, items, totals                                                                                                              |
| **Plotter**              | `new_rate * total_quantity` | particulars, Total Quantity, Total Sheet Req, Total Sheet Req (Meters), New Rate, Total Amount, Estimated Amount, items, sheetsToCut                                                                                          |
| **Positive**             | `total_amount`              | particulars, rate, New Rate, Total Amount, Estimated Amount, items                                                                                                                                                            |
| **Laser**                | `new_rate * total_quantity` | Average Rate, Estimated Amount, Total Amount, Total Laser Time, Total Quantity, items, particulars, New Rate                                                                                                                  |

### Config Workflow (all processes — identical)

`CONFIGURE (initial) → COMPLETE (terminal)`

### Lifecycle Workflows per Process

**Screen Printing:**
`DESIGN (initial) → SIZE/COLOR → TRACING → EXPOSING → SAMPLE → PRODUCTION → WAITING → CURING → FUSING → QC&COUNTING → COMPLETE (terminal)`

**Embellishment:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

**Spangle:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

**Diamond:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

**DTF (Direct to Film):**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

**Allover Sublimation:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → FUSING → Var Kata and Kg → COMPLETE`

**Sublimation:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → FUSING → QC&COUNTING → COMPLETE`

**Plotter:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

**Positive:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

**Laser:**
`DESIGN → SIZE/COLOR → SAMPLE → RANGE → PRODUCTION → WAITING → CUTTING/WEEDING → FUSING → QC&COUNTING → COMPLETE`

### RunTemplate ↔ Process Mapping

Each `Process` has exactly one `RunTemplate` (via `ProcessRunDefinition` with `sortOrder=1`). WorkflowTypes are named `RUN_TEMPLATE_{ProcessName}_CONFIG` and `RUN_TEMPLATE_{ProcessName}_LIFECYCLE`.

---

## Billing System

### BillingContext (two types)

- **ORDER**: One order billed individually. Name = `"Order Billing {orderId}"`. Drives `BILLED` status.
- **GROUP**: Multiple orders billed together as a receipt/challan. Name = receipt code (e.g., `R292/26-27`). Drives `GROUP_BILLED` status on all included orders.

**Group receipt code format:** `R{sequenceNumber}/{fiscalYear}` (e.g., `R292/26-27`). Test receipts use `TESTR` prefix.

### BillingSnapshot

Snapshots are versioned per `BillingContext`. Fields:

- `version`: incrementing integer (unique per context)
- `isLatest`: only one snapshot per context is latest
- `intent`: `DRAFT` (work in progress) or `FINAL` (locked/sent to customer)
- `calculationType`: `INITIAL` (first calc) or `RECALCULATED` (revised)
- `inputs`: JSONB — keyed by `processRunId` for ORDER type; by `orderId` for GROUP type
  - Special key `__CUSTOMER_METADATA__`: `{tax, tds, code, name, gstno, tdsno, address}`
  - Special key `__ORDER_RESULT__` (group only): total string amount
  - Special key `__TDS_METADATA__`: `{tdsAmount, tdsEnabled, tdsPercentage}`
  - Run entry shape: `{new_rate, quantity, estimated_rate, estimated_amount, ...other fields}`
- `result`: raw formula-calculated subtotal
- `subTotalAmount`, `taxAmount`, `finalAmount`: after applying GST and TDS
- `currency`: always `INR`
- `taxEnabled` + `taxPercentage`: GST toggle (18% standard for garment decoration services)

### Billing Formula Execution

The `billingFormula` on `RunTemplate` uses `formulaKey` values from the `fields` array. The billing engine evaluates `billingFormula` with run `fields` values substituted. `new_rate` is always an optional override over `estimated_rate`.

---

## Fiscal Year & Sequence Numbers

Format: `{YY_START}-{YY_END}` (e.g., `25-26` for Apr 2025–Mar 2026, `26-27` for Apr 2026–Mar 2027).

| Prefix      | Purpose               | FY 25-26 last | FY 26-27 current       |
| ----------- | --------------------- | ------------- | ---------------------- |
| `ORD`     | Order codes           | 8671          | 630 (as of 2026-06-17) |
| `R`       | Group receipt/challan | 2287          | 292                    |
| `D`       | Unknown/draft         | —            | 1                      |
| `TESTORD` | Test orders           | —            | 2                      |
| `TESTR`   | Test receipts         | —            | 1                      |

---

## Customer Data Patterns

- Mumbai garment industry cluster (Maharashtra GST prefix: `27XXXXXXXXXX`)
- Customer `code` is an informal display name (e.g., `DOTS`, `MAHAVIR`, `NCPL`)
- Real company name stored in `name`
- GST number (`gstno`) required for invoicing; tax flag enables GST on billing
- `tds` flag enables TDS deduction; `tdsno` is TDS percentage (integer, e.g., `2` = 2%)
- `outstandingAmount`: running balance owed by customer (can be negative if overpaid)
- `creditLimit`: per-customer credit ceiling
- Soft-delete via `deletedAt` (isActive=false + deletedAt set)

---

## Users & Roles

Current live users (all role `ADMIN`):

| Name         | Email                    | Notes                       |
| ------------ | ------------------------ | --------------------------- |
| Alankrit     | alankritarya15@gmail.com | Co-owner/admin              |
| Chaitanya    | ck19king@gmail.com       | Developer + admin           |
| Hardik Dhruv | hardikdhruv@gmail.com    | Admin                       |
| FrontDesk    | frontdesk@gmail.com      | Order intake                |
| SkyBhiwandi  | skybhiwandi@gmail.com    | Linked to Bhiwandi location |
| Digital      | digital@gmail.com        | Digital process operator    |

User `preferences` JSONB controls dashboard widget visibility (showOrders, showRevenue, showChart, showPulse, showUnits, showMatrix, showWorkload, showCustomers, showProcesses, showPerformance, showHubs, fontSize).

---

## Analytics Tables

All analytics are denormalized for fast dashboard reads. Updated by background jobs.

| Table                 | Key metrics                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- |
| `DailyAnalytics`    | totalRevenue, totalOrders, totalUnits, billedRevenue, billedOrders (one row per date) |
| `ProcessAnalytics`  | totalRevenue, totalRuns, totalUnits, avgLeadTime per process                          |
| `LocationAnalytics` | totalRevenue, totalRuns, totalUnits per location                                      |
| `OrderAnalytics`    | totalAmount, totalUnits, cycleTimeHours, billedAt per order                           |
| `UserPerformance`   | runsExecuted, runsReviewed, totalBilledVolume per user                                |

---

## Key Invariants

- Every `Order` that is not CONFIGURE has at least one `OrderProcess`.
- Each `Process` has exactly one `RunTemplate` (1:1 via `ProcessRunDefinition` sortOrder=1).
- `ProcessRun.statusCode` (outer) and `lifeCycleStatusCode` advance independently: outer status reflects the billing/admin view; inner reflects physical production stage.
- A `BillingSnapshot` with `intent=FINAL` and `isLatest=true` is the authoritative bill.
- `Order.isTest=true` means it is a sandbox order; excluded from analytics and billing totals.
- `Customer.deletedAt` non-null = soft-deleted; must be excluded from active customer lists.
- Order code uniqueness enforced as `(code, deletedAt)` — same code can reappear if the original is deleted.
