---
id: clmem-l6j
title: 'Phase 1: Refactor God Classes & Type System'
status: open
type: epic
priority: 1
depends_on: [clmem-x2a, clmem-a4z, clmem-v9b]
parent: clmem-cj3
---






## Context
Parent epic clmem-cj3. Phase 1 of 2. No prior phase dependencies.

Code quality review identified 4 god classes and a broken type system. This phase structurally decomposes all 4 and fixes `tsc --noEmit` to pass clean with Bun types. No behavior changes — purely structural.

## Requirements
R1. Extract BaseAgent with shared session lifecycle (R1 from parent)
R2. Decompose SessionStore into cohesion seams (R2 from parent)
R3. Decompose SearchManager — extract generic search pattern (R3 from parent)
R4. Decompose WorkerService — lifecycle vs orchestration (R4 from parent)
R5. TypeScript/Bun type system — tsc --noEmit clean (R5 from parent)

## Success Criteria
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass (same count as before refactor)
- [ ] SessionStore decomposed: no single file owns migrations AND CRUD AND queries AND imports
- [ ] SearchManager decomposed: structural duplication across search methods eliminated via shared execution pattern
- [ ] WorkerService decomposed: lifecycle separated from session orchestration
- [x] BaseAgent exists with shared session lifecycle; concrete agents contain only provider-specific logic

## Anti-Patterns
- NO behavior changes — tests prove identical runtime behavior
- NO new abstractions (factories, DI, registries) — extract along natural seams
- NO `as any` casts to fix type errors — structural fixes only
- NO inventing numeric targets for line counts — decomposition is structural, not arithmetic

## Key Considerations
- R1 (BaseAgent) is independent of R2-R4 (god class splits) — can be done in any order
- R5 (type system) should be done last or first — it touches many files and will conflict with parallel structural changes. Recommend first: fix types, then decompose with types already clean.
- The `ObservationRecord` vs `ObservationSearchResult` mismatch in SearchManager needs investigation: extend the record type or add mapping functions.
- ProcessManager.ts (802 lines) is NOT in scope — user didn't prioritize it.

## Acceptance Requirements
**Agent Documentation:**
- [ ] CLAUDE.md: update Architecture section if module paths changed
- [ ] Update any import paths in comments/docs that reference moved modules

**User Walkthrough Must Cover:**
- Worker starts and processes a session end-to-end (hook → worker → agent → DB)
- Search returns results via HTTP API
- `tsc --noEmit` exits 0 live
- Build and sync completes
