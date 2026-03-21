---
id: clmem-a4z
title: Extract BaseAgent with shared session lifecycle from SDKAgent, GeminiAgent, OpenRouterAgent
status: closed
type: task
parent: clmem-l6j
---





## Context
Second task in Phase 1 (clmem-l6j). Blocked by clmem-x2a (type system fix, now closed). Type baseline is clean — `tsc --noEmit` exits 0.

Three agent implementations share session lifecycle patterns (startSession, error handling, logging, response processing). Extract shared behavior into a BaseAgent abstract class. Concrete agents become thin provider-specific wrappers.

**Blocked by:** clmem-x2a (closed)
**Unlocks:** Sub-epic clmem-l6j progress toward BaseAgent criterion; reduces surface area for subsequent god-class decomposition tasks.

## Requirements
R1. Extract BaseAgent with shared session lifecycle from SDKAgent, OpenRouterAgent, and GeminiAgent. All 3 agents survive as thin provider-specific wrappers. (R1 from parent epic)

## Design

Source files:
- `src/services/worker/SDKAgent.ts` — primary agent, Claude SDK integration
- `src/services/worker/GeminiAgent.ts` — Gemini API fallback
- `src/services/worker/OpenRouterAgent.ts` — OpenRouter API fallback
- `src/services/worker/agents/types.ts` — shared types (WorkerRef, BaseAgentConfig, SSE payloads)
- `src/services/worker/agents/ResponseProcessor.ts` — response processing (already extracted)

Target:
- `src/services/worker/agents/BaseAgent.ts` — new abstract class with shared lifecycle

## Implementation

### Verified method inventory (LSP 2026-03-21)

**All 3 agents share:**
- `constructor(dbManager: DatabaseManager, sessionManager: SessionManager)` — identical signature
- `startSession(session: ActiveSession, workerRef?: WorkerRef)` — main entry, same signature
- `dbManager`, `sessionManager` properties

**Gemini + OpenRouter share (SDKAgent does NOT):**
- `fallbackAgent` property + `setFallbackAgent(agent)` method
- Multi-turn conversation loop: init prompt → obs prompts → summary prompt (identical flow structure)
- Conversation history conversion method (`conversationToGeminiContents` / `conversationToOpenAIMessages`)
- External HTTP query method (`queryGeminiMultiTurn` / `queryOpenRouterMultiTurn`)
- Provider config loader (`getGeminiConfig` / `getOpenRouterConfig`)

**SDKAgent unique (fundamentally different architecture):**
- `createMessageGenerator()` — Claude Agent SDK message stream
- `findClaudeExecutable()` — CLI binary discovery
- `getModelId()` — reads model from settings
- Uses `claude_agent_sdk` package, not HTTP fetch

### Step 1: Write failing test for BaseAgent constructor and properties
File: `tests/worker/agents/base-agent.test.ts`
Create a minimal concrete subclass (TestAgent) extending BaseAgent with stub `startSession`.
Test constructor accepts `dbManager` and `sessionManager`, stores them as properties.
Run test — should fail (BaseAgent doesn't exist yet).

### Step 2: Create BaseAgent abstract class with shared constructor
File: `src/services/worker/agents/BaseAgent.ts`
Abstract class with:
- `constructor(dbManager: DatabaseManager, sessionManager: SessionManager)` storing both as protected properties
- `abstract startSession(session: ActiveSession, workerRef?: WorkerRef): Promise<void>`
Run test from Step 1 — should pass.

### Step 3: Refactor GeminiAgent to extend BaseAgent
Remove duplicated `dbManager`/`sessionManager` property declarations and constructor body from GeminiAgent. Call `super(dbManager, sessionManager)`. Keep all Gemini-specific logic: `startSession`, `queryGeminiMultiTurn`, `conversationToGeminiContents`, `getGeminiConfig`, `fallbackAgent`, `setFallbackAgent`.
Run `tsc --noEmit` + relevant agent tests.

### Step 4: Refactor OpenRouterAgent to extend BaseAgent
Same pattern: remove duplicated constructor/properties, call `super()`. Keep all OpenRouter-specific logic.
Run `tsc --noEmit` + relevant agent tests.

### Step 5: Refactor SDKAgent to extend BaseAgent
Same pattern: remove duplicated constructor/properties, call `super()`. Keep all SDK-specific logic (`createMessageGenerator`, `findClaudeExecutable`, `getModelId`, full `startSession`).
Run `tsc --noEmit` + relevant agent tests.

### Step 6: Verify
Run full test suite. Run `npm run build-and-sync`. Verify no behavior changes.

### Design decision: Scope of shared lifecycle
The 3 agents share constructor + property storage but their `startSession` implementations are fundamentally different (SDK uses Agent SDK, Gemini/OpenRouter use HTTP multi-turn loops). BaseAgent extracts the constructor pattern and declares `startSession` as abstract. The multi-turn loop shared between Gemini/OpenRouter could be extracted into a `BaseHttpAgent extends BaseAgent` in a future task, but that's out of scope — this task extracts only what all 3 share.

## Success Criteria
- [x] `BaseAgent` abstract class exists at `src/services/worker/agents/BaseAgent.ts`
- [x] SDKAgent, GeminiAgent, OpenRouterAgent extend BaseAgent
- [x] Concrete agents contain ONLY provider-specific logic (API calls, config loading, response parsing)
- [x] Shared lifecycle methods live in BaseAgent (no duplication across agents)
- [x] `tsc --noEmit` exits 0
- [x] `npm run build-and-sync` succeeds
- [x] All existing tests pass (1160 pass — 1156 baseline + 4 new BaseAgent tests; 34 pre-existing failures unchanged)
- [x] No runtime behavior changes — agents behave identically to before

## Anti-Patterns
- NO adding DI containers, factories, or registries — simple class inheritance
- NO changing agent behavior — extract-only refactor
- NO `as any` casts or type suppressions
- NO creating BaseAgent with methods that only one agent uses — shared means 2+ agents share it
- FORBIDDEN: extracting methods without verifying they're actually duplicated across agents (LSP inventory in Step 1 is mandatory, not optional)

## Key Considerations
- ResponseProcessor is already extracted to `src/services/worker/agents/ResponseProcessor.ts` — BaseAgent should delegate to it, not absorb it
- SDKAgent is significantly more complex than Gemini/OpenRouter (Claude SDK vs simple HTTP APIs) — the base class should be shaped by the simpler agents' patterns, not SDKAgent's full complexity
- `WorkerRef` interface was fixed in clmem-x2a (sseBroadcaster now public) — BaseAgent can safely accept WorkerRef
- LSP inventory verified 2026-03-21: agents share constructor/properties but `startSession` implementations are architecturally different. BaseAgent will be thin (constructor + abstract startSession). Future `BaseHttpAgent` could extract the Gemini/OpenRouter multi-turn loop pattern.
- conversationHistory asymmetry: GeminiAgent pushes assistant responses to history, OpenRouterAgent has equivalent pushes commented out. BaseAgent MUST NOT normalize this — it's a behavioral difference that belongs in concrete agents.
- SRE re-verified 2026-03-21 (fresh session): constructor sigs identical (LSP hover), test baseline 1156 pass / 34 fail pre-existing, tsc clean.

## Log

- [2026-03-21T22:47:29Z] [Seth] Debrief: BaseAgent extracted cleanly. 25-line abstract class with constructor + abstract startSession. All 3 agents extend it. No workarounds needed. Logger import added for project convention test. 7 tests (4 core + 3 adversarial). Full suite: 1160 pass / 34 pre-existing fail. build-and-sync success. Reflections: skeleton matched reality exactly. No surprises. No user corrections. No cross-pollination. No memory updates needed. Next task: WorkerService decomposition (lifecycle vs orchestration, 1251 lines) — scoping blocked by LSP outage.
