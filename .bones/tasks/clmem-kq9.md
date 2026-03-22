---
id: clmem-kq9
title: 'Decompose remaining SearchManager methods: search, timeline, getContextTimeline, getTimelineByQuery, findByFile'
status: closed
type: task
priority: 1
owner: Seth
parent: clmem-cj3
---








## Context
Parent epic clmem-cj3 SC5. SearchManager is 1550 lines. 8 simpler methods already delegate to shared `executeQueryFirstSearch`/`executeMetadataFirstSearch` in `search/execute.ts`. 5 complex methods remain inline:

- `search()` (lines 138-400, ~270 lines) — multi-type search with chroma ranking, date filtering, file grouping
- `timeline()` (lines 409-680, ~270 lines) — anchor-based timeline with observation/session/prompt interleaving
- `getContextTimeline()` (lines 1111-1320, ~210 lines) — context timeline around observation with day grouping
- `getTimelineByQuery()` (lines 1323-1550, ~230 lines) — query-based timeline with chroma ranking
- `findByFile()` (lines 839-960, ~120 lines) — file-specific search with observation+session combination

These methods don't fit the existing `QueryFirstConfig`/`MetadataFirstConfig` patterns — they have multi-type joins, timeline rendering, and complex formatting. Decomposition should extract along natural seams (e.g., timeline rendering, result formatting, chroma ranking) rather than forcing into the existing shared pattern.

## Requirements
1. Extract each method's logic into dedicated modules under `search/`
2. SearchManager retains the method signatures as a thin facade
3. No behavior changes — identical runtime output

## Success Criteria
- [x] SearchManager < 500 lines (per Phase 1 gate)
- [x] Each extracted method's logic in its own module under `search/`
- [x] All existing tests pass
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds

## Implementation

Extraction order: simplest first, building confidence in the pattern before tackling complex methods.

1. **Extract `findByFile()`** → `search/find-by-file.ts` (~120 lines). Simplest method, no shared rendering patterns. Export a function that takes `SearchDeps`-style deps object (sessionSearch, sessionStore, chromaSync, formatter, normalizeParams, queryChroma). SearchManager.findByFile becomes a one-liner calling the extracted function.

2. **Extract `search()`** → `search/multi-search.ts` (~270 lines). Has a local `CombinedResult` interface (line 308) — move it with the function. Uses normalizeParams, queryChroma, sessionSearch, sessionStore, formatter. Has 3 distinct paths (filter-only, chroma, fallback) plus result formatting with date/file grouping.

3. **Extract `timeline()`** → `search/timeline-handler.ts` (~270 lines). First of the 3 timeline methods. This method has TWO modes (query-based and anchor-based) plus inline rendering (day grouping, icon selection, table formatting). The inline rendering logic duplicates what `TimelineBuilder` already provides. **Decision: move the method as-is first. DO NOT refactor to use TimelineBuilder in this task** — that's a behavior-change risk and a separate concern. The goal is decomposition, not deduplication.

4. **Extract `getContextTimeline()`** → `search/context-timeline.ts` (~210 lines). Similar inline rendering to timeline(). Move as-is.

5. **Extract `getTimelineByQuery()`** → `search/query-timeline.ts` (~230 lines). Similar inline rendering to timeline(). Move as-is.

6. **Verify SearchManager < 500 lines.** After all 5 extractions, remaining code should be ~460 lines (constructor, helpers, 8 delegated methods, `getRecentContext`). If over 500, `getRecentContext` (lines 985-1110, ~125 lines inline) can also be extracted but is NOT in scope unless needed.

7. **Add delegation tests** extending `search-manager-search-delegation.test.ts`. The existing test uses `Function.prototype.toString()` to verify method bodies don't contain inline markers. Add equivalent tests for the 5 newly-extracted methods.

**Dependency injection pattern:** Follow the established pattern from `execute.ts` — each extracted function takes a deps object with the services it needs (sessionSearch, sessionStore, chromaSync, normalizeParams, queryChroma). Do NOT make the extracted functions methods of a class unless the method has significant internal state.

## Anti-Patterns
- NO forcing complex methods into `executeQueryFirstSearch`/`executeMetadataFirstSearch` — extract along natural seams
- NO behavior changes — tests prove identical runtime behavior
- NO new abstract classes or interfaces — plain functions or small focused classes
- NO refactoring timeline methods to use TimelineBuilder during this task — deduplication is a future concern, this task is structural decomposition only
- NO whole-method copy-paste without converting `this.*` references to deps — every `this.sessionStore`, `this.sessionSearch`, `this.chromaSync`, `this.formatter`, `this.queryChroma`, `this.normalizeParams` must become a dep parameter

## Key Considerations
- **TimelineBuilder exists but is unused by inline methods.** `TimelineBuilder` (303 lines) at `search/TimelineBuilder.ts` implements the same day-grouping, icon-selection, table-formatting logic that's duplicated inline in `timeline()`, `getContextTimeline()`, and `getTimelineByQuery()`. Refactoring to use it would eliminate ~500 lines of duplication but risks behavior changes. Leave for a follow-up task.
- **`search()` has a local `CombinedResult` interface** at line 308 — must move to the extracted module or to `search/types.ts`.
- **`getRecentContext()` is also inline** (~125 lines, 985-1110) but is NOT in scope. Only extract if needed to hit the < 500 line target.
- **`this` references.** Each method uses: `this.normalizeParams()`, `this.queryChroma()`, `this.sessionSearch`, `this.sessionStore`, `this.chromaSync`, `this.formatter`, `this.timelineService`. The extracted function must receive these as parameters.
- **`findByFile()` is the smallest and simplest** — good candidate for first extraction to validate the pattern.
- **SEARCH_CONSTANTS import.** `timeline()` and `getTimelineByQuery()` reference `SEARCH_CONSTANTS.RECENCY_WINDOW_MS`. Ensure the import moves with the extracted code.
- **ModeManager.getInstance()** is called in timeline rendering for icon selection. This is a singleton — the extracted functions can call it directly.

## Edge Cases
- **Empty chroma results.** `search()` and `timeline()` have fallback paths when chroma returns empty — verify these paths survive extraction.
- **Null chromaSync.** Several methods check `this.chromaSync` for null before calling. The deps object must pass `chromaSync: ChromaSync | null`.
- **Process.cwd() calls.** `search()`, `timeline()`, `getContextTimeline()`, `getTimelineByQuery()` call `process.cwd()`. These should remain as-is in extracted functions (NOT passed as a dep — they need the runtime cwd).
- **Error return format.** `timeline()` returns `{ content: [{ type: 'text', text: '...' }], isError: true }` for validation failures. Ensure the extracted function preserves this exact format.

## Log

- [2026-03-22T15:43:33Z] [Seth] Extracted 5 methods (search, timeline, getContextTimeline, getTimelineByQuery, findByFile) into dedicated modules under search/. SearchManager 1550→499 lines. 13 delegation tests pass. tsc clean. build-and-sync succeeds.
- [2026-03-22T15:44:24Z] [Seth] Debrief: Clean mechanical extraction. 5 methods moved to dedicated modules under search/ with deps-injection pattern. Timeline methods moved as-is (duplication with TimelineBuilder preserved intentionally). No workarounds, no surprises, no user corrections. Reflections: Skeleton accuracy good — SRE-added implementation steps directly useful. Epic SC5 now checked. SC4 (SessionStore) and SC8 (get_observations) remain.
