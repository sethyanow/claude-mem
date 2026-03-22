---
id: clmem-jmj
title: 'Phase 2: MCP Tool Cleanup'
status: open
type: epic
priority: 2
depends_on: [clmem-l6j, clmem-5qq, clmem-9pc]
parent: clmem-cj3
---





## Context
Parent epic clmem-cj3, Phase 2. Depends on Phase 1 (clmem-l6j) — needs clean type system before editing MCP schemas.

MCP server has 7 tools: 3 memory tools with loose schemas, 3 smart_* tools with misleading descriptions, and 1 fake `__IMPORTANT` tool used for prompt injection. This phase cleans up descriptions and schemas.

## Requirements
R6. Remove `__IMPORTANT` fake tool (R6 from parent)
R7. Rewrite smart_* descriptions — position as structural grep alternatives, not primary code intelligence (R7 from parent)
R8. Explicit parameter definitions on memory tool schemas (R8 from parent)

## Success Criteria
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass (8 pre-existing upstream failures tracked as clmem-g64 and clmem-kqm)
- [x] `__IMPORTANT` tool removed from mcp-server.ts
- [x] `search` tool has explicit `properties` with typed params (query, limit, project, type, obs_type, dateStart, dateEnd, offset, orderBy)
- [x] `timeline` tool has explicit `properties` with typed params (anchor, query, depth_before, depth_after, project)
- [x] `get_observations` schema unchanged (already has explicit params)
- [x] smart_search description mentions "structural grep alternative" or similar, does not position as primary
- [x] smart_unfold description references "use after smart_search" not "use for code navigation"
- [x] smart_outline description frames as "cheaper than full file read" not "shows all symbols"
- [x] No `additionalProperties: true` on search or timeline schemas

## Anti-Patterns
- NO deleting smart_* tools — reframe only
- NO adding `additionalProperties: false` without defining the actual params first
- NO putting workflow instructions in tool descriptions (the `__IMPORTANT` pattern) — tools describe themselves, not orchestration workflows

## Key Considerations
- Optionally fold a brief "returns IDs for use with timeline/get_observations" into search description — natural self-documentation, not a workflow preamble
- `get_observations` already has proper schema — skip it for R8
- The search and timeline handlers use `callWorkerAPI` which passes params as query strings — param types in schema should match what the worker API actually accepts

## Acceptance Requirements
**Agent Documentation:**
- [ ] CLAUDE.md: remove smart_* tool ban if descriptions now correctly position them as fallbacks

**User Walkthrough Must Cover:**
- MCP server starts and lists tools (no `__IMPORTANT`)
- `search` tool works with explicit params
- `timeline` tool works with explicit params
- smart_search returns results with updated description visible in tool listing
