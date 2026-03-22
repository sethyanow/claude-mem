---
id: clmem-kqm
title: 'Fix worker-json-status test failure: empty stdout from worker start'
status: open
type: bug
priority: 2
---


## Context

Upstream regression from PR #655 (`644cccd3`). 1 test fails in `tests/infrastructure/worker-json-status.test.ts` — `should output valid JSON with status: ready`. Worker start command outputs empty/truncated stdout instead of JSON (`JSON Parse error: Unexpected EOF`). Could be build-time output format change or subprocess exiting before writing. ~30 min investigation estimate.

## Success Criteria
- [ ] `worker-json-status > start command JSON output > when worker already healthy > should output valid JSON with status: ready` passes

## Log

- [2026-03-22T07:12:34Z] [Seth] Discovered during clmem-5qq full suite verification. Pre-existing on main and dev. Worker start subprocess produces empty stdout.
