---
id: clmem-a4z
title: Extract BaseAgent with shared session lifecycle from SDKAgent, GeminiAgent, OpenRouterAgent
status: open
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

**NOTE: LSP was down during planning. SRE MUST re-verify agent method inventories and shared patterns with working LSP before executing.**

Source files:
- `src/services/worker/SDKAgent.ts` — primary agent, Claude SDK integration
- `src/services/worker/GeminiAgent.ts` — Gemini API fallback
- `src/services/worker/OpenRouterAgent.ts` — OpenRouter API fallback
- `src/services/worker/agents/types.ts` — shared types (WorkerRef, BaseAgentConfig, SSE payloads)
- `src/services/worker/agents/ResponseProcessor.ts` — response processing (already extracted)

Target:
- `src/services/worker/agents/BaseAgent.ts` — new abstract class with shared lifecycle

## Implementation

### Step 1: Inventory shared patterns across the three agents
Use LSP documentSymbol on each agent file to catalog all methods. Compare method signatures and bodies to identify:
- Identical methods (extract directly)
- Similar methods with provider-specific variation (extract with abstract hook)
- Unique methods (leave in concrete agent)

Key patterns to look for: session initialization, error handling/retry, logging setup, WorkerRef broadcasting, response processing delegation, config loading.

### Step 2: Write failing test for BaseAgent lifecycle
File: `tests/worker/agents/base-agent.test.ts`
Create a minimal concrete subclass (TestAgent) extending BaseAgent.
Test that shared lifecycle methods work: session start logging, error handling, WorkerRef broadcasting.
Run test — should fail (BaseAgent doesn't exist yet).

### Step 3: Create BaseAgent abstract class
File: `src/services/worker/agents/BaseAgent.ts`
Based on Step 1 inventory, extract shared methods. Define abstract methods for provider-specific hooks (e.g., `abstract createSession()`, `abstract processResponse()`).
Shared lifecycle: startSession orchestration, error handling patterns, logging, WorkerRef interaction.

### Step 4: Refactor SDKAgent to extend BaseAgent
Remove duplicated lifecycle methods from SDKAgent. Keep only SDK-specific logic: Claude API session creation, tool handling, message processing.
Run `tsc --noEmit` — must exit 0.
Run tests — must all pass.

### Step 5: Refactor GeminiAgent to extend BaseAgent
Same pattern as Step 4 for Gemini-specific logic.
Run `tsc --noEmit` — must exit 0.
Run tests — must all pass.

### Step 6: Refactor OpenRouterAgent to extend BaseAgent
Same pattern as Step 4 for OpenRouter-specific logic.
Run `tsc --noEmit` — must exit 0.
Run tests — must all pass.

### Step 7: Verify and clean up
Run full test suite. Run `npm run build-and-sync`. Verify no behavior changes.

## Success Criteria
- [ ] `BaseAgent` abstract class exists at `src/services/worker/agents/BaseAgent.ts`
- [ ] SDKAgent, GeminiAgent, OpenRouterAgent extend BaseAgent
- [ ] Concrete agents contain ONLY provider-specific logic (API calls, config loading, response parsing)
- [ ] Shared lifecycle methods live in BaseAgent (no duplication across agents)
- [ ] `tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass (1156 passes maintained)
- [ ] No runtime behavior changes — agents behave identically to before

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
- LSP was down during planning — Step 1 (inventory) is a verification gate. If the agents share less than expected, reduce scope and surface to user
