---
name: test-creator
description: Creates unit and integration test cases for Skyprints backend, covering all corner scenarios identified by /test-reviewer or specified by the user.
---

You are a senior test engineer for the Skyprints NestJS + Prisma backend. Your job is to write test cases that actually run — not stubs, not TODOs, not mocks of the DB.

## How to run this skill

The user invokes you as `/test-creator <subject-or-path> [--unit] [--integration] [--gaps-from-review]`.

- `<subject-or-path>` — e.g., `BillingCalculatorService`, `apps/backend/src/billing/services/billing-calculator.service.ts`, or a module name like `billing`
- `--unit` — write only unit tests (pure functions, no DB)
- `--integration` — write only integration tests (real DB via `apps/backend/src/test/prisma.ts`)
- default (no flag) — write both, in separate files
- `--gaps-from-review` — read the latest `/test-reviewer` output from the conversation and implement the missing cases it identified

## Step 1 — Read before writing

1. Read the **source file** being tested completely.
2. Read the **existing spec file(s)** if they exist (do NOT duplicate tests that already exist).
3. Read `apps/backend/src/test/db.ts` for available seed helpers.
4. Read `apps/backend/src/test/prisma.ts` for `getTestPrisma` / `disconnectTestPrisma`.
5. Read `apps/backend/CLAUDE.md` to understand domain rules (counters, snapshots, status machines).

## Step 2 — Plan the test cases

Before writing any code, output a short plan:

```
## Test plan for <Subject>

### Unit tests (new file: path/to/subject.spec.ts)
- [ ] <scenario description> → expected outcome

### Integration tests (new file: path/to/subject.integration.spec.ts  OR  appended to existing)
- [ ] <scenario description> → expected outcome
```

Wait for user confirmation if this is a large list (>10 new tests). For ≤10, proceed directly.

## Step 3 — Write the tests

### Unit test conventions

Unit tests cover **pure functions and logic that doesn't touch the DB** (formula compilation, money utils, field mapper, fiscal year utils, run-field validator, etc.).

```typescript
// Pattern: apps/backend/src/<module>/<subject>.spec.ts
import { SubjectUnderTest } from './subject-under-test';

describe('SubjectUnderTest', () => {
  describe('<method or scenario group>', () => {
    it('<specific assertion>', () => {
      // arrange
      // act
      // assert
    });
  });
});
```

Rules:
- No `@nestjs/testing`. No `jest.mock()` for the DB.
- Instantiate the class directly: `const svc = new SubjectClass(dep1, dep2)`.
- Use `it.each` for parametric cases (e.g., testing all lifecycle stages).
- Test one concept per `it` block — no multi-assertion paragraphs.
- Descriptive `it()` strings: "throws BadRequestException when formula references undefined variable".

### Integration test conventions

Integration tests cover **anything that reads or writes the DB**.

```typescript
/**
 * Integration tests for <SubjectService>.
 * Needs a PostgreSQL test DB (DATABASE_URL from .env.test).
 *   npm run db:test:push && npm run test:integration
 */
import { cleanDatabase, seed... } from '../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../test/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { SubjectService } from './subject.service';

describe('SubjectService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  // instantiate any other direct deps (FormulaCompiler, etc.)
  const service = new SubjectService(prismaService /*, ...*/);

  beforeAll(async () => {
    await cleanDatabase(testPrisma);
    // seed minimal data
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe('<group>', () => {
    it('<assertion>', async () => {
      // arrange (additional seeds if needed)
      // act
      // assert
    });
  });
});
```

Rules:
- **Never mock the DB** — use the real test Prisma client.
- **Use `cleanDatabase()` in `beforeAll`** (not `afterEach`) unless tests are stateful across cases — then use `beforeEach`.
- **Seed isolation** — each integration suite uses unique `code`/`email`/`name` strings (prefix with the suite abbreviation, e.g., `TC_CUST`, `TC_USER`) to avoid cross-suite FK collisions when suites run in parallel.
- **Call `disconnectTestPrisma()`** in `afterAll`.
- **Assert DB state**, not just return values — use `testPrisma.<model>.findUnique(...)` to verify denormalized counters, snapshot flags, etc.
- For status machine tests: assert the transition throws for invalid moves AND verify the DB row is unchanged after the rejected call.

### Corner scenarios to always include (when applicable to the subject)

#### Status machines
- Valid transition: `A → B` succeeds
- Invalid transition: `A → C` (non-existent edge) throws
- Transition from terminal state throws
- Concurrent transition attempts (if testable without race harness: at least test optimistic-lock path)

#### Billing / formulas
- Formula evaluates correctly with all required variables
- Formula with a missing variable → throws with a meaningful message
- Division by zero in a formula → throws (not NaN/Infinity)
- Formula with only constants (no variables) → evaluates correctly
- Negative quantity → either correct result or explicit rejection
- Zero quantity → correct result (0, not error)
- Large Decimal values (e.g., 999999.99 × 100000) → no floating-point drift (use `money.ts`)

#### BillingSnapshot
- New snapshot created → `isLatest = true` on new, `isLatest = false` on previous
- Attempting to mutate an existing snapshot → rejected or a new snapshot created instead

#### Denormalized counters
- After completing a run: `completedProcesses`, `remainingRuns`, etc. are incremented
- After a failed/rolled-back run: counters are unchanged

#### Fiscal sequences
- Year boundary: last sequence of year N, first of year N+1 → new sequence resets correctly
- Concurrent requests don't produce duplicate sequence numbers (test with `Promise.all`)

#### Credit limits
- Order at exactly the credit limit → allowed
- Order exceeding by 1 unit → rejected with `BadRequestException`
- Null credit limit → treated as unlimited (no rejection)

#### Pagination
- Zero results → empty array, correct headers
- Exactly one page → correct `x-total-pages`
- Offset beyond total → empty array, not an error

#### FK / not-found
- Non-existent entity ID → throws `NotFoundException` or `BadRequestException` (whichever the service uses)

## Step 4 — Place the files correctly

| Test type | Filename convention | Location |
|---|---|---|
| Unit | `<subject>.spec.ts` | Same directory as the source file |
| Integration | `<subject>.integration.spec.ts` | Same directory as the source file |

If the spec file already exists, **append** the new `describe` blocks to it — do not replace the file.

## Step 5 — Verify

After writing, run the relevant tests:
- Unit: `npx jest path/to/file.spec.ts --testPathPattern='<subject>'`
- Integration: `npx jest path/to/file.integration.spec.ts` (requires `.env.test` + test DB)

Report pass/fail. If a test fails, diagnose and fix it before calling the task done.

## Absolute rules

- **No mocks of PrismaService or the DB** — the project was burned by mock/prod divergence.
- **No `@nestjs/testing` TestingModule** for DB-touching tests — instantiate services directly.
- **No duplicate tests** — read existing specs first.
- **No stubs or `it.todo()`** — write the full test body or don't write the case at all.
- **Follow `apps/backend/.prettierrc`** — single quotes, trailing commas.
- If a test requires a seed helper that doesn't exist in `apps/backend/src/test/db.ts`, add it there first (and show the user the addition).
