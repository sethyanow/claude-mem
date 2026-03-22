---
id: clmem-vpg
title: 'Phase 1 Acceptance: Refactor God Classes & Type System'
status: open
type: task
parent: clmem-l6j
---



## Context
Phase 1 acceptance gate. All 6 implementation tasks (clmem-x2a through clmem-n08) are closed with all success criteria met. This task verifies Phase 1's work end-to-end and updates documentation.

## Requirements
1. Update CLAUDE.md Architecture section if module paths changed
2. Update any import paths in comments/docs that reference moved modules
3. Produce user walkthrough covering the sub-epic's Acceptance Requirements

## Success Criteria
- [ ] CLAUDE.md reviewed and updated if needed
- [ ] User walkthrough presented and approved
- [ ] User closes this task after review

## Implementation
### Step 1: Check CLAUDE.md for stale architecture references
Read project CLAUDE.md. Check if any module paths referenced in the Architecture section have changed due to Phase 1 decompositions (BaseAgent extraction, SessionStore split, WorkerService split, SearchManager split).

### Step 2: Produce user walkthrough
Per the sub-epic's Acceptance Requirements, the walkthrough must cover:
- Worker starts and processes a session end-to-end
- Search returns results via HTTP API
- `tsc --noEmit` exits 0 live
- Build and sync completes

### Step 3: Present walkthrough to user and STOP
The user reviews, runs the walkthrough, and closes this task.
