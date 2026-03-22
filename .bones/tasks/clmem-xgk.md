---
id: clmem-xgk
title: 'Complete SessionStore decomposition: delegate CRUD and queries to extracted modules'
status: open
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

SessionStore has ~50 methods. The work is: refactor each method to delegate to the extracted module function, then remove the inline implementation. The extracted functions take `db: Database` as first param (functional style), so delegation is `return storeObservation(this.db, ...)`.

## Requirements
1. Refactor SessionStore methods to delegate to extracted sub-module functions
2. Remove inline implementations from SessionStore once delegation is verified
3. Delete orphaned extracted functions that have no corresponding SessionStore method (if any)
4. SessionStore becomes a thin facade: constructor + delegation methods

## Success Criteria
- [ ] No inline SQL in SessionStore — all queries live in sub-modules
- [ ] All existing tests pass (same count)
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds

## Anti-Patterns
- NO behavior changes — delegation must preserve identical runtime behavior
- NO changing method signatures on SessionStore — callers must not need updating
- NO new abstractions — SessionStore delegates to plain functions, no interfaces or factories
- NO splitting into multiple classes — SessionStore stays as one facade class

## Key Considerations
- Some SessionStore methods may not have a corresponding extracted module function yet — those need extraction first, then delegation
- The `storeObservations` and `storeObservationsAndMarkComplete` methods are transactional (use `db.transaction()`) — extracted versions must preserve transaction boundaries
- `getTimelineAroundObservation` and `getTimelineAroundTimestamp` are complex timeline queries — extraction to `timeline/queries.ts` needs care
