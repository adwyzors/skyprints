# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Skyprints** (`factory-process-app`) — a live production factory order/production tracking and billing system. npm workspaces monorepo:

- `apps/backend` — NestJS 11 + Prisma + PostgreSQL, deployed on Vercel serverless (free tier)
- `apps/frontend` — Next.js 14 App Router, deployed on Vercel serverless (free tier)
- `apps/packages/contracts` — `@app/contracts`, Zod schemas + inferred DTO types shared between both apps

Auth: Keycloak hosted on DigitalOcean. DB: hosted PostgreSQL. Image storage: Cloudflare R2.

**This project is live in production. Never change externally observable behaviour without explicit approval.**

## Commands (run from repo root)

```bash
npm install              # installs all workspaces, builds contracts, runs prisma generate
npm run build:contracts  # rebuild contracts only (do this after editing apps/packages/contracts/src/)
npm run build            # contracts → backend → frontend
npm run dev:backend      # nest start --watch → :3001
npm run dev:frontend     # next dev → :3000
```

Backend-only (from `apps/backend/` or with `--workspace apps/backend`):

```bash
npm run lint
npm test
npx jest path/to/file.spec.ts   # single file (no *.spec.ts exist yet)
npx prisma migrate dev --name <name>
npx prisma generate
npx prisma studio
```

Frontend-only (from `apps/frontend/`):

```bash
npm run lint    # next lint (no test runner configured)
```

## Workspace docs

- [Backend architecture &amp; known issues](apps/backend/CLAUDE.md)
- [Frontend architecture &amp; known issues](apps/frontend/CLAUDE.md)

## Reference rules

- [Auth / Keycloak — flow, security notes, things to fix](rules/auth.md)
- [Known issues &amp; patterns to avoid](rules/known-issues.md)
- [Vercel serverless deployment constraints](rules/deployment.md)
- [Domain knowledge — processes, workflows, billing, fiscal sequences](rules/domain.md)

## Contracts package

Write-side (`*.contract.ts`) and read-side (`*.read.contract.ts`) Zod schemas per domain, re-exported from `src/index.ts`. After editing source, run `npm run build:contracts`. The `dist/` output is committed. Both apps import from `@app/contracts` — never duplicate types in either app.

## Available skills & commands

These are installed globally and work in this project:

| Command / Skill            | When to use                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `/create-spec <feature>` | Plan a new feature — creates a spec + feature branch from `develop`                  |
| `/feature-dev <feature>` | Full guided feature development with discovery → architecture → implementation phases |
| `/backend-dev <task>`    | Implement a backend change with full rule enforcement (NestJS + Prisma + auth)         |
| `/frontend-dev <task>`   | Implement a frontend change with full rule enforcement (Next.js + auth + services)     |
| `/code-review`           | Review current diff for bugs and CLAUDE.md compliance                                   |
| `/code-review ultra`     | Deep multi-agent cloud review (billed; use before merging significant changes)          |
| `/simplify`              | Cleanup pass — reuse, simplification, efficiency (not bug hunting)                     |
| `frontend-design` skill  | UI/visual direction for new frontend components                                         |
| `session-report` skill   | End-of-session summary of what changed                                                  |

Spec files live in `.claude/specs/`. Create them with `/create-spec` before implementing.

## Conventions

- Node pinned to `20.11.1` (`.nvmrc`, `engines.node: ">=20 <21"`)
- Backend prettier: single quotes, trailing commas (see `apps/backend/.prettierrc`)
- Root prettier: semi, single quote, printWidth 100 (applies to frontend + contracts)
- `@typescript-eslint/no-explicit-any` is intentionally off on backend
- `@shared/*` alias in `tsconfig.base.json` points to a package that **does not exist** — do not use it
- The root-level `*.js` scripts are ad-hoc DB scratch tools, not part of the build
