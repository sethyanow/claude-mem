---
id: clmem-x2a
title: Fix TypeScript type system for Bun — tsc --noEmit clean
status: open
type: task
priority: 1
parent: clmem-l6j
---

## Context
First task in Phase 1 (clmem-l6j) of the refactor epic (clmem-cj3). Must land before structural decomposition tasks — those will create/move files and having a clean type baseline prevents cascading type errors during refactoring.

The project compiles and runs with Bun but `tsc --noEmit` reports 50+ errors: missing Node type definitions (`process`, `setTimeout`, `__filename`, `console`), missing module declarations (`bun:sqlite`, `path`, `fs`, `child_process`, `@modelcontextprotocol/sdk/*`), and structural type mismatches (`ObservationRecord` vs `ObservationSearchResult`, `"SEARCH"` not assignable to `Component`).

## Requirements
R5. Fix TypeScript type system for Bun: configure tsconfig with bun-types, fix all type mismatches, achieve `tsc --noEmit` clean.

## Implementation
1. Install `bun-types` (or `@types/bun`) — check what's already in devDependencies
2. Update `tsconfig.json`: add `"types": ["bun-types"]` (or equivalent), ensure `"moduleResolution"` and `"target"` are Bun-compatible
3. Fix `Component` type union — add `"SEARCH"` and `"CONSOLE"` to the Component type (find the type definition via LSP)
4. Fix `ObservationRecord` vs `ObservationSearchResult` mismatch — investigate whether to extend the record type or add explicit mapping functions in SearchManager
5. Fix any remaining type errors surfaced by `tsc --noEmit`
6. Run `tsc --noEmit` — must exit 0
7. Run `npm run build-and-sync` — must succeed
8. Run tests — must all pass

## Success Criteria
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass
- [ ] No `as any` casts added to suppress errors
- [ ] `bun-types` or equivalent configured in tsconfig

## Anti-Patterns
- NO `as any` casts — structural fixes only
- NO `@ts-ignore` or `@ts-expect-error` to suppress errors
- NO changing runtime behavior — type fixes only affect the type checker, not runtime
- NO modifying tsconfig in ways that weaken type checking (e.g., `"skipLibCheck": true` doesn't count as fixing)
