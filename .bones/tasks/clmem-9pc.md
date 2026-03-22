---
id: clmem-9pc
title: 'Phase 2 Acceptance: MCP Tool Cleanup'
status: closed
type: task
parent: clmem-jmj
---






## Context

Phase 2 (MCP Tool Cleanup) implementation is complete. Task clmem-5qq delivered all R6/R7/R8 changes. This acceptance task gates sub-epic closure.

## Agent Documentation

- [x] CLAUDE.md: smart_* tool ban softened to warning per user decision (prefer LSP, use smart_* as fallback)

## User Walkthrough

1. Verify MCP server starts and lists tools (no `__IMPORTANT`):
   ```bash
   grep -c '__IMPORTANT' src/servers/mcp-server.ts  # Should be 0
   grep -c "name: '" src/servers/mcp-server.ts | head -1  # Count tool entries
   ```

2. Verify `search` tool has explicit typed params:
   ```bash
   bun test tests/servers/mcp-server-tools.test.ts
   ```
   All 14 tests should pass.

3. Verify smart_* descriptions are reframed:
   ```bash
   grep 'fallback' src/servers/mcp-server.ts  # smart_search mentions fallback
   grep 'Lightweight' src/servers/mcp-server.ts  # smart_outline mentions lightweight
   ```

4. Verify build output invokes main():
   ```bash
   grep -o 'DP().catch' plugin/scripts/mcp-server.cjs  # Should appear (not guarded by RP.main)
   ```

## Success Criteria
- [x] Agent documentation updated (CLAUDE.md smart_* tool ban reviewed)
- [x] User walkthrough steps all produce expected output
- [x] User closes this task to signal acceptance

## Log

- [2026-03-22T07:31:21Z] [Seth] Acceptance walkthrough executed. All 4 steps pass: (1) 0 __IMPORTANT refs, 7 tool entries, (2) 14/14 MCP tool tests pass, (3) fallback/Lightweight grep matches confirm smart_* reframing, (4) DP().catch in CJS build confirms main() invocation. CLAUDE.md smart_* ban softened to warning per user decision.
