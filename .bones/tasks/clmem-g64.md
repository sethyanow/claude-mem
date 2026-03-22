---
id: clmem-g64
title: 'Fix process-registry test failures: getActiveCount off-by-one'
status: closed
type: bug
priority: 2
---






## Context

Original regression from PR #1325 (`38d9ac7a`) introduced a module-level counter that drifted from the process map. The Supervisor refactor (`80a8c90a`, Mar 16) replaced the counter mechanism with `getAll().filter().length`, fixing the original off-by-one.

However, a **semantic divergence** remains: `getActiveCount()` counts ALL registry entries with `type === 'sdk'` (including orphaned metadata-only entries persisted to `supervisor.json`), while `getActiveProcesses()` only returns entries with runtime `ChildProcess` refs. This causes:
- `waitForSlot()` to block on ghost entries that no longer have processes
- Test `clearRegistry()` to miss orphaned entries (uses `getActiveProcesses()`)
- Tests to write to production `~/.claude-mem/supervisor.json` with no isolation

**Blocked by:** nothing
**Unlocks:** reliable process pool management, test isolation

## Design

Align `getActiveCount()` with `getActiveProcesses()` — both should only consider entries with runtime process refs. Fix test `clearRegistry()` to properly reset all state.

## Requirements

1. `getActiveCount()` must not count orphaned registry entries (metadata without runtime ChildProcess ref)
2. `waitForSlot()` must not block on orphaned entries
3. Test `clearRegistry()` must clear ALL sdk entries, not just those visible via `getActiveProcesses()`
4. Regression tests for both the count divergence and waitForSlot behavior

## Implementation

### Step 1: Write regression test exposing the divergence
File: `tests/worker/process-registry.test.ts`
Add test: inject orphaned registry entry via `getSupervisor().registerProcess()` with sdk type but NO runtime ref. Assert `getActiveCount()` does NOT count it.
Run: `npx bun test tests/worker/process-registry.test.ts`
Expected: FAIL — getActiveCount returns 1 for orphaned entry

### Step 2: Fix `getActiveCount()` to use `getTrackedProcesses().length`
File: `src/services/worker/ProcessRegistry.ts:99-101`
Replace `getAll().filter(type === 'sdk').length` with `getTrackedProcesses().length` — same filter as `getActiveProcesses()`, only counts entries with runtime refs.
Run: `npx bun test tests/worker/process-registry.test.ts`
Expected: Regression test passes, existing tests pass

### Step 3: Fix test `clearRegistry()` for defense-in-depth
File: `tests/worker/process-registry.test.ts:40-44`
Replace `getActiveProcesses()` loop with `getSupervisor().getRegistry().clear()` or iterate `getAll()` filtering sdk type.
Run: `npx bun test tests/worker/process-registry.test.ts`
Expected: All tests pass

### Step 4: Add waitForSlot regression test
File: `tests/worker/process-registry.test.ts`
Inject orphaned entry, call `waitForSlot(2)` — should resolve immediately (orphan doesn't count).
Run: `npx bun test tests/worker/process-registry.test.ts`
Expected: Passes

### Step 5: Full suite, commit
Run: `npx bun test 2>&1 > /tmp/full-suite.txt`
Commit referencing clmem-g64.

## Success Criteria
- [x] All tests in `tests/worker/process-registry.test.ts` pass (12 existing + 2 new regression tests)
- [x] `getActiveCount()` does not count orphaned registry entries
- [x] `waitForSlot()` does not block on orphaned entries
- [x] Regression test proves orphaned entries are excluded from count
- [x] Test `clearRegistry()` helper clears orphaned entries (not just those visible via `getActiveProcesses()`)

## Anti-Patterns
- Do NOT add test isolation via temp directory for `supervisor.json` — that's a larger refactor out of scope
- Do NOT change `getActiveProcesses()` — its semantics are correct
- Do NOT modify the Supervisor class or the ProcessRegistry class in `src/supervisor/` — the fix is in standalone functions in `src/services/worker/ProcessRegistry.ts`
- Do NOT skip the `clearRegistry()` fix — even if tests pass without it, orphaned entries leaking between tests is a latent failure

## Log

- [2026-03-22T07:12:34Z] [Seth] Discovered during clmem-5qq full suite verification. Pre-existing on main and dev. ProcessRegistry singleton count drifts from map — clearRegistry helper doesn't fully reset.
- [2026-03-22T20:00:00Z] [Bender] Diagnosis: original off-by-one fixed by Supervisor refactor (80a8c90a). Remaining bug: getActiveCount() vs getActiveProcesses() semantic divergence — count includes orphaned entries without runtime refs. Confirmed via instrumented test: inject entry without process ref → count=1, processes=[], clearRegistry leaves count=1. Root cause in ProcessRegistry.ts:99-101. Tests currently pass (12/12) because supervisor.json is clean, but behavior is wrong under orphaned entries.
- [2026-03-22T20:02:17Z] [Seth] Diagnosis complete. Root cause: getActiveCount() counts ALL registry entries (type=sdk), getActiveProcesses() only returns entries with runtime ChildProcess refs. Orphaned entries inflate count but are invisible to clearRegistry. Fix task updated with 5-step implementation plan. Confidence: HIGH — divergence reproduced directly.
- [2026-03-22T20:11:43Z] [Seth] Debrief: Fix was mechanical — one expression change in getActiveCount() plus clearRegistry() helper fix. No workarounds, no surprises, no design deviations. Reflections: skeleton accuracy was good, only gap was Step 4 (waitForSlot test) being a regression guard rather than a RED-GREEN cycle since the Step 2 fix already covered it.
