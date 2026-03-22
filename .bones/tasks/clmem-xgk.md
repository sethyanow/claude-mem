---
id: clmem-xgk
title: 'Complete SessionStore decomposition: delegate CRUD and queries to extracted modules'
status: closed
type: task
priority: 1
parent: clmem-cj3
---






## Context
Parent epic clmem-cj3 SC4. SessionStore is 1605 lines. Phase 1 extracted sub-modules to `observations/`, `summaries/`, `sessions/`, `timeline/`, `migrations/` — but SessionStore wasn't refactored to delegate to them. Migrations delegate to `MigrationRunner` (line 38). Imports delegate to `./import/bulk.js` (lines 1529-1604). All observation CRUD, summary CRUD, session queries, and timeline queries remain inline. Extracted modules have zero callers outside re-export facades.

Current state:
- `observations/store.ts` (104 lines) — has `storeObservation`, `computeObservationContentHash`, `findDuplicateObservation`
- `observations/get.ts` (113 lines) — has observation retrieval functions
- `observations/recent.ts` (44 lines), `observations/files.ts` (53 lines)
- `summaries/store.ts` (59 lines), `summaries/get.ts` (87 lines), `summaries/recent.ts` (78 lines)
- `sessions/create.ts` (84 lines), `sessions/get.ts` (107 lines)
- `timeline/queries.ts` (219 lines)

SessionStore has 39 methods (LSP-verified). The work is: refactor each method to delegate to the extracted module function, then remove the inline implementation. The extracted functions take `db: Database` as first param (functional style), so delegation is `return storeObservation(this.db, ...)`.

**Methods WITH extracted counterparts (delegate directly):**
- `storeObservation` → `observations/store.ts:storeObservation`
- `getObservationById` → `observations/get.ts:getObservationById`
- `getObservationsByIds` → `observations/get.ts:getObservationsByIds`
- `getObservationsForSession` → `observations/get.ts:getObservationsForSession`
- `getRecentObservations` → `observations/recent.ts:getRecentObservations`
- `getAllRecentObservations` → `observations/recent.ts:getAllRecentObservations`
- `getFilesForSession` → `observations/files.ts:getFilesForSession`
- `createSDKSession` → `sessions/create.ts:createSDKSession`
- `updateMemorySessionId` → `sessions/create.ts:updateMemorySessionId`
- `getSessionById` → `sessions/get.ts:getSessionById`
- `getSdkSessionsBySessionIds` → `sessions/get.ts:getSdkSessionsBySessionIds`
- `getRecentSessionsWithStatus` → `sessions/get.ts:getRecentSessionsWithStatus`
- `getSessionSummaryById` → `sessions/get.ts:getSessionSummaryById`
- `storeSummary` → `summaries/store.ts:storeSummary`
- `getSummaryForSession` → `summaries/get.ts:getSummaryForSession`
- `getSessionSummariesByIds` → `summaries/get.ts:getSummariesByIds`
- `getRecentSummaries` → `summaries/recent.ts:getRecentSummaries`
- `getRecentSummariesWithSessionInfo` → `summaries/recent.ts:getRecentSummariesWithSessionInfo`
- `getAllRecentSummaries` → `summaries/recent.ts:getAllRecentSummaries`
- `getTimelineAroundObservation` → `timeline/queries.ts:getTimelineAroundObservation`
- `getTimelineAroundTimestamp` → `timeline/queries.ts:getTimelineAroundTimestamp`
- `getAllProjects` → `timeline/queries.ts:getAllProjects`

**Methods WITHOUT extracted counterparts (extract first, then delegate):**
- `ensureMemorySessionIdRegistered` → target: `sessions/create.ts`
- `getRecentSummaries` (line 89) — wait, already listed above
- `getLatestUserPrompt` → target: new `prompts/get.ts`
- `getAllRecentUserPrompts` → target: new `prompts/get.ts`
- `getPromptById` → target: new `prompts/get.ts`
- `getPromptsByIds` → target: new `prompts/get.ts`
- `getUserPrompt` → target: new `prompts/get.ts`
- `getUserPromptsByIds` → target: new `prompts/get.ts`
- `getPromptNumberFromUserPrompts` → target: new `prompts/get.ts`
- `saveUserPrompt` → target: new `prompts/store.ts`
- `storeObservations` → target: `observations/store.ts` (transactional)
- `storeObservationsAndMarkComplete` → target: `observations/store.ts` (transactional)
- `getOrCreateManualSession` → target: `sessions/create.ts`

**Exempt from delegation (remain inline):**
- `constructor` — DB init + pragmas + migration runner
- `close` — single `this.db.close()` call
- Import methods — already delegated to `./import/bulk.js`

## Requirements
1. Refactor SessionStore methods to delegate to extracted sub-module functions
2. Remove inline implementations from SessionStore once delegation is verified
3. Delete orphaned extracted functions that have no corresponding SessionStore method (if any)
4. SessionStore becomes a thin facade: constructor + delegation methods

## Success Criteria
- [x] No inline SQL in SessionStore (except constructor pragmas and `close()`) — all queries live in sub-modules. Verified: structural test passes, no `.prepare(` in methods.
- [x] All existing tests pass (1236 pass, 3 skip, 7 fail — the 7 failures are worker-json-status clmem-kqm, not caused by this task. +2 from new structural test)
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] No orphaned extracted functions with zero callers (R3) — all sub-module functions called by SessionStore. Transactional methods live in transactions.ts (pre-existing, called via barrel export).

## Anti-Patterns
- NO behavior changes — delegation must preserve identical runtime behavior
- NO changing method signatures on SessionStore — callers must not need updating
- NO new abstractions — SessionStore delegates to plain functions, no interfaces or factories
- NO splitting into multiple classes — SessionStore stays as one facade class
- NO skipping complex methods — delegating only simple getters while leaving transactional/complex methods inline defeats the purpose. All methods delegate (except constructor/close).
- NO breaking transaction boundaries — `storeObservations` and `storeObservationsAndMarkComplete` use `db.transaction()`. The extracted function must own the full transaction, not receive individual operations.

## Key Considerations
- ~13 methods need extraction before delegation (see inventory above). The largest new module is `prompts/get.ts` (~7 methods). Create `prompts/store.ts` for `saveUserPrompt`.
- `storeObservations` (~130 lines) and `storeObservationsAndMarkComplete` (~115 lines) use `db.transaction()`. The extracted function must take `db: Database` and wrap the entire operation in `db.transaction()` — don't split the transaction across caller/callee.
- `getTimelineAroundObservation` and `getTimelineAroundTimestamp` already exist in `timeline/queries.ts` — delegation is direct.
- `ensureMemorySessionIdRegistered` has read-then-write conditional logic (FK registration for Issue #846). Extract as-is to `sessions/create.ts` — the logic is self-contained.
- `getOrCreateManualSession` has conditional create-or-fetch logic. Extract to `sessions/create.ts`.
- Extracted module functions already use `db: Database` as first param. New extractions must follow the same pattern.
- Several extracted modules have unused `logger` imports (TS6133 warnings in observations/get.ts, summaries/get.ts, observations/recent.ts, observations/files.ts, summaries/store.ts, sessions/create.ts). Clean these up during extraction to keep `tsc --noEmit` clean.
- Name mismatches between SessionStore and extracted modules: `getSessionSummariesByIds` → `getSummariesByIds`, `getSessionSummaryById` (sessions/get.ts) vs `getSummaryById` (summaries/get.ts). Verify which extracted function matches which SessionStore method — don't delegate to the wrong one.

### Failure Catalog (Adversarial Planning)

**State Corruption: `storeObservationsAndMarkComplete` cross-table transaction**
- Assumption: Extracted function preserves atomicity across observations + summaries + pending_messages UPDATE
- Betrayal: If extraction moves the `pending_messages` UPDATE outside the transaction (e.g., into a separate function call or after the transaction returns), atomicity is lost
- Consequence: Observations stored but message not marked complete → reprocessing on crash → duplicate observations (this is the exact bug the transaction was introduced to fix)
- Mitigation: Extracted function must contain the full `db.transaction()` body including the pending_messages UPDATE at lines 1110-1118. Verify: search for `pending_messages` inside the extracted function to confirm it's within the transaction callback.

**Temporal Betrayal: Internal method cross-calls after delegation**
- Assumption: `getTimelineAroundTimestamp` (line 1210) calls `this.getTimelineAroundObservation`
- Betrayal: After delegation, SessionStore.getTimelineAroundTimestamp → extracted getTimelineAroundTimestamp → extracted getTimelineAroundObservation (bypasses SessionStore.getTimelineAroundObservation entirely)
- Consequence: Functionally identical now (both paths reach the same extracted code). BUT if someone later adds interceptor logic to SessionStore.getTimelineAroundObservation, the timestamp path bypasses it.
- Mitigation: This is the correct facade pattern — extracted modules are the authority, SessionStore is routing. No action needed, but document that internal cross-calls go direct in the extracted modules.

**Input Hostility: Name mismatch delegation trap**
- Assumption: Each SessionStore method maps to exactly one extracted function with matching semantics
- Betrayal: `getSessionSummaryById` exists in BOTH `sessions/get.ts` AND as `getSummaryById` in `summaries/get.ts`. They may have different SQL queries, return types, or parameter handling despite similar names.
- Consequence: Delegating to the wrong one compiles (similar enough types) but returns incorrect or incomplete data at runtime
- Mitigation: Before delegating, diff the SessionStore inline implementation against BOTH candidate extracted functions line-by-line. Only one will match the SQL query exactly. Use that one.

**Temporal Betrayal: `this.db` → `db` parameter in transaction closures**
- Assumption: Inside `db.transaction(() => { ... })`, references to `this.db.prepare(...)` and `db.prepare(...)` are equivalent
- Betrayal: They are equivalent when `db === this.db`. But the extracted function receives `db` as a parameter — if a future caller passes a different Database instance, the transaction runs on that db instead.
- Consequence: No current risk (SessionStore always passes `this.db`). Structural safety from single-db architecture.
- Mitigation: No action needed. Document that extracted functions assume single-db usage.

**State Corruption: `_pendingStore` parameter in `storeObservationsAndMarkComplete`**
- Assumption: The `_pendingStore: PendingMessageStore` parameter is used for the pending_messages update
- Betrayal: It's NOT used — the update is done via raw SQL on `this.db`. The parameter is dead code (underscored). The extracted function should NOT add a PendingMessageStore dependency.
- Consequence: If agent "improves" the extraction by routing through PendingMessageStore instead of raw SQL, behavior changes (different SQL, different error handling)
- Mitigation: Anti-pattern: NO behavior changes. Copy the raw SQL approach exactly. Keep the unused `_pendingStore` parameter in the SessionStore signature (callers pass it) but the extracted function doesn't need it.

## Log

- [2026-03-22T17:32:44Z] [Seth] SRE refinement (fresh session). Findings: (1) Added full method inventory — 22 methods have extracted counterparts, ~13 need extraction first (prompts/ is entirely new). (2) Added SC for R3 orphaned function cleanup. (3) Updated test baseline to 1234 pass/7 fail (worker-json-status, not process-registry). (4) Adversarial catalog: cross-table transaction atomicity in storeObservationsAndMarkComplete, name mismatch delegation trap (getSessionSummaryById vs getSummaryById), _pendingStore dead parameter trap. (5) Added anti-patterns: no skipping complex methods, no breaking transactions. (6) Corrected epic SC3 — process-registry tests pass now, 7 failures are worker-json-status.
