---
id: clmem-n08
title: 'Decompose SearchManager: extract shared search execution pattern'
status: open
type: task
parent: clmem-l6j
---

## Context
Sixth task in Phase 1 (clmem-l6j). SearchManager has 1,884 lines with 8 search methods that follow two nearly identical structural patterns. The duplication is across `decisions()`, `changes()`, `howItWorks()`, `findByConcept()`, `findByType()` (Pattern B: metadata-first + Chroma ranking) and `searchObservations()`, `searchSessions()`, `searchUserPrompts()` (Pattern A: Chroma semantic + recency filter). Both patterns share: normalize params → Chroma query → DB hydrate → sort → format → return MCP response.

The `search()` method (line 126, ~270 lines) is the main combined search — it's more complex and should be addressed separately if at all.

**Blocked by:** clmem-h4d (closed)
**Unlocks:** SearchManager decomposition criterion met. Sub-epic clmem-l6j completion.

## Requirements
R3. Decompose SearchManager (1,884 lines) by extracting a generic search execution pattern that eliminates the structural duplication across 15+ search methods. (R3 from parent epic.)

## Design

### Two patterns to unify

**Pattern A — query-first** (`searchObservations` L889, `searchSessions` L946, `searchUserPrompts` L1003):
1. `normalizeParams(args)` → extract `query`
2. `queryChroma(query, 100, optionalDocTypeFilter)`
3. Filter Chroma results by 90-day recency window
4. Hydrate from SQLite via `getXxxByIds(recentIds, { orderBy, limit })`
5. If empty → return `{ content: [{ type: 'text', text: 'No X found matching "query"' }] }`
6. Format with `formatter.formatXxxIndex()` → return MCP response

**Pattern B — type/concept-first** (`decisions` L675, `changes` L749, `howItWorks` L832, `findByConcept` L1060, `findByType` L1250):
1. `normalizeParams(args)` → extract `query` and `filters`
2. If `query`: Chroma semantic with type/concept filter → fetch from DB → sort by Chroma rank
3. If no `query`: metadata search → get IDs → Chroma ranking → sort
4. Fallback: metadata search (no Chroma)
5. If empty → return `{ content: [{ type: 'text', text: 'No X found' }] }`
6. Format with `formatter.formatObservationIndex()` → return MCP response

### What varies between methods (parameterize these)
- **DB hydration function**: `getObservationsByIds` vs `getSessionSummariesByIds` vs `getUserPromptsByIds`
- **Chroma doc_type filter**: `{ doc_type: 'session_summary' }`, `{ type: 'decision' }`, etc.
- **Metadata fallback function**: `sessionSearch.findByType(type)`, `sessionSearch.findByConcept(concept)`, or none
- **Empty message text**: `'No decisions found'`, `'No sessions found matching "query"'`, etc.
- **Formatter function**: `formatObservationIndex()` vs `formatSessionIndex()` vs `formatPromptIndex()`
- **Header text**: `'Found N decision(s)'`, `'Found N observation(s) matching "query"'`, etc.

### Extraction target
File: `src/services/worker/search/execute.ts` (new)
Export a `executeSearch()` function (or two: `executeQuerySearch()` for Pattern A, `executeTypeSearch()` for Pattern B) that encodes the shared structure. Each SearchManager method becomes a thin wrapper passing configuration to the shared function.

## Implementation

### Step 1: Inventory the 8 duplicate methods
Read all 8 methods. Create a comparison table of what varies between them (the 6 parameters above). Verify no hidden behavioral differences beyond the parameterized variations. If ANY method has logic that doesn't fit the pattern, note it as a deviation for Key Considerations.

### Step 2: Write failing test — SearchManager methods delegate to shared search pattern
File: `tests/worker/search-manager-search-delegation.test.ts`
Test that the 8 search methods no longer contain inline Chroma/DB/format logic. Same `Function.prototype.toString()` approach as SessionStore delegation tests — verify method bodies don't contain repeated structural markers (e.g., `queryChroma`, `getObservationsByIds`, `formatTableHeader`). Must fail RED because methods currently contain this logic inline.

### Step 3: Extract shared search execution function(s)
Create `src/services/worker/search/execute.ts` with the shared pattern function(s). Define the config interface: what each caller passes to customize behavior (hydration function, Chroma filter, empty message, formatter, header template).

### Step 4: Refactor each of the 8 methods to use the shared function
Replace each method body with a call to the shared function, passing the method-specific configuration. Preserve method signatures — callers see no change.

### Step 5: Run delegation tests — should pass GREEN
Run test from Step 2. Verify all 8 methods no longer contain inline search logic.

### Step 6: Verify full suite + build
Run `tsc --noEmit`, `bun test`, `npm run build-and-sync`. Verify `wc -l` on SearchManager shows significant line reduction.

## Success Criteria
- [ ] Shared search execution function(s) exist in `src/services/worker/search/execute.ts`
- [ ] 8 search methods refactored to use shared function (no inline Chroma/DB/format logic)
- [ ] No interface changes to SearchManager's public methods
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass (no new failures beyond baseline 34)
- [ ] No runtime behavior changes — search results identical before and after

## Anti-Patterns
- NO changing search behavior — delegate only, preserve identical runtime results
- NO changing the public interface of SearchManager — callers (route handlers) unchanged
- NO touching the `search()` method (line 126) — it's the main combined search with different structure, not part of this task
- NO touching timeline methods (`timeline`, `getRecentContext`, `getContextTimeline`, `getTimelineByQuery`) — different pattern, different task
- FORBIDDEN: creating an overly abstract factory/registry/DI system — the shared function is a plain function with a config object, not a framework
- FORBIDDEN: delegating fewer than all 8 pattern methods — partial delegation is not "done"

## Key Considerations
- `changes()` (line 749) is slightly more complex than the others — it searches across multiple concept types (what-changed, bug, change) and merges results. Verify it fits the shared pattern or note it as a deviation.
- The `search()` method is intentionally OUT OF SCOPE — it combines observations + sessions + prompts with date grouping and file grouping. Different pattern entirely.
- Timeline methods are intentionally OUT OF SCOPE — they share their own duplication but it's a different concern.
- The formatter varies: `formatObservationIndex` for observations, `formatSessionIndex` for sessions, `formatPromptIndex` for prompts. The shared function config must accept a formatter function reference.
- SearchManager line count should drop substantially (8 methods × ~60 lines each ≈ ~480 lines of duplication).
