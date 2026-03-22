---
id: clmem-luq
title: 'Decompose SessionStore: consolidate migration methods into MigrationRunner'
status: closed
type: task
owner: Seth
parent: clmem-l6j
---






## Context
Fourth task in Phase 1 (clmem-l6j). SessionStore is 2,563 lines with 15 migration methods (~800 lines) called sequentially in the constructor. `MigrationRunner` already exists at `src/services/sqlite/migrations/runner.ts` (866 lines) with **identical copies** of all 15 methods plus `runAllMigrations()`.

**SRE-verified (2026-03-21):** MigrationRunner already contains all 15 migration methods with identical content (spot-checked `ensureWorkerPortColumn` and `addOnUpdateCascadeToForeignKeys` — byte-identical). The "investigation needed" items from the original skeleton are pre-answered.

**Double-migration concern resolved:** `ClaudeMemDatabase` (Database.ts:145), `getDatabase()` (Database.ts:332), and `initializeDatabase()` (Database.ts:342) have **zero callers** (LSP findReferences verified). The Database.ts MigrationRunner usage is dead code. Only SessionStore's constructor is the active migration path.

This task deletes the duplicate migration methods from SessionStore and delegates to MigrationRunner — eliminating ~800 lines of duplication.

**Blocked by:** clmem-v9b (closed)
**Unlocks:** Sub-epic clmem-l6j progress toward SessionStore decomposition criterion. Reduces SessionStore from ~2,563 to ~1,763 lines, making subsequent CRUD/query extraction easier.

## Requirements
R2. Decompose SessionStore into cohesion seams: schema migrations, observation CRUD, summary CRUD, session queries, import logic. (R2 from parent epic — this task targets the MIGRATIONS seam only.)

## Design

Source: `src/services/sqlite/SessionStore.ts` — constructor (lines 24-53) + migration methods (lines 63-870)
Target: `src/services/sqlite/migrations/runner.ts` — MigrationRunner class (already exists, 866 lines)

### Migration methods in SessionStore to consolidate:
- `initializeSchema()` (line 63) — creates core tables with IF NOT EXISTS
- `ensureWorkerPortColumn()` (line 142)
- `ensurePromptTrackingColumns()` (line 162)
- `removeSessionSummariesUniqueConstraint()` (line 201)
- `addObservationHierarchicalFields()` (line 275)
- `makeObservationsTextNullable()` (line 313)
- `createUserPromptsTable()` (line 393)
- `ensureDiscoveryTokensColumn()` (line 477)
- `createPendingMessagesTable()` (line 509)
- `renameSessionIdColumns()` (line 562)
- `repairSessionIdColumnRename()` (line 624)
- `addFailedAtEpochColumn()` (line 637)
- `addOnUpdateCascadeToForeignKeys()` (line 661)
- `addObservationContentHashColumn()` (line 840)
- `addSessionCustomTitleColumn()` (line 862)

### SRE pre-investigation results (2026-03-21):
1. **Methods are identical** — all 15 SessionStore migration methods exist in MigrationRunner with identical content (LSP documentSymbol + spot-check verified).
2. **MigrationRunner already handles all migrations** — `runAllMigrations()` calls them in the same order as SessionStore's constructor.
3. **No missing migrations** — Step 3 is a no-op.
4. **No double-migration conflict** — Database.ts's MigrationRunner usage is dead code (zero callers on ClaudeMemDatabase, getDatabase, initializeDatabase).

## Implementation

### Step 1: Spot-check content equivalence (SRE pre-answered — verify 2-3 more methods)
SRE verified `ensureWorkerPortColumn` and `addOnUpdateCascadeToForeignKeys` are identical. Spot-check 2-3 more complex methods (e.g., `createUserPromptsTable`, `renameSessionIdColumns`) to confirm no divergence. If ANY differ, STOP and escalate.

### Step 2: Write failing test — SessionStore constructor delegates migrations
File: `tests/sqlite/session-store-migration-delegation.test.ts`
Test that after constructing SessionStore, schema state is correct (all expected tables and columns exist). Additionally verify MigrationRunner.runAllMigrations is called by spying on the method. Run test — should fail because spy won't detect delegation yet (SessionStore calls methods directly).

### Step 3: Replace SessionStore constructor migration calls with MigrationRunner delegation
- Add `import { MigrationRunner } from './migrations/runner.js';` to SessionStore.ts
- Replace lines 36-52 (15 direct method calls) with `new MigrationRunner(this.db).runAllMigrations();`
- Delete the 15 private migration methods (lines 63-870)
- Check for orphaned type imports: `TableColumnInfo`, `SchemaVersion` — if only used by migration methods, remove them
- Run test from Step 2 — should pass.

### Step 4: Verify no external callers depend on removed methods
Use LSP findReferences on 2-3 representative migration methods before deletion to confirm they're only called from SessionStore's constructor. All 15 are private methods, so external callers are unlikely but verify.

### Step 5: Verify full suite + build
Run `tsc --noEmit`, `bun test`, `npm run build-and-sync`. Verify `wc -l` on SessionStore shows ~800 line reduction.

## Success Criteria
- [x] SessionStore constructor delegates migration work to MigrationRunner (no direct migration SQL)
- [x] Migration methods removed from SessionStore (~800 lines reduced) — 2563→1722 (841 lines)
- [x] MigrationRunner handles all migrations previously in SessionStore
- [x] SessionStore's only migration path is via MigrationRunner delegation (no residual direct SQL)
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass (no new failures beyond baseline 34) — 1176 pass, 34 fail
- [x] No runtime behavior changes — test verifies all expected tables/columns exist after construction

## Anti-Patterns
- NO changing migration logic — move only, preserve identical behavior
- NO `as any` casts or type suppressions
- NO removing migrations that haven't been verified as already present in MigrationRunner
- FORBIDDEN: assuming MigrationRunner methods are identical without content spot-check — same name ≠ same SQL. Verify at least 3-4 method bodies match before deleting.
- FORBIDDEN: deleting SessionStore migration methods before confirming MigrationRunner covers them
- FORBIDDEN: leaving orphaned type imports (TableColumnInfo, SchemaVersion) if they're only used by deleted migration methods

## Key Considerations
- **Double-migration is NOT a concern** — Database.ts's MigrationRunner usage is dead code (zero callers). Only SessionStore's constructor is the active path.
- The `MigrationRunner` class takes a `Database` (bun:sqlite) in its constructor, same as SessionStore's `this.db` — compatible injection pattern.
- **Orphaned types:** After removing migration methods, check if `TableColumnInfo` and `SchemaVersion` types are still used elsewhere in SessionStore. If not, remove the imports to keep the file clean.
- **Import path:** SessionStore should import MigrationRunner from `'./migrations/runner.js'` (relative to its location in `src/services/sqlite/`).
- **Agent shortcut to pre-block:** Don't skip content comparison by reasoning "names match so content matches." SRE verified 2 methods; the implementing agent must verify 2-3 more before proceeding with deletion.

### Adversarial Failure Catalog

**Temporal Betrayal: Delegation test spy setup**
- Assumption: Spy on `MigrationRunner.prototype.runAllMigrations` captures the call during SessionStore construction
- Betrayal: If spy is installed AFTER `new SessionStore()`, migrations already ran without the spy — test passes vacuously
- Consequence: Test gives false confidence that delegation works, but it's not actually testing it
- Mitigation: Test must install spy BEFORE constructing SessionStore. Structure: `const spy = spyOn(...)` → `const store = new SessionStore(':memory:')` → `expect(spy).toHaveBeenCalled()`

**Dependency Treachery: Delegation test mock API**
- Assumption: Bun test supports `spyOn(MigrationRunner.prototype, 'runAllMigrations')`
- Betrayal: MigrationRunner is instantiated inside SessionStore's constructor — prototype spy may not intercept if Bun's spy implementation differs from Jest
- Consequence: Test can't verify delegation mechanism
- Mitigation: Verify Bun's `mock` or `spyOn` API supports prototype method spying. Fallback: test schema state only (all tables/columns exist), which proves migrations ran regardless of mechanism

**State Corruption: Pre-existing concurrent constructor risk (NOT introduced by this change)**
- Assumption: Only one SessionStore instance constructed at a time
- Betrayal: Two simultaneous constructions both call `addOnUpdateCascadeToForeignKeys`, which uses `PRAGMA foreign_keys = OFF` + `BEGIN TRANSACTION` — non-reentrant
- Consequence: One instance's PRAGMA change affects the other's transaction
- Mitigation: Pre-existing risk, not in scope. Document for future: SessionStore construction should be serialized (it already is via DatabaseManager.initialize())

## Log

- [2026-03-22T02:06:00Z] [Seth] Debrief: Deleted 841 lines of duplicate migration methods from SessionStore (2563→1722), delegating to MigrationRunner. SRE found Database.ts MigrationRunner usage was dead code (zero callers) — simplified the task significantly. Reflections: Skeleton overestimated complexity (investigation steps were pre-answered by SRE). No user corrections needed. Next task clmem-h4d scoped: delegate import methods to import/bulk.ts (same pattern, ~200 lines).
