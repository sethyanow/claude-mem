---
id: clmem-kqm
title: 'Fix worker-json-status test failure: empty stdout from worker start'
status: closed
type: bug
priority: 2
owner: Seth
depends_on: [clmem-p1x]
---









## Context

Upstream regression from PR #655 (`644cccd3`). 1 test fails in `tests/infrastructure/worker-json-status.test.ts` — `should output valid JSON with status: ready`. Worker start command outputs empty/truncated stdout instead of JSON (`JSON Parse error: Unexpected EOF`). Could be build-time output format change or subprocess exiting before writing. ~30 min investigation estimate.

## Success Criteria
- [x] `worker-json-status > start command JSON output > when worker already healthy > should output valid JSON with status: ready` passes

## Log

- [2026-03-22T07:12:34Z] [Seth] Discovered during clmem-5qq full suite verification. Pre-existing on main and dev. Worker start subprocess produces empty stdout.
- [2026-03-22T20:23:12Z] [Seth] Diagnosis: Root cause is isPluginDisabledInClaudeSettings(). Settings file has plugin=false. Silent process.exit(0) at worker-service.ts:713 before exitWithStatus runs. Test gets exit 0 + empty stdout. JSON.parse fails. Verified: CLAUDE_CONFIG_DIR override to isolated dir with plugin=true produces correct JSON, all 23 tests pass. Deeper design issue: test depends on host env state. Fix needs test env isolation.
- [2026-03-22T20:46:59Z] [Seth] Independent investigation confirms prior diagnosis. Two-layer root cause: (1) worker-service.ts:713 does bare process.exit(0) when isPluginDisabledInClaudeSettings()=true, before exitWithStatus outputs JSON. Host has claude-mem@thedotmack:false. (2) CLI tests depend on ambient state — host settings + running worker on port 37777. Fix: call exitWithStatus('ready') for start command at line 713, and set CLAUDE_CONFIG_DIR in test helper. HIGH confidence.
- [2026-03-22T20:48:45Z] [Seth] Diagnosis complete. Fix task: clmem-p1x. Root cause: bare process.exit(0) at worker-service.ts:713 when plugin disabled — exitWithStatus hoisted but not called. Fix: call exitWithStatus('ready') for start command + CLAUDE_CONFIG_DIR isolation in test helper.
