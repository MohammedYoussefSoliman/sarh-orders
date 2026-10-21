# Orders Console

An order management console: agents search and browse orders, and create new ones.
NestJS + PostgreSQL + React in a pnpm monorepo.

Two guarantees drive most of the design, and both are enforced by the database
rather than by application code:

- **R1** — rapidly changing a filter never shows results from a previous filter,
  and paging stays fast at any depth.
- **R2** — submitting the same order twice, in parallel or after a reload,
  creates exactly one order.

---

## Setup

Requires Node 20+, pnpm 10+, and Docker.

```bash
git clone <this-repo> && cd sarh-orders
pnpm install
cp .env.example .env          # then set JWT_SECRET (see below)
pnpm db:up                    # Postgres 16 in Docker, waits until healthy
pnpm db:migrate               # schema + indexes + pg_trgm
pnpm seed                     # 2 users and 50,000 orders (~6s)
pnpm dev                      # API :3000, web :5180
```

Open <http://localhost:5180>.

`JWT_SECRET` has no default. The API refuses to boot without one of at least
32 characters — a missing secret is a startup failure, not a silent fallback:

```bash
openssl rand -base64 48
```

### Seeded accounts

| Email | Password | Role | Can delete orders |
| --- | --- | --- | --- |
| `admin@sarh.test` | `Admin123!` | admin | yes |
| `agent@sarh.test` | `Agent123!` | agent | no |

### Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | API and web together |
| `pnpm db:up` / `pnpm db:down` | Start / stop Postgres |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:reset` | Drop, re-migrate, re-seed |
| `pnpm seed` | Re-seed (`SEED_ORDER_COUNT=200000 pnpm seed` for more) |
| `pnpm test:e2e` | API end-to-end tests, including the R2 proof |
| `pnpm proof:duplicates [n]` | Fire n parallel identical creates and count the orders |
| `pnpm typecheck` / `pnpm lint` | Across all workspaces |

---

## Architecture

One NestJS modular monolith over one PostgreSQL database; one React app that
reaches it through the Vite dev proxy, so the browser sees a single origin.

```
apps/api       NestJS — auth, orders, Prisma, raw SQL for the two hot queries
apps/web       React 19 + Vite + Tailwind 4 + TanStack Query
packages/shared  Zod schemas + types, imported by BOTH sides
```

`packages/shared` is the contract. The same `createOrderSchema` validates the
form in the browser and the request body on the server, so the two cannot drift
apart.

Prisma owns the schema, migrations and ordinary reads. The list query and the
idempotent insert are raw SQL via `Prisma.sql`, because both need SQL that
Prisma's query builder does not express: row-value comparison and
`ON CONFLICT … DO NOTHING RETURNING`.

---

## R1 — paging and stale results

### Keyset pagination, not OFFSET

Pages are fetched with a row-value comparison against the last row of the
previous page:

```sql
WHERE (created_at, id) < ($cursor_value, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 51
```

This matches the composite index exactly, so every page is an index range scan
starting at the cursor. `OFFSET` was rejected for two reasons: its cost grows
linearly with depth, and it *skips and repeats rows* when new orders arrive
while the user is paging — the row that was #50 shifts to #51 and is never seen.

The cursor is base64url of `{sort field, sort value, id}`, opaque to the client.
It carries the field it was issued for, so pairing a `createdAt` cursor with an
amount sort is rejected rather than silently returning a wrong page.

One extra row (`LIMIT 51` for a page of 50) tells us whether a next page exists,
which avoids a `COUNT(*)` over the whole filtered set.

**The trade-off:** you cannot jump to an arbitrary page number. That is
acceptable here because agents reach orders by searching and filtering, not by
paging to page 400 — and a page number over a table that changes under you is
not meaningful anyway.

### Indexes

| Index | Serves |
| --- | --- |
| `orders (created_at DESC, id DESC)` | Default sort, no filter |
| `orders (status, created_at DESC, id DESC)` | Status filter + date sort |
| `orders (total_amount DESC, id DESC)` | Amount sort |
| `orders (status, total_amount DESC, id DESC)` | Status filter + amount sort |
| `orders USING GIN (lower(customer_name) gin_trgm_ops)` | `ILIKE '%term%'` on name |
| `orders USING GIN (lower(customer_email) gin_trgm_ops)` | `ILIKE '%term%'` on email |
| `orders (idempotency_key) UNIQUE` | The R2 guarantee |
| `order_items (order_id)` | Loading an order's items |

Trigram indexes need `CREATE EXTENSION pg_trgm`, which lives in the migration.
A B-tree cannot serve a leading-wildcard `LIKE`, so without them substring
search is a sequential scan of every order.

### Measured at 50,000 orders

`EXPLAIN ANALYZE`, and end-to-end latency walking 100 pages per query shape:

| Query shape | Plan | Execution |
| --- | --- | --- |
| Default sort, cursor 40,000 rows deep | Index Only Scan, `orders_created_at_id_idx` | 3.99 ms |
| Status filter + date sort | Index Only Scan, `orders_status_created_at_id_idx` | 0.06 ms |
| Status filter + amount sort | Index Only Scan, `orders_status_total_amount_id_idx` | 0.10 ms |
| Selective search term | Bitmap Index Scan on both trigram indexes | 0.18 ms |

End-to-end, including HTTP and JSON: **p50 2.3 ms, p99 6.3 ms**, and the depth
of the cursor does not change that — page 100 costs what page 1 costs. Walking
every page of a filtered set (70 pages, 3,482 rows) produced **zero duplicate
and zero skipped rows**, as did all five query shapes tested.

**An honest note on the trigram indexes:** for a *common* search term the
planner prefers walking `orders_created_at_id_idx` and filtering, because it
only needs 51 ordered rows — the worst case measured that way was 15 ms. The
GIN indexes earn their place on selective terms, where they turn a full scan
into a 0.18 ms bitmap scan. Both paths are fast at this size; see SCALE.md for
where that stops being true.

### Stale results

Changing a filter must never leave the previous filter's rows on screen. Two
mechanisms, and both are needed:

1. **The query key embeds every filter** — search, status, sort field,
   direction. Each combination is a separate TanStack Query cache entry, so a
   response can only ever be written under the key it was requested for. A late
   response for an abandoned filter lands on that filter's entry and is never
   rendered.
2. **Requests are aborted.** The `signal` TanStack Query provides is forwarded
   to axios, so changing a filter cancels the superseded request at the network
   level.

The search box is also debounced by 300 ms, but **debouncing is not the
guarantee** — it reduces how many requests are made, not the order they come
back in. A slow early query can still settle after a fast later one, which is
exactly the bug. Debouncing alone would have been the wrong answer.

Verified in a real browser on a throttled connection (900 ms latency, 50 kb/s),
switching status five times at 180 ms intervals — faster than the network could
answer:

```
request outcomes:
   CANCELLED  status=pending    CANCELLED  status=delivered
   CANCELLED  status=paid       completed  status=cancelled
   CANCELLED  status=shipped

selected filter    : cancelled
statuses on screen : ['cancelled'] (19 rows)   -> no stale rows
```

While the new filter loads, the previous rows stay on screen dimmed and
non-interactive (`keepPreviousData`), rather than flashing an empty table.

### Rendering 50,000 rows

The table is virtualized with `react-window` (`FixedSizeList`, 52 px rows), so
only the visible rows exist in the DOM. The header sits outside the scrolling
list and shares one `grid-template-columns` with every row, which keeps columns
aligned under a fixed header. Rows are memoised and receive data through
`itemData` rather than closures, so scrolling does not re-render them.

Measured: after 25 fast scroll jumps, **1,300 rows loaded, 26 in the DOM**.
`react-window` cannot emit real `<tr>` elements, so rows are divs carrying
`role="table"/"row"/"cell"` to keep the table semantics for screen readers.

**On pinning `react-window` v1 while v2 exists.** v1.8.11 is the last v1 release
(Dec 2024), and v2 is where development now happens. v1 stays because it is
verified here rather than merely allowed: its React 19 peer support was added
deliberately in that release, which shipped *after* React 19, and exercising the
list hard under `StrictMode` — scrolling, filtering, sorting, remounting —
produces zero deprecation or legacy-API warnings. v2 renames both APIs this
component is built on (`FixedSizeList`, `onItemsRendered`), so adopting it means
rewriting `VirtualTable` and re-running every browser check above, for no
behaviour this app needs. The upgrade is a contained one-file change when it is
worth making; the pin is `^1.8.11`, so it will not drift onto v2 silently.

---

## R2 — no duplicate orders

The client mints a UUID when the order form opens and sends it as
`Idempotency-Key`. The server:

1. Rejects a missing or non-UUID key with 400.
2. Validates the body with the shared schema and **recomputes the total from the
   items**, rejecting a client-supplied total that disagrees.
3. Hashes the canonical body (SHA-256).
4. Inserts with `ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`.
5. If a row came back, writes the items and returns **201**.
6. If not, the key already exists: same body hash returns the original order
   with **200**; a *different* hash returns **422**.

**The guarantee is the UNIQUE index, not the application logic.** Two concurrent
inserts both reach the index; the second blocks until the first commits, then
takes the conflict branch. No lock, queue, or time window is involved, so it
holds across restarts and across any number of API instances.

A content hash over a rolling time window was rejected: two genuine identical
phone orders a minute apart are a real thing, and that design silently discards
the second one.

### Proof

`pnpm proof:duplicates 10` — ten identical requests in parallel:

```
  request 1  -> 201 created   order 2c293be9-6507-40bf-81e2-7a9959e673fa
  request 2  -> 200 replayed  order 2c293be9-6507-40bf-81e2-7a9959e673fa
  ... (8 more, all 200, all the same id)

  created: 1   replayed: 9   distinct order ids: 1
  PASS — 10 requests, exactly one order created.
```

`pnpm test:e2e` asserts the same through the real HTTP stack and database
(16 tests): two racing requests, ten racing requests, a later retry, key reuse
with a changed body, a missing key, and a mismatched total.

### Surviving a page reload

The key is held in `sessionStorage` alongside the draft, so a reload mid-submit
resubmits under the **same** key and the server replays the original order. The
key is retired only after the server confirms (201 or 200); a network error
keeps it, so the retry is still a replay.

This closes a real hole: keeping the key only in component state mints a fresh
UUID on reload, which would create a duplicate at exactly the moment a user is
most likely to retry.

---

## Security review

The ten problems found in the handed-over auth code, and what replaced them.

| # | Problem | Severity | Fix |
| --- | --- | --- | --- |
| 1 | `jwt.decode` never checks the signature — anyone can forge `{role:"admin"}` | **Critical** | `passport-jwt` verifies; `algorithms: ['HS256']` pinned |
| 2 | Secret hardcoded in source and committed | **Critical** | `JWT_SECRET` from env, validated at boot; app refuses to start without it |
| 3 | Admin check lived only in a React `<AdminOnly>` component | **Critical** | `RolesGuard` + `@Roles('admin')` on the server |
| 4 | Passwords stored and compared in plain text | **Critical** | bcrypt hashing, `bcrypt.compare` on login |
| 5 | Tokens signed without `exp` never expire | High | `expiresIn: 8h`, `ignoreExpiration: false` |
| 6 | `req.query.token` accepted — leaks into logs, history, `Referer` | High | Removed; cookie is the only source |
| 7 | No rate limit on `/login` | High | 5 attempts per minute per IP |
| 8 | `split(" ")[1]` ignores the auth scheme | Medium | Passport's scheme-aware extractor |
| 9 | Delete: unvalidated id, no 404, hard delete with no audit | Medium | `ParseUUIDPipe`, proper 404; audit noted in SCALE.md |
| 10 | Untyped `req`/`res`/payload, auth logic inline in handlers | Medium | Typed `AuthUser`, `@CurrentUser()`, logic in `AuthService` |

Beyond the list: the JWT guard is applied **globally**, so a new route is
authenticated unless it explicitly opts out with `@Public()` — forgetting a
decorator fails closed rather than open. Login returns the same error for an
unknown email and a wrong password, and hashes anyway on a missing user so
response time is not an oracle for which addresses exist. `helmet` is on, and
the sort/direction parameters are enums mapped through a whitelist, so nothing
from the request ever reaches the SQL text.

Eight of the ten are covered by tests in `apps/api/test/auth*.e2e-spec.ts`.

### Token storage

The JWT lives in an **httpOnly, SameSite=Strict cookie** (`Secure` in
production). httpOnly means page script — including an injected payload —
cannot read or exfiltrate it, which `localStorage` cannot offer: anything in
`localStorage` is one XSS away from being stolen outright. SameSite=Strict
means the browser will not attach it to cross-site requests, which closes CSRF
without a separate token. Verified in a real browser: after signing in,
`document.cookie` is `""`.

What this does **not** do: it does not stop an XSS payload from making requests
*as* the user while the page is open — httpOnly protects the token, not the
session. And because there is no server-side revocation, a stolen session stays
valid until `exp` (8 hours). Revocation would need a server-side session store
or a short access token plus a refresh token; at this scale the 8-hour window
was judged an acceptable trade, and it is the first thing I would change if
these were real customer orders.

---

## What I skipped, and why

- **No refresh tokens or server-side revocation.** 8-hour expiry instead. Noted
  above as the first thing to add.
- **No order detail page.** The list, filters and create flow are what R1 and R2
  are about; a detail view adds surface without testing either. The API serves
  `GET /orders/:id` with items, so the screen is a small addition.
- **No order editing or status transitions.** Not in the requirements, and a
  status workflow deserves its own state machine rather than a dropdown.
- **Hard delete, not soft delete.** Called out in SCALE.md: real order data
  wants an audit trail, and that is a schema change, not a patch.
- **Frontend unit tests.** The browser-level checks above (rapid filter, create,
  reload, virtualization, role enforcement) were run against the real app, and
  the API's 16 e2e tests cover the guarantees. Component tests were the thing I
  dropped when the clock ran down; the boilerplate's Vitest setup is removed
  rather than left half-wired.
- **Idempotency keys are never pruned.** They accumulate forever. See SCALE.md.

## Product question

> *Agents keep asking for "revenue today". What do you build?*

I would ask which day they mean before building anything, because the orders are
timestamped in UTC and the agents are not. "Today" for a Riyadh agent ends three
hours before UTC midnight, so the obvious implementation silently reports the
wrong number for part of every day.

Assuming it is the business's local day: a single `GET /orders/stats` returning
today's order count and summed total for a given timezone, rendered as two
figures above the list. It is a `SUM` over a date range, served by an index on
`(created_at)` — cheap now, and cheap to keep correct by storing the timezone
once rather than at each call site.

I would also ask whether cancelled orders count, since that changes the number
more than any of the engineering does.
