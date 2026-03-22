---
id: clmem-h4d
title: 'Decompose SessionStore: delegate import methods to import/bulk.ts'
status: closed
type: task
parent: clmem-l6j
---



## Context
Fifth task in Phase 1 (clmem-l6j). Follows the same delegation pattern as clmem-luq (migrations → MigrationRunner). SessionStore has 4 import methods (~200 lines, lines 1523-1722) that are duplicates of the modular functions already extracted to `src/services/sqlite/import/bulk.ts` (237 lines).

**Callers:** `src/services/worker/http/routes/DataRoutes.ts` (lines 334, 346, 358, 370) calls `store.importSdkSession()`, `store.importSessionSummary()`, `store.importObservation()`, `store.importUserPrompt()`. The instance method interface must be preserved — SessionStore methods become thin wrappers.

**Blocked by:** clmem-luq (closed)
**Unlocks:** Progress toward SessionStore decomposition criterion. Removes ~200 lines from SessionStore. After this, remaining seams are CRUD and queries.

## Requirements
R2. Decompose SessionStore into cohesion seams: schema migrations, observation CRUD, summary CRUD, session queries, import logic. (R2 from parent epic — this task targets the IMPORTS seam.)

## Design

Source: `src/services/sqlite/SessionStore.ts` — import methods (lines 1523-1722)
Target: `src/services/sqlite/import/bulk.ts` — modular import functions (already exist, 237 lines)

### Methods to delegate:
- `importSdkSession()` (line 1523) → `import { importSdkSession } from './import/bulk.js'`
- `importSessionSummary()` (line 1569) → `import { importSessionSummary } from './import/bulk.js'`
- `importObservation()` (line 1627) → `import { importObservation } from './import/bulk.js'`
- `importUserPrompt()` (line 1688) → `import { importUserPrompt } from './import/bulk.js'`

### Delegation pattern:
Each SessionStore method becomes a thin wrapper:
```
importSdkSession(session: {...}): { imported: boolean; id: number } {
  return importSdkSession(this.db, session);
}
```

## Implementation

### Step 1: Spot-check content equivalence
Compare 2 import methods between SessionStore and import/bulk.ts to verify identical logic. SRE should verify the remaining 2. If ANY differ, STOP and escalate.

### Step 2: Write failing test — SessionStore delegates to modular imports
File: `tests/sqlite/session-store-import-delegation.test.ts`
Test that SessionStore's import methods delegate to the modular functions from import/bulk.ts. Spy on the modular `importSdkSession` function BEFORE calling `store.importSdkSession()`. Must fail because SessionStore currently executes SQL directly.

### Step 3: Replace import method bodies with delegation
- Add `import { importSdkSession as _importSdkSession, importSessionSummary as _importSessionSummary, importObservation as _importObservation, importUserPrompt as _importUserPrompt } from './import/bulk.js'` (aliased to avoid name collision with instance methods)
- Replace each method body with a one-liner delegating to the aliased function, passing `this.db` as first arg
- Run test from Step 2 — should pass

### Step 4: Verify callers still work
Run tests that exercise the import path. Check `DataRoutes.ts` callers still compile via `tsc --noEmit`.

### Step 5: Verify full suite + build
Run `tsc --noEmit`, `bun test`, `npm run build-and-sync`. Verify `wc -l` on SessionStore shows ~150-180 line reduction (method bodies removed, signatures retained as wrappers).

## Success Criteria
- [x] SessionStore import methods delegate to import/bulk.ts functions (no direct SQL in SessionStore)
- [x] Import method bodies replaced with one-liner delegation wrappers
- [x] DataRoutes.ts callers still work (no interface change)
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass (no new failures beyond baseline 34)
- [x] No runtime behavior changes — import dedup and insert logic identical

## Anti-Patterns
- NO changing import logic — delegate only, preserve identical behavior
- NO changing the DataRoutes.ts callers — the instance method interface is preserved
- NO removing SessionStore's import methods entirely — callers depend on the instance methods; only bodies change
- FORBIDDEN: assuming modular functions are identical without content spot-check
- FORBIDDEN: renaming or restructuring import/bulk.ts
- FORBIDDEN: delegating fewer than all 4 methods — partial delegation is not "done"
- FORBIDDEN: writing a behavioral equivalence test that passes both before and after delegation — the RED test must fail before delegation and pass after

## Key Considerations
- The modular functions take `db: Database` as first argument; SessionStore methods use `this.db`. The wrapper passes `this.db` to bridge the interface.
- The `ImportResult` type from import/bulk.ts (`{ imported: boolean; id: number }`) matches SessionStore's inline return type — no type conflict.
- Unlike migrations (where MigrationRunner had `runAllMigrations()` as a single entry point), imports are 4 independent functions. Each gets its own wrapper.
- Line reduction will be smaller than migrations (~150-180 lines) because the wrapper signatures are retained. The bodies shrink to one-liners but the signatures stay.
- **SRE-verified (this session):** All 4 methods content-identical between SessionStore and import/bulk.ts. Only difference: `this.db` → `db` parameter. Database type (`bun:sqlite.Database`) matches in both files.
- **SRE-verified:** DataRoutes.ts callers confirmed at lines 334, 346, 358, 370. Only caller of SessionStore import methods.
- **SRE-verified:** Baseline test count: 1178 pass, 34 fail, 3 skip across 74 files.
- **First-time activation:** The modular functions in import/bulk.ts have zero external references — they are currently unused duplicates. Delegation will be their first actual invocation. No existing tests exercise them.
- **Bun module mocking:** Step 2's spy-based test requires `mock.module()` or equivalent in Bun's test runner. Verify Bun supports intercepting module-level imports before writing the test. If not available, an alternative RED test: verify SessionStore has a module-level import from `./import/bulk.js` (absent before delegation, present after).
