---
id: clmem-vpg
title: 'Phase 1 Acceptance: Refactor God Classes & Type System'
status: active
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
- [ ] CLAUDE.md Architecture section: every module path verified against filesystem (not just read — confirmed paths exist)
- [ ] Import paths in comments/docs checked for stale references to moved modules (R2)
- [ ] User walkthrough presented covering all 4 Acceptance Requirements
- [ ] User closes this task after review

## Anti-Patterns
- FORBIDDEN: Claiming "no changes needed" to CLAUDE.md without verifying each referenced path exists on disk
- FORBIDDEN: Presenting walkthrough commands without running them first to confirm they produce expected output
- FORBIDDEN: Skipping R2 (comment/doc import paths) because "CLAUDE.md is the only doc"

## Implementation
### Step 1: Check CLAUDE.md for stale architecture references
Read project CLAUDE.md. For each module path referenced in the Architecture section, verify the path exists on disk. Check against Phase 1 decompositions: BaseAgent extraction, SessionStore split, WorkerService split, SearchManager split.

### Step 1a: Check comments/docs for stale import references
Scan source files for comments referencing moved modules. Check any in-repo documentation (not just CLAUDE.md) for stale paths.

### Step 2: Produce user walkthrough
Per the sub-epic's Acceptance Requirements, the walkthrough must cover:
- Worker starts and processes a session end-to-end
- Search returns results via HTTP API
- `tsc --noEmit` exits 0 live
- Build and sync completes

### Step 3: Present walkthrough to user and STOP
The user reviews, runs the walkthrough, and closes this task.
