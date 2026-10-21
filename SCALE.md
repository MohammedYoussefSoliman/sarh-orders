# Scaling to 100× — what changes, what stays, what I would refuse

Today: 50,000 orders, a handful of agents, one Postgres instance, one API
process. The target here is **5 million orders and ~300 concurrent agents**.

What follows is ordered by when it would actually start to hurt, not by how
interesting it is.

---

## Change

**1. Trigram search degrades before anything else does.**
This is the first thing that breaks. At 50k, a selective term is a 0.18 ms
bitmap scan, but a *common* term makes the planner walk the ordered index and
filter instead — already 15 ms at this size, and that path scales with the table,
not with the match count. At 5M it is seconds.
→ Split search from browse: a dedicated endpoint backed by a `tsvector` column
with a GIN index for name/email prefix matching, and drop the leading wildcard
on email (`term%` instead of `%term%`) so a B-tree can serve it. If agents need
true fuzzy search across fields at that volume, it belongs in a search index
(OpenSearch), fed asynchronously — not in the orders table.

**2. Idempotency keys grow without bound.**
Every created order holds a key forever. At 5M rows that is a wide, pointless
column on the hottest table.
→ Move them to their own `idempotency_keys` table (key, order_id, request_hash,
created_at) with a 7-day TTL and a daily pruning job. Seven days is far longer
than any honest client retry, and the orders table loses two columns.

**3. One Postgres instance stops being enough for reads.**
Writes stay modest — orders arrive at human speed — but 300 agents scrolling and
filtering is read-heavy.
→ Add read replicas and route list/search queries to them. The list query is
already a pure read with no session state, so this is routing, not a rewrite.
The idempotent insert must stay on the primary: it depends on the unique index
seeing a consistent view, and a replica cannot give it that.

**4. Hard delete becomes soft delete plus an audit trail.**
Deleting real order data with no record of who did it is not acceptable at any
size; it is merely survivable at this one.
→ `deleted_at` plus an `order_events` table (order_id, actor_id, event, payload,
created_at). Every index gains a `WHERE deleted_at IS NULL` predicate. This is
listed as a change rather than a refusal because it is a migration, not a
redesign.

**5. "Revenue today" needs a timezone, not a date.**
Timestamps are UTC; agents are not. At 100× this becomes a reporting surface
rather than one number, and getting it wrong silently is the failure mode.
→ Store the business timezone once, aggregate on a rolling daily rollup table
rather than scanning orders per request.

**6. Sessions need revocation.**
8-hour tokens with no server-side invalidation means a stolen session stays live
for up to 8 hours. With 300 agents, "revoke this person's access now" becomes a
real operational request.
→ Short access token plus refresh token with a server-side store, or a session
table checked on each request against a cache.

---

## Keep

These are already right for 100×, and I would resist changing them:

- **Keyset pagination.** Its cost is independent of depth — page 80,000 costs
  what page 1 costs. This is the single decision that needs no revisiting.
- **The unique index as the duplicate guarantee.** It gets *stronger* under
  concurrency, not weaker, and it already works across multiple API instances.
  Nothing about 100× threatens it.
- **`LIMIT n+1` instead of `COUNT(*)`.** Exact total counts over a filtered 5M-row
  table are expensive and nobody needs them. If a count must be shown, it should
  be approximate (`reltuples`) and labelled as such.
- **The composite indexes.** They match the query predicates exactly; the shapes
  do not change with volume.
- **One modular monolith.** See below.
- **Shared Zod schemas.** The contract gets *more* valuable as more people touch
  the code.

---

## Refuse

**Sending the full table to the browser, or filtering client-side.** This is
already wrong at 50,000 and absurd at 5M. The virtualized table exists so the
*client* stays cheap; the server staying cheap is what the indexes are for.
Any proposal that moves filtering into the browser is a regression, not an
optimisation.

**Splitting into microservices because the table got bigger.** Row count is not
a reason to split a service. The bottleneck at 5M orders is the database, and
extracting an "orders service" that talks to the same Postgres multiplies
deployments and failure modes while solving none of it. I would extract a
service when a module needs a genuinely different scaling or deployment profile
— a notifications worker, a reporting pipeline — not before, and not for a team
of three.

**Bulk hard-delete of cancelled orders to keep the table small.** Postgres is
fine at 5M rows with the right indexes; the table size is not the problem. This
trades recoverable business records for a performance gain that the indexes
already provide.

**Caching the orders list behind a shared cache.** The data is per-user,
filtered, and changes constantly, and a cached page would defeat the
stale-result guarantee that R1 is specifically about. The list endpoint already
sends `Cache-Control: no-store` deliberately.
