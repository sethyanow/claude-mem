---
id: clmem-pct
title: 'Fix get_observations schema: replace additionalProperties with explicit params'
status: closed
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
1. `src/servers/mcp-server.ts:196-206` — add `orderBy` (enum: `date_desc`|`date_asc`), `limit` (integer), `project` (string) to properties; remove `additionalProperties: true`
2. `tests/servers/mcp-server-tools.test.ts:94-98` — flip `additionalProperties` assertion AND add assertions that `orderBy`, `limit`, `project` properties exist with correct types
3. Verify: `npm test -- tests/servers/mcp-server-tools.test.ts`

## Success Criteria
- [x] `get_observations` schema has explicit `properties` for `ids`, `orderBy`, `limit`, `project`
- [x] No `additionalProperties: true` on `get_observations` schema
- [x] MCP tool tests pass
- [x] `npm run build-and-sync` succeeds

## Anti-Patterns
- NO removing params the worker API actually accepts — define them, don't drop them
- NO adding `additionalProperties: false` without first defining all params the handler uses

## Log

- [2026-03-22T19:12:26Z] [Seth] Added orderBy (enum: date_desc|date_asc), limit (integer), project (string) to get_observations schema. Removed additionalProperties: true. Tests assert all 4 properties exist with correct types. All 17 MCP tests pass. build-and-sync succeeds. All epic SC now checked — epic ready for final validation via review-implementation.
