# Architectural Decisions

## 1. Duplicate Prevention (Requirement R2)
* **Decision:** Client-side idempotency keys paired with a unique database constraint.
* **Implementation:** The UI generates a unique UUID when the order form mounts and forwards it via an `Idempotency-Key` HTTP header. The database `orders` table enforces a `UNIQUE` index on this key. Inserts execute via `ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`. If no row is returned, the backend fetches and serves the pre-existing order data alongside a `200 OK` status.
* **Alternative Considered:** Content hashing (deduplicating identical customer, items, and totals within a rolling 60-second window).
* **Reason for Rejection:** Legitimate consecutive identical phone orders would be erroneously blocked. Additionally, hardcoded time windows introduce arbitrary failure states.
* **Known Limitations:** Page reloads re-initialize the form state and generate a fresh UUID, meaning a post-reload resubmission will create a duplicate order. Idempotency keys are permanently stored and currently lack an expiration/pruning mechanism.

## 2. Server-Side Pagination (Requirement R1)
* **Decision:** Keyset (cursor-based) pagination over numeric `OFFSET`.
* **Implementation:** Queries utilize row-value comparisons to fetch pages: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 50`. This operation is highly performant under load, backed by a composite index on `(status, created_at DESC, id)`.
* **Alternative Considered:** Standard page-number navigation via `LIMIT` and `OFFSET`.
* **Reason for Rejection:** `OFFSET` query performance degrades linearly (O(N)) as dataset depths increase. Furthermore, real-time order entry causes item shifting across page boundaries, leading to skipped or repeated items during view transitions.
* **Trade-off:** Eliminates the ability to jump directly to arbitrary page locations (e.g., "Jump to Page 400"). This is an acceptable compromise since administrative agents rely on targeted search/filtering over manual deep browsing.

## 3. Stale Response Mitigation & Race Conditions (Requirement R1)
* **Decision:** Strict isolation via TanStack Query state tracking combined with network-level `AbortController` cancellation.
* **Implementation:** Every combination of user search inputs and filters is assigned a deterministic query key string. Modifying a filter triggers an explicit abort signal on the active network handshake via `AbortController`, ensuring the layout engine exclusively processes data associated with the current structural key state.
* **Alternative Considered:** Simple client-side input debouncing.
* **Reason for Rejection:** Debouncing limits network chatter but fails to address asynchronous race conditions. A slow, early database execution could settle *after* a fast, late database execution, overwriting the UI with outdated results.

## AI Toolkit Disclosure
* **Code Scaffolding:** Utilized Claude/Copilot to generate the boilerplate database seed shell script and initial Zod validation definitions, which were hand-refactored afterward.
* **Security & Auditing:** Prompted an AI assistant to evaluate `auth.ts`. The model flagged 4 core code flaws, while the query-string token exposure leak was caught via manual code review.
* **Logic Verification:** Formulated architectural paths independently; leveraged an AI chat to cross-validate edge-case behaviors on Decision #1.
