---
description: Create a spec file and feature branch for the next Skyprints feature
argument-hint: 'Feature name e.g. "bulk order export" or "credit limit dashboard"'
allowed-tools: Read, Write, Glob, Grep, Bash(git:*)
---

You are a senior developer planning a new feature for **Skyprints** (`factory-process-app`).
Always follow the rules in CLAUDE.md and workspace docs.

User input: $ARGUMENTS

## Step 1 — Check working directory is clean

Run `git status`. If uncommitted, unstaged, or untracked files exist, stop immediately and
tell the user to commit or stash before proceeding. DO NOT CONTINUE until the tree is clean.

## Step 2 — Parse the arguments

From $ARGUMENTS derive:

1. `feature_title` — human readable, Title Case (e.g. "Bulk Order Export")
2. `feature_slug` — lowercase kebab-case, max 40 chars, only a-z 0-9 and - (e.g. `bulk-order-export`)
3. `branch_name` — format: `feature/<feature_slug>`

If you cannot infer these, ask the user before continuing.

## Step 3 — Check branch name is not taken

Run `git branch -a`. If `branch_name` exists, append `-01`, `-02`, etc.

## Step 4 — Branch from develop

```
git checkout develop
git pull origin develop
git checkout -b <branch_name>
```

## Step 5 — Research the codebase

Read these before writing the spec:

- `CLAUDE.md` (root), `apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md`
- `rules/auth.md`, `rules/known-issues.md`, `rules/deployment.md`
- `apps/backend/prisma/schema.prisma` — current data model
- `apps/packages/contracts/src/index.ts` — existing contracts
- All files in `.claude/specs/` — avoid duplicating existing specs
- The backend module(s) most relevant to the feature
- The frontend page(s) most relevant to the feature

## Step 6 — Write the spec

Generate a spec with this exact structure:

---

# Spec: <feature_title>

## Overview

One paragraph: what this feature does, who uses it (admin / manager), and why it is needed.

## Scope

- **In scope:** what will be built
- **Out of scope:** what is explicitly excluded

## Depends on

List any features or data that must exist first.

## Contract changes (`@app/contracts`)

Any new Zod schemas or DTO types needed in `apps/packages/contracts/src/`.
If none: state "No contract changes."
**Contracts must be updated before backend and frontend changes.**

## Backend changes (`apps/backend`)

- New routes: `METHOD /api/v1/path` — description — required permission (`resource:action`)
- New/modified services, repositories, or Prisma queries
- Schema changes: new models, columns, or migrations needed
- If none in a sub-section, state so explicitly

## Frontend changes (`apps/frontend`)

- New pages or routes under `admin/` or `manager/`
- New or modified components (list path, e.g. `src/components/orders/BulkExport.tsx`)
- New service method(s) in `src/services/`
- If none: state "No frontend changes."

## Files to create / modify

List every file path. Group by workspace.

## New dependencies

Any new npm packages and which workspace they go in. If none: state "No new dependencies."

## Vercel constraints to check

Note any concern about serverless function timeout (10 s limit) or cold-start impact.
If irrelevant: state "No serverless concerns."

## Implementation rules for this feature

Always include the project-wide rules below, then add feature-specific ones:

- All status transitions must go through `DynamicWorkflowEngine.validateTransition()`
- New endpoints must use `@Permissions('resource:action')` — add the string to `Permission` enum in frontend simultaneously
- Use `PrismaService.transaction()` for multi-step writes; update denormalized counters in the same transaction
- Decimal arithmetic must use `billing/utils/money.ts`; never use native `number` for money
- All frontend API calls must go through `apiRequest` / `apiRequestWithHeaders` — never raw `fetch`
- After editing `apps/packages/contracts/src/`, run `npm run build:contracts`
- Do not change behaviour of existing endpoints without explicit approval — project is live in production

## Definition of done

A testable checklist. Each item must be verifiable by running the app or checking the DB:

- [ ] ...
- [ ] ...

---

## Step 7 — Save the spec

Save to: `.claude/specs/<feature_slug>.md`
Create the `.claude/specs/` directory if it does not exist.

## Step 8 — Report to the user

Print this summary:

```
Branch:    <branch_name>
Spec file: .claude/specs/<feature_slug>.md
Title:     <feature_title>
```

Then say:
"Review the spec at `.claude/specs/<feature_slug>.md`, then use `/feature-dev` or
enter Plan Mode (Shift+Tab twice) to begin implementation."

Do not print the full spec in chat unless explicitly asked.
