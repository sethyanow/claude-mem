---
id: clmem-x2a
title: Fix TypeScript type system for Bun — tsc --noEmit clean
status: closed
type: task
priority: 1
parent: clmem-l6j
---



## Context
First task in Phase 1 (clmem-l6j) of the refactor epic (clmem-cj3). Must land before structural decomposition tasks — those will create/move files and having a clean type baseline prevents cascading type errors during refactoring.

The project compiles and runs with Bun but `tsc --noEmit` reports **282 error lines** across 10 distinct error codes. Verified 2026-03-21:

| Error Code | Count | Root Cause |
|------------|-------|------------|
| TS2345 | 136 | `Component` type union missing 16 string literals (SEARCH×72, BRANCH×14, PROCESS×10, TRANSCRIPT×9, CURSOR×7, SETTINGS×3, PROJECT_NAME×3, SHUTDOWN×2, SDK_SPAWN×2, ENV×2, CONFIG×2, SECURITY×1, IMPORT×1, DEDUP×1, CONSOLE×1, AGENTS_MD×1) |
| TS18046 | 30 | `'data' is of type 'unknown'` — untyped fetch responses in UI viewer hooks |
| TS2339 | 25 | Property access on HTML elements without DOM types (viewer UI) |
| TS2307 | 22 | `Cannot find module 'bun:sqlite'` — needs bun-types |
| TS2322 | 20 | Structural type mismatches: ObservationRecord→ObservationSearchResult (14), WorkerService→WorkerRef private member (3), ProcessEnv→Record<string,string> (1), other (2) |
| TS2304 | 16 | Cannot find name: browser APIs (window×6, requestAnimationFrame×2, localStorage×2, cancelAnimationFrame×2, MediaQueryListEvent, IntersectionObserver, Image, confirm) |
| TS2812 | 14 | DOM properties missing (scrollTop, scrollHeight, etc.) — "Try changing lib to include 'dom'" |
| TS2584 | 12 | Cannot find name 'document', 'Map' — missing dom lib |
| TS18047 | 6 | Possibly null |
| TS7006 | 1 | Implicit any |

**Mixed codebase:** Server code (Bun/Node) in `src/services/`, `src/hooks/`, etc. and React browser code in `src/ui/viewer/`. Single `tsconfig.json` currently serves both. No separate tsconfig for UI.

**Pre-existing state:** `skipLibCheck: true` is already in tsconfig. 34 tests currently failing (7 worker-json-status, 27 MarkdownFormatter) — these are pre-existing, not related to this task.

**NOTE:** Original skeleton claimed "50+ errors" with "missing Node type definitions (process, setTimeout, __filename, console)" and "missing module declarations (path, fs, child_process, @modelcontextprotocol/sdk/*)." These claims were verified FALSE — Node types work fine via existing `@types/node`, and only `bun:sqlite` is actually missing.

## Requirements
R5. Fix TypeScript type system for Bun: configure tsconfig with bun-types, fix all type mismatches, achieve `tsc --noEmit` clean.

## Implementation

### Phase A: tsconfig & type providers (fixes ~34 errors: 22 TS2307 + 12 TS2584)
1. Install `@types/bun` — check devDependencies for existing bun type packages first
2. Update `tsconfig.json`: add bun-types to `"types"` array, add `"dom"` and `"dom.iterable"` to `"lib"` array for viewer UI code
3. Run `tsc --noEmit` to verify module resolution errors are resolved

### Phase B: Component type union (fixes ~136 TS2345 errors)
4. Add 16 missing string literals to `Component` type union at `src/utils/logger.ts:18`: SEARCH, BRANCH, PROCESS, TRANSCRIPT, CURSOR, SETTINGS, PROJECT_NAME, SHUTDOWN, SDK_SPAWN, ENV, CONFIG, SECURITY, IMPORT, DEDUP, CONSOLE, AGENTS_MD
5. Run `tsc --noEmit` to verify Component errors are resolved

### Phase C: Structural type mismatches (~20 TS2322 errors)
6. Fix `ObservationRecord` vs `ObservationSearchResult` mismatch (14 errors in SearchManager + search strategies). `ObservationRecord` (`src/types/database.ts`) has ~11 fields. `ObservationSearchResult` (`src/services/sqlite/types.ts`) extends `ObservationRow` which has ~20+ fields plus `rank?`/`score?`. The DB queries in SearchManager return `ObservationRecord[]` but method signatures declare `ObservationSearchResult[]`. Similarly `SessionSummaryRecord` vs `SessionSummarySearchResult`. Align return types to what the DB actually returns, or add mapping at the boundary.
7. Fix `WorkerService` → `WorkerRef` private member mismatch (3 errors in `src/services/worker-service.ts`). `WorkerRef` interface has `sseBroadcaster?` as public optional, but `WorkerService` has it as private. Fix: change WorkerService member visibility or adjust the interface.
8. Fix `ProcessEnv` → `Record<string, string>` mismatch (1 error at `worker-service.ts:439`). `process.env` values are `string | undefined`, not `string`.

### Phase D: UI viewer type fixes (~71 errors: 30 TS18046 + 25 TS2339 + 14 TS2812 + 2 TS2304)
9. Fix `'data' is of type 'unknown'` in UI hooks (30 TS18046 errors in `useContextPreview.ts`, `useSettings.ts`, `LogsModal.tsx`). Add type parameters to fetch calls or type assertions at JSON parse boundaries.
10. Fix `Property 'value' does not exist on EventTarget` (25 TS2339 errors in `ContextSettingsModal.tsx`, `Header.tsx`, `LogsModal.tsx`). Cast event targets to correct HTML element types.
11. Fix remaining DOM property errors (TS2812 in `ScrollToTop.tsx`, `TerminalPreview.tsx`, `useSpinningFavicon.ts`) — should be resolved by Phase A dom lib addition, verify.

### Phase E: Remaining errors (~7: 6 TS18047 + 1 TS7006)
12. Fix possibly-null errors (6 TS18047) — add null checks
13. Fix implicit any (1 TS7006) — add type annotation

### Phase F: Verification
14. Run `tsc --noEmit` — must exit 0
15. Run `npm run build-and-sync` — must succeed
16. Run `bun test` — 1156 passes must remain, 34 pre-existing failures unchanged

## Success Criteria
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] Existing tests: 1156 passes maintained, no new failures introduced (34 pre-existing failures in worker-json-status and MarkdownFormatter are baseline)
- [x] No `as any` casts added to suppress errors
- [x] `bun-types` or equivalent configured in tsconfig
- [x] `Component` type union includes all 16 missing literals (verified by: no TS2345 errors mentioning Component)
- [x] ObservationRecord/ObservationSearchResult mismatch resolved structurally (no type assertions at the boundary)

## Anti-Patterns
- NO `as any` casts — structural fixes only
- NO `@ts-ignore` or `@ts-expect-error` to suppress errors
- NO changing runtime behavior — type fixes only affect the type checker, not runtime
- NO modifying tsconfig in ways that weaken type checking (e.g., `"skipLibCheck": true` doesn't count as fixing)
- NO adding DOM types to server code paths — if `dom` is added to lib, verify no server-side code accidentally relies on browser globals (review imports in `src/services/`, `src/hooks/`)
- NO whole-file type assertions to fix structural mismatches — fix each mismatch at its source

## Key Considerations

### Mixed server/browser codebase
Adding `"dom"` to `lib` makes browser APIs (window, document, localStorage) available everywhere, including server code. This could mask bugs where server code accidentally references browser globals. Mitigation: after adding dom lib, grep server directories for browser API usage to confirm no false sense of safety. Long-term, separate tsconfigs would be more correct but is out of scope for this task.

### `skipLibCheck: true` is pre-existing
The tsconfig already has `skipLibCheck: true`. The anti-pattern says not to add it to weaken checking, but it's already there. Removing it might surface errors in node_modules type declarations. Decision: leave `skipLibCheck: true` in place for this task — removing it is a separate concern that could cascade. Document as known limitation.

### ObservationRecord vs ObservationSearchResult design decision
Two distinct types exist: `ObservationRecord` in `src/types/database.ts` (11 fields, used by database layer) and `ObservationSearchResult` in `src/services/sqlite/types.ts` (extends `ObservationRow` with 20+ fields plus `rank?`/`score?`). SearchManager methods declare return type `ObservationSearchResult[]` but DB queries return `ObservationRecord[]`. The structural fix must not change runtime behavior — only align types to what actually flows through the code.

### Pre-existing test failures (34)
7 in `worker-json-status` (likely infrastructure/environment dependent), 27 in `MarkdownFormatter` (date-sensitive formatting). These are baseline — do not attempt to fix as part of this task. The success criterion is maintaining 1156 passes with no new failures.
