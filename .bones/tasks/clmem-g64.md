---
id: clmem-g64
title: 'Fix process-registry test failures: getActiveCount off-by-one'
status: open
type: bug
priority: 2
---


## Context

Upstream regression from PR #1325 (`38d9ac7a`). 7 of 8 tests in `tests/worker/process-registry.test.ts` fail. `getActiveCount()` returns 1 more than expected after `clearRegistry()`. The `ProcessRegistry` is a module singleton; the count variable likely drifts from the actual process map. The `clearRegistry()` helper iterates `getActiveProcesses()` but something isn't cleaning up completely. ~15 min fix estimate.

## Success Criteria
- [ ] All 8 tests in `tests/worker/process-registry.test.ts` pass

## Log

- [2026-03-22T07:12:34Z] [Seth] Discovered during clmem-5qq full suite verification. Pre-existing on main and dev. ProcessRegistry singleton count drifts from map — clearRegistry helper doesn't fully reset.
