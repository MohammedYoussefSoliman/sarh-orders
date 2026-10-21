# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install
pnpm db:up            # Postgres 16 in Docker on :5433, waits for healthy
pnpm db:migrate       # apply migrations
pnpm seed             # 2 users + 50,000 orders (~6s)
pnpm dev              # API :3000 and web :5180 in parallel
```

| Task | Command |
| --- | --- |
| All e2e tests | `pnpm test:e2e` |
| One test file | `pnpm --filter @sarh/api exec jest --config ./test/jest-e2e.json test/auth.e2e-spec.ts` |
| One test by name | add `-t "creates exactly one order when two identical requests race"` |
| R2 proof | `pnpm proof:duplicates [n]` (n parallel identical creates) |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` |
| Smaller seed | `SEED_ORDER_COUNT=5000 pnpm seed` |

Everything reads the root `.env` (via `dotenv-cli`), including Prisma. `JWT_SECRET` has no
default and must be ≥32 chars or the API refuses to boot.

`pnpm db:reset` is destructive and Prisma blocks it for AI agents — ask the user to run it.

## Architecture

pnpm workspace: `apps/api` (NestJS 11), `apps/web` (React 19 + Vite + Tailwind 4),
`packages/shared` (Zod schemas + types imported by **both** sides).

`packages/shared` is the contract — `createOrderSchema` validates the browser form and the
API body. Changing a schema changes both; after editing it run
`pnpm --filter @sarh/shared run build` or the API's CJS build sees stale types.

Two requirements drive the design, and both are enforced by **the database, not application
code**. Read `DECISIONS.md` before changing either.

**R2 — no duplicate orders.** `orders.idempotency_key` has a UNIQUE index; creates run
`ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`. No row back ⇒ compare the stored
SHA-256 `request_hash`: same ⇒ 200 with the original order, different ⇒ 422. The client
keeps its key in `sessionStorage` so a reload replays rather than duplicating. Do not
replace this with application-level locking or a dedup time window.

**R1 — keyset pagination and no stale results.** List pages use row-value comparison
(`WHERE (sort_col, id) < ($v, $id)`) matching composite indexes ordered `(… DESC, id DESC)`,
fetching `limit + 1` to detect a next page without `COUNT(*)`. Never reintroduce
`OFFSET`/page numbers: besides the depth cost, it skips and repeats rows as orders arrive.
On the client, the TanStack Query key embeds *every* filter and the `signal` is forwarded to
axios. **A new filter must go inside the query key**, not beside it, or stale results return.
Debouncing is chatter control only — it is not the guarantee.

### Gotchas that have already bitten

- `apps/web/tsconfig.json` is a solution file (`"files": []`). `tsc --noEmit` against it
  silently checks nothing; the `typecheck` script uses `tsc -b --force` for that reason.
- `@typescript-eslint/consistent-type-imports` is **off** in `apps/api`. Its autofix rewrites
  injected classes to `import type`, which erases the `emitDecoratorMetadata` Nest needs and
  breaks DI at runtime.
- No global `ValidationPipe` — it requires `class-validator`, which this project deliberately
  does not use. Validation is per-route `ZodValidationPipe`.
- Raw SQL uses `Prisma.sql`; `sort`/`dir` are Zod enums mapped through the `SORT_COLUMNS`
  whitelist in `orders.repository.ts`. Never interpolate request values into query text.
- Trigram GIN indexes and `CREATE EXTENSION pg_trgm` live in hand-added SQL at the end of
  `apps/api/prisma/migrations/*/migration.sql`; Prisma's schema cannot express them, so a
  regenerated migration will drop them.
- The baseline throttle is 600/min because infinite scroll is request-heavy; login is 5/min.
  Tests that log in repeatedly must reuse cookies or run in their own spec file (each spec
  builds a fresh app with fresh throttler state).

### Frontend conventions

Follow the structure inherited from the `atlaslogix-task` boilerplate: `src/modules/<domain>/
{pages,components,services,validations}`, with data access as `use*` hooks in `services/`.
Shared UI primitives live in `src/components` and are re-exported from its barrel; design
tokens are in `src/styles/theme.css` (Tailwind 4 `@theme`) — add tokens there rather than
hardcoding colours. The session is an httpOnly cookie, so there is no token in JS: identity
comes from `useMe()`, and `useAxiosInstance` sets `withCredentials` with no auth header.
