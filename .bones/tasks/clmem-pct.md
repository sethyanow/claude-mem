---
id: clmem-pct
title: 'Fix get_observations schema: replace additionalProperties with explicit params'
status: open
type: task
priority: 2
parent: clmem-cj3
---



## Context
Parent epic clmem-cj3 SC8: "No `additionalProperties: true` on MCP memory tool schemas." Phase 2 sub-epic (clmem-jmj) SC6 treated `get_observations` as "unchanged (already has explicit params)" — but it only defines `ids` in `properties` while the description documents `orderBy`, `limit`, `project` as accepted params. The `additionalProperties: true` at `mcp-server.ts:205` is the mechanism for passing those undeclared params. A test at `mcp-server-tools.test.ts:95-98` asserts it should stay.

## Requirements
1. Add `orderBy`, `limit`, `project` to `get_observations` schema `properties` with types and descriptions
2. Remove `additionalProperties: true` from the schema
3. Update test at `mcp-server-tools.test.ts:95-98` to assert `additionalProperties` is NOT true

## Implementation
1. `src/servers/mcp-server.ts:196-206` — add properties, remove additionalProperties
2. `tests/servers/mcp-server-tools.test.ts:94-98` — flip assertion
3. Verify: `npm test -- tests/servers/mcp-server-tools.test.ts`

## Success Criteria
- [ ] `get_observations` schema has explicit `properties` for `ids`, `orderBy`, `limit`, `project`
- [ ] No `additionalProperties: true` on `get_observations` schema
- [ ] MCP tool tests pass
- [ ] `npm run build-and-sync` succeeds

## Anti-Patterns
- NO removing params the worker API actually accepts — define them, don't drop them
- NO adding `additionalProperties: false` without first defining all params the handler uses
