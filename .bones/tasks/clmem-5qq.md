---
id: clmem-5qq
title: 'Clean up MCP tool definitions: remove __IMPORTANT, fix schemas, rewrite descriptions'
status: active
type: task
priority: 2
parent: clmem-jmj
---




## Context

Single-file task in `src/servers/mcp-server.ts`. The `tools` array (lines 151-343) contains 7 tool definitions. Three changes needed:

1. **R6**: The `__IMPORTANT` tool (lines 152-185) is a fake tool used for prompt injection — it puts workflow instructions into the tool listing. Anti-pattern per sub-epic: "NO putting workflow instructions in tool descriptions."
2. **R7**: The three `smart_*` tools position themselves as primary code intelligence tools. They should be reframed as structural grep alternatives / fallbacks behind LSP.
3. **R8**: The `search` and `timeline` tools have `properties: {}, additionalProperties: true` — no schema validation. The actual params are well-defined (confirmed via `SearchManager.search()` line 138 and `SearchManager.timeline()` line 409).

`get_observations` already has explicit params (line 215-225) but retains `additionalProperties: true` — sub-epic says "get_observations schema unchanged", so leave it.

**Blocked by:** None (first Phase 2 task)
**Unlocks:** Phase 2 acceptance task, then parent epic closure

## Requirements

R6. Remove `__IMPORTANT` fake tool from MCP server
R7. Rewrite smart_* tool descriptions to position as structural grep alternatives, not primary code intelligence
R8. Replace `additionalProperties: true` on `search` and `timeline` schemas with explicit parameter definitions

## Implementation

### Step 1: Write test for tool listing (no __IMPORTANT, correct tool count)
File: `tests/servers/mcp-server-tools.test.ts` (new)
- Import the `tools` array from `src/servers/mcp-server.ts` (may need to export it)
- Assert: no tool named `__IMPORTANT` exists in the array
- Assert: exactly 6 tools in the array (search, timeline, get_observations, smart_search, smart_unfold, smart_outline)
- Assert: tool names match expected set

Run: `npx vitest run tests/servers/mcp-server-tools.test.ts`
Expected: Fails — `__IMPORTANT` still exists, tool count is 7

### Step 2: Write test for search/timeline schemas (explicit properties, no additionalProperties)
Same test file.
- Find `search` tool, assert `inputSchema.properties` has keys: `query`, `limit`, `project`, `type`, `obs_type`, `dateStart`, `dateEnd`, `offset`, `orderBy`
- Assert each property has `type` and `description`
- Assert `inputSchema.additionalProperties` is not `true` (either absent or false)
- Find `timeline` tool, assert `inputSchema.properties` has keys: `anchor`, `query`, `depth_before`, `depth_after`, `project`
- Same validation per property
- Assert `get_observations` schema is unchanged (still has `additionalProperties: true`, still has `ids` required)

Run: same command
Expected: Fails — search/timeline have empty properties

### Step 3: Write test for smart_* descriptions (positioning as alternatives)
Same test file.
- Find `smart_search` tool, assert description contains "structural" or "grep alternative" or "fallback"
- Assert description does NOT contain "primary" or language suggesting it's the main code nav tool
- Find `smart_unfold` tool, assert description does NOT contain "code navigation" as primary use
- Find `smart_outline` tool, assert description contains "cheaper" or "lightweight" framing

Run: same command
Expected: Fails — current descriptions don't match

### Step 4: Run tests, confirm all three groups fail for the right reasons
Run: `npx vitest run tests/servers/mcp-server-tools.test.ts`
Confirm: test failures match expectations (wrong count, missing properties, wrong descriptions)

### Step 5: Make `tools` importable for tests
File: `src/servers/mcp-server.ts`
Two changes needed — both are prerequisites for test imports:

1. **Export the tools array:** `const tools = [` → `export const tools = [`
2. **Guard `main()` with `import.meta.main`:** The `main()` call at module bottom (line 450) runs unconditionally on import, triggering `StdioServerTransport.connect()` which fails without an MCP client. Guard it:
   ```typescript
   if (import.meta.main) {
     main().catch((error) => {
       logger.error('SYSTEM', 'Fatal error', undefined, error);
       process.exit(0);
     });
   }
   ```
   This is idiomatic Bun — `import.meta.main` is `true` only when the file is the direct entry point.

**Note:** Module-level `console.log` redirect (lines 19-22) will still execute on import. This is a pre-existing global side effect. Tests should use `bun:test` assertions (not console.log) so this is non-impacting.

### Step 6: Remove `__IMPORTANT` tool
File: `src/servers/mcp-server.ts`
- Delete the entire `__IMPORTANT` tool entry (lines 152-185)
- This is the first element in the `tools` array

### Step 7: Add explicit schemas to `search` tool
File: `src/servers/mcp-server.ts`
- Replace empty `properties: {}` with typed params:
  - `query`: string — "Search query text"
  - `limit`: number — "Maximum results to return"
  - `project`: string — "Filter by project name"
  - `type`: string — "Filter by type: observations, sessions, prompts"
  - `obs_type`: string — "Filter by observation type (comma-separated)"
  - `dateStart`: string — "Start date filter (ISO format)"
  - `dateEnd`: string — "End date filter (ISO format)"
  - `offset`: number — "Pagination offset"
  - `orderBy`: string — "Sort order"
- Remove `additionalProperties: true`
- Optionally fold brief "returns IDs for use with timeline/get_observations" into description (per sub-epic key considerations)

### Step 8: Add explicit schemas to `timeline` tool
File: `src/servers/mcp-server.ts`
- Replace empty `properties: {}` with typed params:
  - `anchor`: number — "Observation ID to anchor timeline around"
  - `query`: string — "Search query (finds anchor automatically)"
  - `depth_before`: number — "Number of observations before anchor (default: 10)"
  - `depth_after`: number — "Number of observations after anchor (default: 10)"
  - `project`: string — "Filter by project name"
- Remove `additionalProperties: true`

### Step 9: Rewrite smart_* descriptions
File: `src/servers/mcp-server.ts`
- `smart_search`: Reframe as "Structural grep alternative using tree-sitter AST parsing. Use as a fallback when LSP is unavailable. Returns folded structural views with token counts."
- `smart_unfold`: Reframe as "Expand a specific symbol from a file. Use after smart_search to read specific code without loading the full file."
- `smart_outline`: Reframe as "Lightweight structural outline of a file — cheaper than reading the full file. Shows symbols with signatures, bodies folded."

### Step 10: Run tests, verify all pass
Run: `npx vitest run tests/servers/mcp-server-tools.test.ts`
Expected: All tests pass

### Step 11: Run build and full test suite
Run: `npm run build-and-sync` — verify build succeeds
Run: `npx vitest run 2>&1 > /tmp/claude-mem-tests.txt && echo PASS || echo FAIL`
Review any failures

### Step 12: Commit and push
Commit message: "fix: clean up MCP tool definitions — remove __IMPORTANT, add explicit schemas, rewrite descriptions"

## Success Criteria
- [ ] `__IMPORTANT` tool removed from tools array
- [ ] Exactly 6 tools remain: search, timeline, get_observations, smart_search, smart_unfold, smart_outline
- [ ] `search` tool has explicit typed properties for all 9 params, no `additionalProperties: true`
- [ ] `timeline` tool has explicit typed properties for all 5 params, no `additionalProperties: true`
- [ ] `get_observations` schema unchanged
- [ ] `smart_search` description positions as structural grep alternative / fallback
- [ ] `smart_unfold` description does not position as primary code navigation tool
- [ ] `smart_outline` description frames as lightweight / cheaper alternative
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass
- [ ] New tests cover tool listing, schema shapes, and description positioning
- [ ] Built output (`plugin/scripts/mcp-server.cjs`) still invokes `main()` when run as entry point (verify after `npm run build-and-sync`)

## Key Considerations

- **`tests/servers/` directory does not exist** — create it before writing the test file
- **Search schema covers 9 of ~12 actual params** — `SearchManager.search()` also accepts `concepts`, `files`/`filePath`, and `format` (line 141). The sub-epic criteria explicitly list 9 params. Remaining params still pass through since `additionalProperties` defaults to `true` when not specified (we remove `additionalProperties: true` but don't add `additionalProperties: false`)
- **`console.log` redirect on import** — lines 19-22 of mcp-server.ts redirect `console.log` globally. This fires on import in tests but doesn't affect `bun:test` assertions
- **Line numbers are guides** — prior session captured line numbers that may shift after edits. Use tool names and structure to locate code, not hardcoded line numbers
- **`import.meta.main` must survive esbuild** — mcp-server.ts is bundled into `plugin/scripts/mcp-server.cjs` by esbuild. After adding the `import.meta.main` guard, verify the built output still invokes `main()` when run as an entry point. If esbuild transforms `import.meta.main` in a way that breaks the guard, use an alternative pattern (e.g., check for a sentinel environment variable or use `require.main === module` in the CJS output)
- **Schema types are aspirational, not enforced** — `callWorkerAPI` serializes ALL params as strings via `URLSearchParams.append(key, String(value))`. Schema `type: "number"` guides LLM callers but doesn't enforce runtime types. Worker's `normalizeParams` handles string→number coercion. No action needed, but be aware when writing schema descriptions

## Anti-Patterns
- NO deleting smart_* tools — reframe descriptions only
- NO adding `additionalProperties: false` without defining the actual params first
- NO putting workflow instructions in tool descriptions
- NO changing handler logic — this task is schema/description only
- NO skipping the `import.meta.main` guard — tests WILL fail if `main()` runs on import (predicted shortcut: agent exports `tools` but forgets the guard, then wastes time debugging `StdioServerTransport` errors in test output)
