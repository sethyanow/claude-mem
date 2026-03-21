---
id: clmem-luq
title: 'Decompose SessionStore: consolidate migration methods into MigrationRunner'
status: open
type: task
parent: clmem-l6j
---


## Context
Fourth task in Phase 1 (clmem-l6j). SessionStore is 2,563 lines with 15 migration methods (~800 lines) called sequentially in the constructor. A parallel `MigrationRunner` class already exists at `src/services/sqlite/migrations/runner.ts` (866 lines) and is used by `Database.ts` for its migration path.

**Two parallel migration systems exist:**
- SessionStore constructor (lines 36-53): calls `initializeSchema()` + 14 individual migration methods directly
- `MigrationRunner` (migrations/runner.ts): separate class used by `Database.ts` line 171

This task consolidates SessionStore's migration methods into `MigrationRunner` and makes SessionStore's constructor delegate to it — eliminating ~800 lines of duplication.

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

### Key investigation needed:
1. Compare SessionStore's migration methods vs MigrationRunner's — are they duplicates, subsets, or divergent?
2. Determine if MigrationRunner already handles all of SessionStore's migrations
3. If MigrationRunner is missing any, add them
4. Verify Database.ts and SessionStore don't conflict (both run migrations on the same DB)

## Implementation

### Step 1: Inventory comparison — SessionStore vs MigrationRunner
Read both files and create a method-by-method comparison table. Determine which migrations exist in both, which are unique to SessionStore, which are unique to MigrationRunner. Use LSP documentSymbol on both files.

### Step 2: Write failing test — SessionStore constructor delegates migrations
File: `tests/sqlite/session-store-migration-delegation.test.ts`
Test that SessionStore's constructor does NOT directly execute migration SQL — it delegates to MigrationRunner. Use spy/mock to verify MigrationRunner.runAllMigrations is called.
Run test — should fail (SessionStore still has direct migration methods).

### Step 3: Add any missing migrations to MigrationRunner
If Step 1 found migrations in SessionStore that MigrationRunner doesn't have, add them to MigrationRunner. Verify with `tsc --noEmit`.

### Step 4: Replace SessionStore constructor migration calls with MigrationRunner delegation
Remove the 15 direct migration method calls from SessionStore's constructor. Replace with `new MigrationRunner(this.db).runAllMigrations()` (or equivalent).
Remove the 15 private migration methods from SessionStore.
Run test from Step 2 — should pass.

### Step 5: Verify no callers depend on SessionStore's migration methods
Use LSP findReferences on each removed method to confirm they're only called from SessionStore's constructor (already verified for `initializeSchema` — only self-referential).

### Step 6: Verify Database.ts and SessionStore don't double-run migrations
Check if both `Database.ts` constructor AND `SessionStore` constructor run migrations. If so, determine which is the canonical path and remove the other.

### Step 7: Verify full suite + build
Run `tsc --noEmit`, `bun test`, `npm run build-and-sync`. Verify `wc -l` on SessionStore.

## Success Criteria
- [ ] SessionStore constructor delegates migration work to MigrationRunner (no direct migration SQL)
- [ ] Migration methods removed from SessionStore (~800 lines reduced)
- [ ] MigrationRunner handles all migrations previously in SessionStore
- [ ] No duplicate migration execution (Database.ts and SessionStore don't both run migrations)
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass (no new failures beyond baseline 34)
- [ ] No runtime behavior changes — identical schema state after migrations

## Anti-Patterns
- NO changing migration logic — move only, preserve identical behavior
- NO `as any` casts or type suppressions
- NO removing migrations that haven't been verified as already present in MigrationRunner
- FORBIDDEN: assuming MigrationRunner has all migrations without verifying — the two systems may have diverged
- FORBIDDEN: deleting SessionStore migration methods before confirming MigrationRunner covers them

## Key Considerations
- SessionStore and Database.ts may BOTH be running migrations on the same database. Step 6 must determine if this causes conflicts (double-run) or if they target different tables.
- `initializeSchema()` creates core tables with IF NOT EXISTS — this is idempotent and safe to run from either location. But the individual migration methods may not be idempotent if they lack guards.
- The `MigrationRunner` class takes a `Database` (bun:sqlite) in its constructor, same as SessionStore's `this.db` — compatible injection pattern.
