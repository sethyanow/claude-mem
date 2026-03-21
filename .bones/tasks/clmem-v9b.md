---
id: clmem-v9b
title: 'Decompose WorkerService: extract SessionOrchestrator from lifecycle coordination'
status: open
type: task
parent: clmem-l6j
---


## Context
Third task in Phase 1 (clmem-l6j). Blocked by clmem-a4z (BaseAgent extraction, closed). WorkerService is 1,251 lines mixing lifecycle management (start/stop/signals/init) with session processing (agent selection, queue draining, fallback handling).

**Blocked by:** clmem-a4z (closed)
**Unlocks:** Sub-epic clmem-l6j progress toward WorkerService decomposition criterion. Reduces surface area for remaining SessionStore and SearchManager decompositions.

## Requirements
R4. Decompose WorkerService (1,251 lines) into lifecycle management vs session orchestration concerns. (R4 from parent epic)

## Design

Source: `src/services/worker-service.ts` — WorkerService class (lines 155-926) + module-level spawn functions (lines 27-153, 939-1251)

Target:
- `src/services/worker/SessionOrchestrator.ts` — session processing extracted from WorkerService
- `src/services/worker-service.ts` — remains as lifecycle coordinator + module-level functions

### Verified method inventory (LSP)

**Session orchestration methods (to extract):**
- `getActiveAgent()` (line 526) — selects SDK/Gemini/OpenRouter based on config
- `startSessionProcessor(session, source)` (line 541) — processes a session with chosen agent, handles errors, fallback, restart logic
- `runFallbackForTerminatedSession(session, error)` (line 735) — fallback handling when SDK session terminates
- `isSessionTerminatedError(error)` (line 719) — classifies errors as session termination
- `processPendingQueues(sessionLimit)` (line 790) — drains pending message queues, handles stale sessions

**Lifecycle methods (stay in WorkerService):**
- `constructor()` (line 200) — initializes all services, creates SessionOrchestrator
- `start()` (line 328) — binds HTTP server
- `shutdown()` (line 884) — tears down resources
- `registerSignalHandlers()` (line 266) — signal handling
- `registerRoutes()` (line 276) — route registration
- `initializeBackground()` (line 363) — MCP, search, modes, pending queue processing
- `broadcastProcessingStatus()` (line 909) — SSE status broadcast

**Module-level functions (stay in worker-service.ts):**
- `ensureWorkerStarted()`, `main()`, `buildStatusOutput()`, spawn lock functions — CLI/spawn layer

### External callers (LSP findReferences on WorkerService class):
- `SessionEventBroadcaster.ts` — takes WorkerService reference
- `SessionRoutes.ts` — takes WorkerService reference
- `DataRoutes.ts` — takes WorkerService reference

These external references only use `broadcastProcessingStatus` and `processPendingQueues` from WorkerService. After extraction, `processPendingQueues` will delegate to SessionOrchestrator.

### SessionOrchestrator dependencies:
The extracted methods access these WorkerService properties:
- `sdkAgent`, `geminiAgent`, `openRouterAgent` — agent selection
- `sessionManager` — session state
- `dbManager` — database access
- `sseBroadcaster` — status broadcast
- `lastAiInteraction` — tracking (written by startSessionProcessor)

SessionOrchestrator constructor will accept these as injected dependencies.

## Implementation

### Step 1: Write failing test for SessionOrchestrator constructor
File: `tests/worker/session-orchestrator.test.ts`
Create test verifying SessionOrchestrator accepts dependencies (agents, sessionManager, dbManager, sseBroadcaster) and stores them. Use same mock patterns as base-agent.test.ts.
Run test — should fail (SessionOrchestrator doesn't exist).

### Step 2: Create SessionOrchestrator class with constructor
File: `src/services/worker/SessionOrchestrator.ts`
Class with constructor accepting dependencies. No methods yet.
Run test — should pass.

### Step 3: Write failing test for getActiveAgent
Test that getActiveAgent returns the correct agent based on provider availability. Mock the `isOpenRouterSelected`/`isGeminiSelected` functions.
Run test — should fail (method doesn't exist).

### Step 4: Move getActiveAgent to SessionOrchestrator
Extract from WorkerService, adjust to use injected agents instead of `this.sdkAgent` etc.
Run test + tsc --noEmit.

### Step 5: Move isSessionTerminatedError to SessionOrchestrator
Pure function — no dependencies needed. Can be a static method or module-level function.
Run tsc --noEmit.

### Step 6: Move startSessionProcessor to SessionOrchestrator
This is the largest method (~180 lines). Depends on getActiveAgent, isSessionTerminatedError, runFallbackForTerminatedSession (all being extracted), plus agents, sessionManager, dbManager, sseBroadcaster.
Update WorkerService to delegate to `this.sessionOrchestrator.startSessionProcessor()`.
Run tsc --noEmit + relevant tests.

### Step 7: Move runFallbackForTerminatedSession to SessionOrchestrator
Depends on agents, sessionManager, dbManager. All available via constructor injection.
Run tsc --noEmit.

### Step 8: Move processPendingQueues to SessionOrchestrator
Depends on dbManager, sessionManager, startSessionProcessor (now on same class).
Update WorkerService to delegate `this.sessionOrchestrator.processPendingQueues()`.
Update external callers (SessionRoutes, DataRoutes) if they call processPendingQueues directly — they go through WorkerService which will delegate.
Run tsc --noEmit + full agent/route tests.

### Step 9: Wire SessionOrchestrator into WorkerService constructor
WorkerService constructor creates SessionOrchestrator with the appropriate dependencies.
Remove extracted methods from WorkerService (they now live in SessionOrchestrator).
Run tsc --noEmit.

### Step 10: Verify
Run full test suite. Run `npm run build-and-sync`. Verify `wc -l` on both files.

### Design decision: Property scope
`lastAiInteraction` is written by `startSessionProcessor` and read by the health endpoint (registered in `registerRoutes`). After extraction, SessionOrchestrator owns this state and exposes a getter. WorkerService reads it in the health endpoint.

## Success Criteria
- [ ] `SessionOrchestrator` exists at `src/services/worker/SessionOrchestrator.ts`
- [ ] Session processing methods (`startSessionProcessor`, `getActiveAgent`, `processPendingQueues`, `runFallbackForTerminatedSession`, `isSessionTerminatedError`) live in SessionOrchestrator
- [ ] WorkerService delegates to SessionOrchestrator for session processing
- [ ] WorkerService retains ONLY lifecycle methods (constructor, start, shutdown, registerSignalHandlers, registerRoutes, initializeBackground, broadcastProcessingStatus)
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass (1160 passes maintained)
- [ ] No runtime behavior changes — identical session processing behavior

## Anti-Patterns
- NO changing method signatures or behavior — extract-only refactor
- NO `as any` casts or type suppressions
- NO creating abstract classes or factory patterns — simple delegation
- NO moving module-level functions (ensureWorkerStarted, main, etc.) — those stay in worker-service.ts
- FORBIDDEN: leaving re-exports in WorkerService that just forward to SessionOrchestrator — callers should go through WorkerService's own delegation methods, not import SessionOrchestrator directly

## Key Considerations
- `broadcastProcessingStatus` stays in WorkerService (it's lifecycle/SSE, not session orchestration) even though `startSessionProcessor` calls it via workerRef. The workerRef pattern already handles this indirection.
- External callers (SessionEventBroadcaster, SessionRoutes, DataRoutes) reference WorkerService, not its internal methods. They shouldn't need to know about SessionOrchestrator — WorkerService delegates internally.
- `initializeBackground` calls `processPendingQueues` — after extraction, this becomes `this.sessionOrchestrator.processPendingQueues()`.
- The `lastAiInteraction` tracking crosses the lifecycle/orchestration boundary. SessionOrchestrator writes it (during session processing), WorkerService reads it (health endpoint). Expose via getter on SessionOrchestrator.
