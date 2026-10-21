# Architectural Decisions

Three decisions that shaped the build, the alternative each one beat, and what
it costs.

---

## 1. Duplicate prevention: idempotency key + unique index (R2)

**Decision.** The client mints a UUID when the order form opens and sends it as
an `Idempotency-Key` header. The `orders` table has a `UNIQUE` index on that
key. Inserts run `ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`; when
no row comes back, the server loads the existing order and returns it with
`200 OK` instead of `201`. A SHA-256 hash of the canonical body is stored
alongside, so the same key with a *different* body is a 422 rather than a
silently discarded order.

**Why the index and not the code.** The guarantee is the constraint itself. Two
concurrent inserts both reach the index; the second blocks until the first
commits, then takes the conflict branch. Nothing depends on a lock, a queue, or
the two requests landing on the same process — it holds across restarts and
across any number of API instances, which is the property I actually wanted.

**Alternative rejected: content hashing within a rolling time window.**
Deduplicating identical customer/items/total within, say, 60 seconds. Rejected
because two genuine identical phone orders a minute apart are an ordinary thing
in an order desk, and that design silently throws the second one away — a wrong
answer that nobody notices until a customer complains. The window length is also
arbitrary: any value is wrong for some caller, and it fails differently under
load, which is the worst kind of bug to debug.

**Cost and limits.**
- Keys accumulate forever; there is no TTL or pruning job yet. At current volume
  that is a slowly growing text column, not a problem, but it is unbounded.
  (SCALE.md: move them to their own table with a 7-day TTL.)
- The client half has to be disciplined. The key lives in `sessionStorage` with
  the draft so a reload resubmits under the same key, and is retired only after
  the server confirms. An earlier draft of this file listed "reload creates a
  duplicate" as an accepted limitation; it is fixed, and the browser test for it
  is in the README.
- A deliberate 422 case exists (same key, changed body). It is the right
  behaviour, but it is a state the UI has to handle rather than ignore.

---

## 2. Keyset pagination over `LIMIT`/`OFFSET` (R1)

**Decision.** Pages are fetched by row-value comparison against the last row of
the previous page — `WHERE (created_at, id) < ($value, $id) ORDER BY created_at
DESC, id DESC LIMIT 51` — backed by composite indexes that match the predicate
exactly. The cursor is an opaque base64url blob carrying the sort field, its
value, and the tiebreaker id. One extra row per page reveals whether a next page
exists, so no `COUNT(*)` is needed.

**Alternative rejected: page numbers via `OFFSET`.** Two reasons, and the second
matters more than the usual one. `OFFSET` degrades linearly with depth, which is
the familiar objection. But it is also *wrong* on a table that changes while you
read it: new orders arrive at the top, every row shifts down one, and the row
that was #50 becomes #51 and is never shown. Users silently miss orders. Keyset
pages are anchored to a row, not a count, so insertions cannot shift the window.

**Cost.** No jumping to an arbitrary page. Agents reach orders by search and
filter rather than by paging to page 400, so this was an easy trade — and a page
number over a table that changes under you was never meaningful in the first
place. It also means the cursor must be validated: a cursor issued for one sort
field is rejected against another, rather than quietly returning a wrong page.

**Measured.** At 50,000 orders: p50 2.3 ms, p99 6.3 ms end-to-end, flat with
depth (a cursor 40,000 rows deep plans as an index-only scan at 3.99 ms).
Walking every page of five query shapes produced zero duplicate and zero
skipped rows.

---

## 3. Stale results: query-key isolation + request cancellation (R1)

**Decision.** Every combination of search, status, sort field and direction
produces its own TanStack Query key, so each is a separate cache entry and a
response can only be written under the key it was requested for. On top of that,
the `signal` React Query supplies is forwarded to axios, so changing a filter
aborts the superseded request at the network level.

**Alternative rejected: debouncing the inputs.** Debouncing is in the build — the
search box waits 300 ms — but it is a *chatter* optimisation and I was careful
not to treat it as the fix. Debouncing reduces how many requests are made; it
does nothing about the order they come back in. A slow early query can still
settle after a fast later one and overwrite the UI with results for a filter the
user has already left. That is precisely the bug, so a design that only debounces
is a design that still has it, just less often — and "less often" is worse than
"never", because it survives testing and shows up in production.

**Why both mechanisms.** Cancellation alone is not sufficient: an abort is a
request to stop, and a response already in flight can still arrive. Key
isolation alone is correct but wasteful, leaving doomed requests to run.
Together, the key makes a stale render *impossible* and the abort stops the
pointless work.

**Cost.** Every input that affects results must be in the key — a new filter
added beside the key rather than inside it would reintroduce the bug. That is a
standing maintenance obligation, so the reasoning sits in a comment on the key
factory rather than in a commit message. While the new filter loads, the old
rows stay on screen dimmed (`keepPreviousData`) rather than flashing empty.

**Verified** in a real browser at 900 ms latency, switching status five times at
180 ms intervals: four superseded requests cancelled, one completed, and only
rows matching the final filter on screen.

---

## AI usage

I used Claude Code (Opus) as a working tool throughout this build, driving it
from a written plan I had made beforehand. Being specific about where it helped
and where it did not:

**Where it did the work.** Scaffolding the monorepo, the Prisma schema and
migration, the seed generator, and the bulk of the React components from the
design system I pointed it at. The three documentation files were drafted by it
from the decisions I had already made, then edited.

**Where it found things I had not.** Running the keyset walk across five query
shapes and checking for duplicate/skipped rows was its suggestion, and it is
what turned "the pagination looks right" into a measured claim. The same for
driving a real browser at a throttled connection to prove the rapid-filter case
rather than asserting it.

**Where it was wrong, and I corrected it.**
- It wired a global `ValidationPipe` into the Nest bootstrap, which needs
  `class-validator` — a package this project deliberately does not use, since
  validation is Zod shared with the client. It was removed.
- The web `typecheck` script was passing while checking *nothing*: the
  boilerplate's `tsconfig.json` is a solution file with `"files": []`, so
  `tsc --noEmit` silently no-opped. This was caught by checking how many files
  the program actually contained and injecting a deliberate type error, not by
  trusting the green output.
- The initial throttle (120 requests/minute) was too tight for an
  infinite-scrolling list and broke under its own test run. Raised to 600, with
  login still at 5.
- It left the actions column clipping its own delete button; caught by looking
  at a screenshot of the running app rather than at the code.

**What I did not delegate.** The three decisions above, the rejected
alternatives and the reasoning for each are mine — they came from the plan, not
from the model. The claim that trigram indexes are *not* always used by the
planner is a measured finding I chose to publish rather than quietly drop,
because it is the honest version of the performance story.
