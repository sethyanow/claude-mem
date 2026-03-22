---
id: clmem-p1x
title: Fix worker start JSON output + test env isolation
status: closed
type: task
priority: 2
parent: clmem-kqm
---






## Context

Root cause from clmem-kqm diagnosis: `worker-service.ts:713` does bare `process.exit(0)` when `isPluginDisabledInClaudeSettings()` returns true for `start` command, producing no JSON output. `exitWithStatus` is hoisted (function declaration at line 720 inside `main()`) and available but not called. CLI tests read host `~/.claude/settings.json` (which has `claude-mem@thedotmack: false`) without env isolation.

- `buildStatusOutput` at module scope (line 147)
- `exitWithStatus` function declaration inside `main()` at line 720 (hoisted, callable at line 713)
- `runWorkerStart()` helper at line 24-30 passes no env override to `spawnSync`
- `isPluginDisabledInClaudeSettings()` respects `CLAUDE_CONFIG_DIR` env var (line 19 of `src/shared/plugin-state.ts`)
- Known limitation: CLI tests still depend on ambient worker state (port 37777). Out of scope — document only.

**Blocked by:** nothing
**Unlocks:** closes clmem-kqm (parent bug)

## Requirements

1. Worker `start` command must output valid JSON even when plugin is disabled in Claude settings
2. CLI tests must not depend on host `~/.claude/settings.json` state
3. No changes to non-`start` command exit paths (bare `process.exit(0)` is correct for `hook`, `restart`, `--daemon`)

## Implementation

### Step 1: Write regression test for plugin-disabled exit path
File: `tests/infrastructure/worker-json-status.test.ts`
Add a new test inside the `start command JSON output` describe block that explicitly tests the plugin-disabled path: spawn worker with `CLAUDE_CONFIG_DIR` pointing to a temp dir where `settings.json` has `enabledPlugins['claude-mem@thedotmack'] = false`. Assert stdout is valid JSON with `continue: true` and `suppressOutput: true`.
Run: `bun test tests/infrastructure/worker-json-status.test.ts`
Expected: Fails — worker outputs empty stdout for disabled path.

### Step 2: Fix worker early exit to output JSON for `start` command
File: `src/services/worker-service.ts`, line 712-714
Change the early exit block: when `command === 'start'`, call `exitWithStatus('ready')` instead of bare `process.exit(0)`. For other hook-initiated commands, bare `process.exit(0)` remains correct.
Run: `bun test tests/infrastructure/worker-json-status.test.ts`
Expected: New regression test passes. Existing 7 failures still fail (test isolation not yet added).

### Step 3: Add CLAUDE_CONFIG_DIR isolation to `runWorkerStart()` helper
File: `tests/infrastructure/worker-json-status.test.ts`, line 24-30
Modify `runWorkerStart()` to create a temp dir, write `settings.json` with `enabledPlugins['claude-mem@thedotmack'] = true`, pass `env: { ...process.env, CLAUDE_CONFIG_DIR: tmpDir }` to `spawnSync`, and clean up the temp dir after.
Run: `bun test tests/infrastructure/worker-json-status.test.ts`
Expected: All 26+ tests pass (including new regression test), 0 fail.

### Step 4: Build, run full test suite, commit
Run: `npm run build-and-sync` then full test suite redirected to file.
Verify: 0 regressions.
Commit `.bones/` and source changes.

## Success Criteria

- [x] Regression test exists for plugin-disabled exit path outputting valid JSON
- [x] `worker-service.ts` early exit calls `exitWithStatus('ready')` when command is `start`
- [x] `runWorkerStart()` sets `CLAUDE_CONFIG_DIR` to isolated temp dir
- [x] All tests in `worker-json-status.test.ts` pass (0 fail)
- [x] Full test suite shows no regressions
- [x] Non-`start` hook-initiated commands still use bare `process.exit(0)`

## Key Considerations

- Step 3 temp dir cleanup: use `try/finally` or bun:test `afterAll` to prevent temp dir leaks on test failure
- Step 1 regression test: assert all three fields (`status: 'ready'`, `continue: true`, `suppressOutput: true`) not just two
- Step 2 intermediate state: the "7 failures still fail" count is approximate — some CLI tests checking only JSON output may pass early after the `exitWithStatus` fix. Step 3 resolves all regardless.
- `command === undefined` case: still hits early exit at line 712 — fix must only change behavior for `command === 'start'`, not for undefined. Guard condition: `if (command === 'start')` inside the early exit block.

## Anti-Patterns

- Do NOT move `exitWithStatus` outside `main()` — it uses `process.exit()` as `never`, keep it scoped
- Do NOT mock `isPluginDisabledInClaudeSettings` in tests — use env isolation via `CLAUDE_CONFIG_DIR`
- Do NOT change behavior for `hook`, `restart`, or `--daemon` commands — only `start` needs JSON output

## Log

- [2026-03-22T21:02:30Z] [Seth] Debrief: Clean fix — 3 lines + test isolation. All 8 pre-existing failures resolved (all CLI tests use start command). Race condition on first runWorkerStart after build-and-sync (worker mid-restart) — pre-existing fragility, not regression. Reflections: skeleton was accurate except intermediate failure count (SRE flagged it). No user corrections. No memories to update.
