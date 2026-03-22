---
id: clmem-kq9
title: 'Decompose remaining SearchManager methods: search, timeline, getContextTimeline, getTimelineByQuery, findByFile'
status: closed
type: task
priority: 1
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
- [ ] Each extracted method's logic in its own module under `search/`
- [ ] All existing tests pass
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds

## Anti-Patterns
- NO forcing complex methods into `executeQueryFirstSearch`/`executeMetadataFirstSearch` — extract along natural seams
- NO behavior changes — tests prove identical runtime behavior
- NO new abstract classes or interfaces — plain functions or small focused classes

## Key Considerations
- `timeline()`, `getContextTimeline()`, and `getTimelineByQuery()` share significant timeline rendering logic (day grouping, icon selection, table formatting) — this could become a shared `TimelineRenderer` or similar
- `search()` has its own chroma ranking + multi-type hydration flow that's distinct from the query-first/metadata-first patterns
- `findByFile()` is the smallest and simplest — good candidate for first extraction
