---
id: clmem-cj3
title: Claude-Mem Refactor & MCP Cleanup
status: open
type: epic
priority: 1
depends_on: [clmem-l6j, clmem-jmj, clmem-pct, clmem-xgk, clmem-kq9]
---














## Requirements (IMMUTABLE)

### Phase 1: Refactor
R1. Extract `BaseAgent` with shared session lifecycle from SDKAgent, OpenRouterAgent, and GeminiAgent. All 3 agents survive as thin provider-specific wrappers.
R2. Decompose `SessionStore` (2,459 lines) into cohesion seams: schema migrations, observation CRUD, summary CRUD, session queries, import logic.
R3. Decompose `SearchManager` (1,884 lines) by extracting a generic search execution pattern that eliminates the structural duplication across 15+ search methods.
R4. Decompose `WorkerService` (1,251 lines) into lifecycle management vs session orchestration concerns.
R5. Fix TypeScript type system for Bun: configure tsconfig with bun-types, fix all type mismatches (ObservationRecord vs ObservationSearchResult, SEARCH component string, etc.), achieve `tsc --noEmit` clean.

### Phase 2: MCP Cleanup
R6. Remove `__IMPORTANT` fake tool from MCP server.
R7. Rewrite smart_* tool descriptions to position as structural grep alternatives (not primary code intelligence tools).
R8. Replace `additionalProperties: true` on memory tool schemas with explicit parameter definitions.

## Success Criteria
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass — 7 worker-json-status failures are pre-existing (clmem-kqm). Process-registry tests (clmem-g64) now pass (verified 2026-03-22).
- [x] SessionStore decomposed: no single file owns migrations AND CRUD AND queries AND imports — all 35 CRUD/query methods delegate to sub-modules. SessionStore is 570 lines (down from 1605). Sub-modules have callers.
- [x] SearchManager decomposed: all 13 methods delegate — 8 via shared executeQueryFirstSearch/executeMetadataFirstSearch, 5 via dedicated modules (multi-search, find-by-file, timeline-handler, context-timeline, query-timeline). SearchManager 1550→490 lines.
- [x] WorkerService decomposed: lifecycle (start/stop/signals) separated from session orchestration (processing/queues)
- [x] BaseAgent exists with shared session lifecycle; SDKAgent/OpenRouterAgent/GeminiAgent contain only provider-specific logic
- [ ] No `additionalProperties: true` on MCP memory tool schemas — get_observations at mcp-server.ts:205 still has it. Test at mcp-server-tools.test.ts:95-98 asserts it should stay.
- [x] `__IMPORTANT` tool removed from MCP server
- [x] smart_* tool descriptions reference LSP as primary, position self as fallback

## Anti-Patterns (FORBIDDEN)
- NO behavior changes during refactor — all decomposition is structural, preserving identical runtime behavior. Tests are the proof. (Reason: refactors that change behavior silently introduce bugs that surface much later.)
- NO new abstractions for one-time operations — don't add factories, registries, or DI containers to "improve" the decomposition. Extract along natural cohesion seams. (Reason: the current codebase already has premature abstraction issues; adding more defeats the purpose.)
- NO weakening of MCP tool schemas — replacing `additionalProperties: true` means defining the actual params, not removing validation. (Reason: loose schemas let garbage through silently.)
- NO deleting smart_* tools — reframe descriptions only. (Reason: user wants them as grep/glob replacements to reduce CLAUDE.md rules.)

## Approach

Structural refactoring of the 4 god classes plus type system cleanup, followed by MCP tool description and schema improvements. All work on `dev` branch. Each decomposition follows the pattern: extract interface → move methods to new module → re-export from original file → verify tests → remove re-exports once callers updated.

The type system fix is a cross-cutting concern that touches many files but is mechanically straightforward: add `bun-types`, update tsconfig, fix the ~20 type mismatches the LSP already identified.

## Architecture

### Phase 1 Target Structure

```
src/services/sqlite/
  SessionStore.ts          → thin facade re-exporting sub-modules
  schema/migrations.ts     → all migration methods
  observations/store.ts    → observation CRUD
  summaries/store.ts       → summary CRUD
  sessions/queries.ts      → session query methods
  import/importer.ts       → import logic (already partially exists)

src/services/worker/
  SearchManager.ts         → thin facade + normalizeParams
  search/executor.ts       → generic search execution pattern
  search/formatters/       → result formatting by search type

  agents/BaseAgent.ts      → shared session lifecycle
  SDKAgent.ts              → SDK-specific query + message format
  OpenRouterAgent.ts       → OpenRouter-specific query + message format
  GeminiAgent.ts           → Gemini-specific query + message format

  worker-service.ts        → thin coordinator
  WorkerLifecycle.ts       → start/stop/signals/initialization
  SessionOrchestrator.ts   → session processing/queues/pending
```

### Phase 2 Target
```
src/servers/mcp-server.ts  → 4 tools (search, timeline, get_observations, smart_search, smart_unfold, smart_outline)
                              __IMPORTANT removed, schemas tightened, descriptions reframed
```

## Phases

### Phase 1: Refactor
**Scope:** R1, R2, R3, R4, R5
**Gate:**
- `tsc --noEmit` → exit 0
- `npm run build-and-sync` → exit 0
- `npm test` → all passing (same count as before refactor)

### Phase 2: MCP Cleanup
**Scope:** R6, R7, R8
**Gate:**
- `npm run build-and-sync` → exit 0
- `npm test` → all passing
- MCP server tool listing contains no `__IMPORTANT` tool
- All memory tool schemas have explicit `properties` with no `additionalProperties: true`

## Agent Failure Mode Catalog

### Phase 1
| Shortcut | Rationalization | Pre-block |
|----------|----------------|-----------|
| Change method signatures during extraction | "The new module boundary needs a cleaner interface" | Anti-pattern: NO behavior changes. Tests must pass identically. |
| Skip type system fix "because Bun handles it" | "It compiles and runs fine with Bun" | Gate requires `tsc --noEmit` exit 0 — not just Bun build. |
| Create a BaseSearchManager abstract class | "The search methods need a common interface" | Anti-pattern: NO new abstractions. Extract a function, not a class hierarchy. |
| Leave re-exports in place permanently | "It preserves backward compatibility" | Decomposition means delegation, not re-export facades. Re-exports are dead weight. |
| Fix types by adding `as any` casts | "Gets tsc clean quickly" | `as any` is not a fix — it's hiding the problem. Type mismatches need structural fixes. |

### Phase 2
| Shortcut | Rationalization | Pre-block |
|----------|----------------|-----------|
| Delete smart_* tools instead of reframing | "They're redundant with LSP" | Anti-pattern: NO deleting smart_* tools. |
| Add `additionalProperties: false` without defining params | "Blocks unknown params" | Requirement says explicit definitions, not just blocking unknowns. |

## Seam Contracts

### Phase 1 → Phase 2
**Delivers:** Clean, decomposed codebase with passing `tsc --noEmit`. MCP server file unchanged but builds clean.
**Assumes:** Phase 2 can edit `mcp-server.ts` knowing all imports resolve and types check.
**If wrong:** Phase 2 tool schema changes may hit type errors that should have been caught in Phase 1's type cleanup.

## Design Rationale

### Problem
4 god classes (SessionStore, SearchManager, WorkerService, Agent triad) totaling ~6,500 lines of dense, duplicated code make the codebase hard to understand and modify for personal customization. TypeScript type system is partially broken (compiles with Bun but `tsc` reports 50+ errors). MCP tool descriptions misrepresent tool purpose and use prompt injection hacks.

### Research Findings
**Codebase:**
- `SessionStore.ts:22` — 50+ methods, handles migrations through line 638+, CRUD, timeline, imports
- `SearchManager.ts:35` — 15+ search methods with identical normalize→chroma→db→format pattern
- `SDKAgent.ts:44`, `OpenRouterAgent.ts:86`, `GeminiAgent.ts:131` — near-identical `startSession()` structures
- `WorkerService.ts:155` — MCP client, session processing, routes, signals, queues, SSE all in one class
- `mcp-server.ts:151-343` — 7 tools, `__IMPORTANT` is a fake tool, smart_* used exclusively via MCP (zero references from context injection or hooks), `queryFileCache` caches grammar files not results

### Approaches Considered

#### 1. Decompose along cohesion seams (selected)
**Chosen because:** Natural split points already visible in the code (migration methods group together, observation CRUD groups together, etc.). Preserves all behavior. Minimal risk.

#### 2. Rewrite with dependency injection
**Why explored:** Would solve god class problem and make testing easier.
**REJECTED BECAUSE:** Adds architectural complexity (DI container, interfaces for everything) that the project doesn't need. The current approach of direct imports works fine — the problem is file organization, not coupling patterns.
**DO NOT REVISIT UNLESS:** The project grows to need multiple runtime configurations (e.g., swappable storage backends).

#### 3. Skip SearchManager, wait for upstream strategy replacement
**Why explored:** User noted upstream is working on a search strategy replacement.
**REJECTED BECAUSE:** User explicitly said "hold off on that" for the strategy pattern but DID want SearchManager decomposed. The upstream work replaces the search strategy layer; this refactor addresses the god class problem in SearchManager itself — orthogonal concerns.
**DO NOT REVISIT UNLESS:** Upstream ships a replacement that also decomposes SearchManager.

### Scope Boundaries
**In scope:** Structural decomposition, type system fix, MCP tool cleanup
**Out of scope:** Search strategy pattern rework (upstream working on replacement), ProcessManager decomposition (802 lines but lower priority — user didn't flag it), new features

### Open Questions
- Exact split points for SearchManager — need to read the 15 methods and identify which share enough structure to collapse vs which are genuinely distinct
- Whether `ObservationRecord` vs `ObservationSearchResult` mismatch is best fixed by extending the record type or adding mapping functions

## Design Discovery

### Key Decisions Made
| Question | Answer | Implication |
|----------|--------|-------------|
| Keep all 3 agents or strip to SDK-only? | Keep all 3 | BaseAgent must be generic enough for HTTP API agents (OpenRouter, Gemini) and SDK agent |
| Feature branch or dev? | Dev branch | No branch management overhead; commits go directly to dev |
| tsc --noEmit clean or pragmatic Bun-only? | Full tsc --noEmit clean | Need bun-types, tsconfig updates, all type mismatches fixed — not just the obvious ones |
| MCP in same epic or separate? | Same epic, Phase 2 | One epic, two sub-epics with phase ordering |
| Kill smart_* tools? | No — reframe descriptions | Smart tools stay as grep/glob alternatives; descriptions updated to not compete with LSP |
| Kill __IMPORTANT? | Yes | Fake tool removed; workflow hints folded into search description if needed |
| Search strategy pattern? | Hold off | Upstream working on replacement — don't touch that layer |

### Dead-End Paths
- Investigated whether smart_* results cache and feed into system messages — they don't. `queryFileCache` only caches tree-sitter grammar files, not search results. Zero references from context injection or hooks.

### Open Concerns
- Phase 1 is large (5 requirements). Phasing within Phase 1 may be needed — BaseAgent extraction is independent of god class splits, so they can parallelize if needed.

## Log

- [2026-03-22T07:32:41Z] [Seth] Phase 2 acceptance (clmem-9pc) closed. Sub-epic clmem-jmj closed. Both sub-epics complete. All 10 parent epic success criteria checked. Next: review-implementation (Step 4) in fresh session.
- [2026-03-22T07:57:59Z] [Seth] Adversarial reflection (review-implementation Step 2H):

COMPONENTS TRACED:
1. search/execute.ts — shared execution pattern (executeQueryFirstSearch, executeMetadataFirstSearch)
2. SessionOrchestrator.ts — session processing extraction
3. agents/BaseAgent.ts + ResponseProcessor.ts — agent hierarchy
4. mcp-server.ts — schema changes, tool descriptions
5. Orphaned modules (observations/store.ts, summaries/store.ts, sessions/create.ts, observations/get.ts)

BOUNDARIES CHECKED: MCP→callWorkerAPI (String serialization), MCP→callWorkerAPIPost (JSON body), execute.ts→Chroma (metadata shape), SessionOrchestrator→agent.startSession

Q1 FINDINGS:
- execute.ts:81 accesses chromaResults.metadatas[idx].created_at_epoch without validation. If Chroma metadata lacks this field, recency filter silently rejects valid results. Pre-existing pattern (moved from SearchManager inline code, not introduced).
- All MCP handlers use args:any — no type narrowing at MCP boundary. Pre-existing.

Q2 FINDINGS:
- SearchManager.search() (138-400, ~270 lines), .timeline() (409-680, ~270 lines), .getContextTimeline() (1111-1320, ~200 lines), .getTimelineByQuery() (1323-1550, ~220 lines), .findByFile() (839-960, ~120 lines) still implement inline normalize→chroma→db→format. Same structural pattern as extracted methods. Whether SC5 covers these is interpretive — they are genuinely more complex than the 8 extracted methods.
- Recommend future task: extract remaining SearchManager methods to shared patterns or document why they diverge.

Q3 FINDINGS:
- callWorkerAPI line 59: String(value) converts arrays to comma-separated strings. Works by convention for search/timeline params. get_observations correctly uses callWorkerAPIPost for ids array. No new boundary issues introduced.

LIE DETECTOR: Clean on new code. No swallowed errors, no new as-any casts, no TODOs, no unbounded retries. setTimeout(100ms) in SessionOrchestrator bounded and appropriate. Unrecoverable error patterns (line 115-122) use hardcoded strings — fragile but pre-existing.

CLASSIFIED:
- Review gap: get_observations additionalProperties:true (SC8)
- Review gap: mcp-server-tools.test.ts line 95-98 asserts the gap, preventing SC8 fix
- New task recommendation: remaining SearchManager methods not using shared pattern
- Observation: orphaned extracted modules (zero callers), TS6133 unused imports/vars, unreachable code in main()
- [2026-03-22T14:28:24Z] [Seth] Review-implementation completed. Unchecked SC4 (SessionStore CRUD/queries still inline, 1605 lines), SC5 (5 SearchManager methods ~1080 lines still inline), SC8 (get_observations additionalProperties:true). Cut 3 tasks: clmem-pct (SC8 schema fix), clmem-xgk (SC4 SessionStore delegation), clmem-kq9 (SC5 SearchManager decomposition). SC3 noted as pre-existing (clmem-g64). SC6, SC7, SC10 verified PASS.
