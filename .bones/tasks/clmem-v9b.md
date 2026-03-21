---
id: clmem-v9b
title: 'Decompose WorkerService: extract SessionOrchestrator from lifecycle coordination'
status: closed
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
- `sseBroadcaster` — SSE event broadcasting (used by agents via WorkerRef)
- `sessionEventBroadcaster` — session lifecycle events (used in runFallbackForTerminatedSession line 784)
- `broadcastProcessingStatus` callback — called 4 times in startSessionProcessor's finally block (lines 659, 674, 693, 711). This method stays in WorkerService; inject as callback.
- `lastAiInteraction` — tracking (written by startSessionProcessor)

**WorkerRef passthrough (CRITICAL):** `startSessionProcessor` passes `this` to `agent.startSession(session, this)` (line 569). `runFallbackForTerminatedSession` does the same (lines 752, 764). The agents expect a `WorkerRef` (defined in `src/services/worker/agents/types.ts`), which requires `sseBroadcaster?.broadcast()` and `broadcastProcessingStatus?()`. After extraction, SessionOrchestrator must either:
- Implement `WorkerRef` interface (expose sseBroadcaster and broadcastProcessingStatus on itself), OR
- Receive a `WorkerRef` object as a constructor dependency and pass it through to agents

The second approach is cleaner — WorkerService already satisfies `WorkerRef` structurally, so inject `WorkerRef` into SessionOrchestrator and pass it to agents.

SessionOrchestrator constructor will accept these as injected dependencies.

## Implementation

### Step 1: Write failing test for SessionOrchestrator constructor
File: `tests/worker/session-orchestrator.test.ts`
Create test verifying SessionOrchestrator accepts dependencies (agents, sessionManager, dbManager, sseBroadcaster, sessionEventBroadcaster, broadcastProcessingStatus callback, workerRef) and stores them. Use same mock patterns as base-agent.test.ts.
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
**Cross-boundary calls to handle:**
- `this.broadcastProcessingStatus()` (4 calls in finally block, lines 659/674/693/711) → use injected callback
- `agent.startSession(session, this)` (line 569) → pass injected `workerRef` instead of `this`
- `PendingMessageStore` dynamic import via `require()` at line 664 → preserve same import pattern
Update WorkerService to delegate to `this.sessionOrchestrator.startSessionProcessor()`.
Run tsc --noEmit + relevant tests.

### Step 7: Move runFallbackForTerminatedSession to SessionOrchestrator
Depends on agents, sessionManager, dbManager, sessionEventBroadcaster (line 784: `this.sessionEventBroadcaster.broadcastSessionCompleted()`). All available via constructor injection.
**Cross-boundary calls:** `agent.startSession(session, this)` at lines 752/764 → pass injected `workerRef`.
Run tsc --noEmit.

### Step 8: Move processPendingQueues to SessionOrchestrator
Depends on dbManager, sessionManager, startSessionProcessor (now on same class).
**Note:** Uses `await import('./sqlite/PendingMessageStore.js')` dynamic import at line 796. Import path must be adjusted for new file location (`../sqlite/PendingMessageStore.js` or similar from `src/services/worker/`).
Update WorkerService to delegate `this.sessionOrchestrator.processPendingQueues()`.
External callers (SessionRoutes line 230 → broadcastProcessingStatus, DataRoutes line 431 → processPendingQueues) go through WorkerService which delegates.
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
- [x] `SessionOrchestrator` exists at `src/services/worker/SessionOrchestrator.ts`
- [x] Session processing methods (`startSessionProcessor`, `getActiveAgent`, `processPendingQueues`, `runFallbackForTerminatedSession`, `isSessionTerminatedError`) live in SessionOrchestrator
- [x] WorkerService delegates to SessionOrchestrator for session processing
- [x] WorkerService retains ONLY lifecycle methods (constructor, start, shutdown, registerSignalHandlers, registerRoutes, initializeBackground, broadcastProcessingStatus)
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass (baseline: 1163 pass, 34 fail, 3 skip across 1200 tests — no new failures introduced)
- [x] No runtime behavior changes — identical session processing behavior
- [x] Dynamic imports in SessionOrchestrator resolve correctly (PendingMessageStore paths adjusted for new location — tsc doesn't check these)

## Anti-Patterns
- NO changing method signatures or behavior — extract-only refactor
- NO `as any` casts or type suppressions
- NO creating abstract classes or factory patterns — simple delegation
- NO moving module-level functions (ensureWorkerStarted, main, etc.) — those stay in worker-service.ts
- FORBIDDEN: leaving re-exports in WorkerService that just forward to SessionOrchestrator — callers should go through WorkerService's own delegation methods, not import SessionOrchestrator directly
- FORBIDDEN: duplicating `broadcastProcessingStatus` into SessionOrchestrator — it stays in WorkerService, SessionOrchestrator gets a callback
- FORBIDDEN: passing `this` (SessionOrchestrator) to `agent.startSession()` without verifying it satisfies `WorkerRef` — WorkerRef has optional properties so `tsc` won't catch a missing implementation. Pass the injected `workerRef` instead.

## Key Considerations
- `broadcastProcessingStatus` stays in WorkerService (it's lifecycle/SSE, not session orchestration). `startSessionProcessor` calls it 4 times directly via `this.broadcastProcessingStatus()` (NOT via workerRef — that was a mischaracterization). After extraction, inject as a callback into SessionOrchestrator.
- `WorkerRef` interface (defined at `src/services/worker/agents/types.ts:21-26`) has ALL optional properties (`sseBroadcaster?`, `broadcastProcessingStatus?`). This means ANY object satisfies `WorkerRef` at compile time. `tsc --noEmit` WILL NOT catch a missing implementation. Runtime testing is required to verify agents receive a functional WorkerRef.
- External callers (SessionEventBroadcaster, SessionRoutes, DataRoutes) reference WorkerService, not its internal methods. They shouldn't need to know about SessionOrchestrator — WorkerService delegates internally.
- `initializeBackground` calls `processPendingQueues` — after extraction, this becomes `this.sessionOrchestrator.processPendingQueues()`.
- The `lastAiInteraction` tracking crosses the lifecycle/orchestration boundary. SessionOrchestrator writes it (during session processing), WorkerService reads it (health endpoint). Expose via getter on SessionOrchestrator.
- `PendingMessageStore` is imported dynamically in two extracted methods: `require()` at line 664 (startSessionProcessor) and `await import()` at line 796 (processPendingQueues). Import paths must be adjusted for the new file location (`src/services/worker/SessionOrchestrator.ts` is one level deeper than `src/services/worker-service.ts`).

### Failure Catalog (Adversarial Planning)

**Dependency Treachery: Dynamic import path shift**
- Assumption: `require('./sqlite/PendingMessageStore.js')` resolves from new file location
- Betrayal: SessionOrchestrator at `src/services/worker/` — `./sqlite/` resolves to `src/services/worker/sqlite/` which is wrong. Actual path is `src/services/sqlite/`
- Consequence: Runtime crash on first session processing — `Cannot find module`. `tsc --noEmit` does NOT check dynamic imports.
- Mitigation: Adjust to `../sqlite/PendingMessageStore.js`. Must verify at runtime via test, not just compile check.

**Temporal Betrayal: SessionOrchestrator construction timing**
- Assumption: SessionOrchestrator exists before any method is called
- Betrayal: `initializeBackground()` runs asynchronously and calls `processPendingQueues`. If SessionOrchestrator construction fails or is deferred, delegation hits null reference during startup.
- Mitigation: Construct SessionOrchestrator synchronously in WorkerService constructor (before `start()`). Current code initializes all services in constructor — maintain this pattern.

**Dependency Treachery: WorkerRef callback during shutdown**
- Assumption: `broadcastProcessingStatus` callback remains valid
- Betrayal: `startSessionProcessor`'s finally block fires after `shutdown()` begins tearing down services. Callback invokes `broadcastProcessingStatus` on partially-destroyed WorkerService.
- Consequence: Not a new failure mode — same race exists today. No regression from extraction.
- Mitigation: No change needed. Existing behavior preserved.

## Log

- [2026-03-21T23:13:42Z] [Seth] SRE review (fresh session). 5 findings fixed in skeleton: (1) missing sessionEventBroadcaster dependency, (2) missing broadcastProcessingStatus callback dependency, (3) WorkerRef passthrough gap for agent.startSession calls, (4) vacuous WorkerRef type compliance warning (optional properties), (5) stale test count updated to 1163/34/3. Adversarial planning added 3 failure catalog entries: dynamic import path shift (CRITICAL — tsc won't catch), construction timing, shutdown callback race. New success criterion added for dynamic import verification. Anti-patterns strengthened with WorkerRef and broadcastProcessingStatus duplication prohibitions.
