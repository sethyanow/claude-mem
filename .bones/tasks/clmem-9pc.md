---
id: clmem-9pc
title: 'Phase 2 Acceptance: MCP Tool Cleanup'
status: open
type: task
parent: clmem-jmj
---



## Context

Phase 2 (MCP Tool Cleanup) implementation is complete. Task clmem-5qq delivered all R6/R7/R8 changes. This acceptance task gates sub-epic closure.

## Agent Documentation

- [ ] CLAUDE.md: remove smart_* tool ban if descriptions now correctly position them as fallbacks

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
- [ ] Agent documentation updated (CLAUDE.md smart_* tool ban reviewed)
- [ ] User walkthrough steps all produce expected output
- [ ] User closes this task to signal acceptance
