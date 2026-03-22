---
id: clmem-xgk
title: 'Complete SessionStore decomposition: delegate CRUD and queries to extracted modules'
status: active
type: task
priority: 1
owner: Seth
parent: clmem-cj3
---




## Context
Parent epic clmem-cj3 SC4. SessionStore is 1605 lines (verified). Phase 1 extracted sub-modules to `observations/`, `summaries/`, `sessions/`, `timeline/`, `prompts/`, `migrations/` — but SessionStore wasn't refactored to delegate to them. Migrations delegate to `MigrationRunner` (line 38). Imports delegate to `./import/bulk.js` (lines 1529-1604, already delegating). All observation CRUD, summary CRUD, session queries, prompt queries, and timeline queries remain inline. Extracted modules have zero callers outside re-export facades (verified via LSP findReferences).

### Verified Module Inventory (SRE-verified 2026-03-22)
- `observations/store.ts` (104 lines) — `storeObservation`, `computeObservationContentHash`, `findDuplicateObservation`
- `observations/get.ts` (113 lines) — `getObservationById`, `getObservationsByIds`, `getObservationsForSession`
- `observations/recent.ts` (44 lines) — `getRecentObservations`
- `observations/files.ts` (53 lines) — `getFilesForSession`
- `summaries/store.ts` (59 lines) — `storeSummary`
- `summaries/get.ts` (87 lines) — `getSummaryForSession`, `getSummaryById`, `getSummariesByIds`
- `summaries/recent.ts` (78 lines) — `getRecentSummaries`, `getRecentSummariesWithSessionInfo`, `getAllRecentSummaries`
- `sessions/create.ts` (84 lines) — `createSDKSession`
- `sessions/get.ts` (107 lines) — `getSessionById`, `getSdkSessionsBySessionIds`, `getRecentSessionsWithStatus`
- `timeline/queries.ts` (219 lines) — `getTimelineAroundTimestamp`, `getTimelineAroundObservation`, `getAllProjects`
- `prompts/store.ts` (29 lines) — `saveUserPrompt`
- `prompts/get.ts` (169 lines) — `getUserPrompt`, `getPromptById`, `getPromptsByIds`, `getUserPromptsByIds`, `getLatestUserPrompt`, `getPromptNumberFromUserPrompts`, `getAllRecentUserPrompts`
- `transactions.ts` (255 lines) — `storeObservations`, `storeObservationsAndMarkComplete`

### Methods Already Delegating
- `importSdkSession`, `importSessionSummary`, `importObservation`, `importUserPrompt` — delegate to `import/bulk.ts`
- Constructor — delegates migrations to `MigrationRunner`

### Methods Needing Extraction First (no extracted counterpart exists)
- `ensureMemorySessionIdRegistered` — 22 lines, session concern → extract to `sessions/create.ts` or `sessions/get.ts`
- `getOrCreateManualSession` — 23 lines, session concern → extract to `sessions/create.ts`

### Name Mismatch to Resolve
- SessionStore method `getSessionSummariesByIds` → extracted function is `getSummariesByIds` in `summaries/get.ts` (same logic, different name). Delegate as `return getSummariesByIds(this.db, ids, options)`.

### Trivial Methods (no delegation needed)
- `close()` — just `this.db.close()`, no SQL, stays inline

## Requirements
1. Refactor SessionStore methods to delegate to extracted sub-module functions
2. Remove inline implementations from SessionStore once delegation is verified
3. Delete orphaned extracted functions that have no corresponding SessionStore method (if any)
4. SessionStore becomes a thin facade: constructor + delegation methods

## Implementation
1. Extract `ensureMemorySessionIdRegistered` to `sessions/create.ts` (or `sessions/get.ts`) as standalone function taking `(db: Database, sessionDbId: number, memorySessionId: string)`
2. Extract `getOrCreateManualSession` to `sessions/create.ts` as standalone function taking `(db: Database, project: string)`
3. For each remaining inline method (~33 methods), replace the body with a delegation call: `return extractedFunction(this.db, ...args)`. Work through one domain at a time:
   - Observations (storeObservation, getObservationById, getObservationsByIds, getObservationsForSession, getRecentObservations, getAllRecentObservations, getFilesForSession)
   - Summaries (storeSummary, getSummaryForSession, getRecentSummaries, getRecentSummariesWithSessionInfo, getAllRecentSummaries, getSessionSummariesByIds→getSummariesByIds, getSessionSummaryById→getSummaryById)
   - Sessions (createSDKSession, updateMemorySessionId, getSessionById, getSdkSessionsBySessionIds, getRecentSessionsWithStatus, ensureMemorySessionIdRegistered, getOrCreateManualSession)
   - Prompts (saveUserPrompt, getUserPrompt, getLatestUserPrompt, getPromptById, getPromptsByIds, getUserPromptsByIds, getAllRecentUserPrompts, getPromptNumberFromUserPrompts)
   - Timeline (getTimelineAroundTimestamp, getTimelineAroundObservation, getAllProjects)
   - Transactions (storeObservations, storeObservationsAndMarkComplete)
4. After each domain, run the relevant domain test file + session_store.test.ts to verify no regressions
5. Verify parameter signatures match between SessionStore methods and extracted functions — any mismatch is a bug to fix (not a reason to keep inline SQL)
6. Remove now-unused imports from SessionStore
7. Run full test suite, `tsc --noEmit`, `npm run build-and-sync`

## Success Criteria
- [ ] No inline SQL in SessionStore — all queries live in sub-modules (close() exempt: no SQL)
- [ ] All existing tests pass (same count, no new test failures)
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] No orphaned extracted functions remain (every exported function in sub-modules has at least one caller)

## Anti-Patterns
- NO behavior changes — delegation must preserve identical runtime behavior. Tests are the proof.
- NO changing method signatures on SessionStore — callers must not need updating
- NO new abstractions — SessionStore delegates to plain functions, no interfaces or factories
- NO splitting into multiple classes — SessionStore stays as one facade class
- NO leaving inline SQL "temporarily" alongside delegation — each method either delegates fully or stays fully inline (no partial states)
- NO silently adapting parameter types/order during delegation — if an extracted function's signature doesn't match SessionStore's method, fix the extracted function, don't change SessionStore
- NO commenting out old code — delete inline implementations once delegation is verified, don't leave commented blocks

## Key Considerations
- **Parameter threading**: All extracted functions take `db: Database` as first parameter. Delegation is `return fn(this.db, ...)`. Verify parameter order matches.
- **Transaction methods**: `storeObservations` and `storeObservationsAndMarkComplete` in `transactions.ts` already handle transactions internally. SessionStore's versions are identical — delegation is straightforward.
- **PendingMessageStore parameter**: `storeObservationsAndMarkComplete` on SessionStore takes `_pendingStore: PendingMessageStore` parameter but the extracted version doesn't. The SessionStore method ignores it (underscore prefix). Delegation must preserve the SessionStore signature (callers pass it) while not passing it to the extracted function.
- **Name mapping**: `getSessionSummariesByIds` → `getSummariesByIds`, `getSessionSummaryById` → `getSummaryById`. Aliases, not renames — SessionStore method names stay the same.
- **Import aliasing**: Some import names may collide (e.g., `storeObservation` the extracted function vs `storeObservation` the method). Use named imports with different aliases if needed.
