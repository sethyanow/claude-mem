---
id: clmem-a4z
title: Extract BaseAgent with shared session lifecycle from SDKAgent, GeminiAgent, OpenRouterAgent
status: active
type: task
priority: 1
parent: clmem-l6j
---



## Context
Second task in Phase 1 (clmem-l6j). Blocked by: none (clmem-x2a closed — type system clean). Unlocks: R1 complete, all 3 agents < 200 lines, BaseAgent.ts exists. Independent of R2-R4 (god class splits).

All three agents (SDKAgent 489 lines, GeminiAgent 471, OpenRouterAgent 474) share the same constructor pattern (`dbManager`, `sessionManager`), same `startSession(session, worker?)` signature, and the same prompt-building + response-processing calls. Each has provider-specific API calls and configuration.

**SRE-verified shared surface (all three):**
- Constructor: `dbManager: DatabaseManager`, `sessionManager: SessionManager`
- `startSession(session: ActiveSession, worker?: WorkerRef): Promise<void>` signature
- Prompt builders: `buildInitPrompt`, `buildObservationPrompt`, `buildSummaryPrompt`, `buildContinuationPrompt`
- `processAgentResponse` delegation
- `ModeManager.getInstance().getActiveMode()` call
- `sessionManager.getMessageIterator()` message loop (in SDKAgent this is inside `createMessageGenerator`; in Gemini/OpenRouter it's in `startSession`)
- Session completion logging pattern

**SRE-verified shared between Gemini and OpenRouter ONLY:**
- `fallbackAgent` property + `setFallbackAgent` method
- `shouldFallbackToClaude` + `isAbortError` error handling
- Synthetic `memorySessionId` generation
- Token estimation (70/30 rough split)
- The observation/summary message processing loop (nearly identical ~120 lines each)

**SRE-verified SDK-only:**
- Agent SDK subprocess spawning (`query()`, `createMessageGenerator`)
- ProcessRegistry (PID tracking, zombie cleanup)
- Environment isolation (`sanitizeEnv`, `buildIsolatedEnv`)
- Real memorySessionId capture from SDK responses (not synthetic)
- SDK-specific error detection (context overflow, invalid API key from response text)
- Concurrent agent slot management (`waitForSlot`)
- `findClaudeExecutable` (42 lines), `getModelId` (6 lines)
- `createMessageGenerator` (109 lines)

## Requirements
R1. Extract `BaseAgent` with shared session lifecycle from SDKAgent, OpenRouterAgent, and GeminiAgent. All 3 agents survive as thin provider-specific wrappers.

## Implementation

1. **Verify shared surface** — Use LSP (`documentSymbol` on each agent file). Confirm the shared surface documented in Context matches reality. The SRE-verified inventory above is the starting point, not a from-scratch investigation.

2. **Write failing tests for BaseAgent** — Create `tests/worker/agents/base-agent.test.ts`. Tests must verify **shared behavior**, not just class structure:
   - Concrete subclass can be constructed with `dbManager` and `sessionManager`
   - `buildSessionPrompt()` returns init prompt for `lastPromptNumber === 1` and continuation prompt for `> 1`
   - `processMessage()` (or equivalent shared method) correctly delegates observation messages to `buildObservationPrompt` + `processAgentResponse`
   - `processMessage()` correctly delegates summary messages to `buildSummaryPrompt` + `processAgentResponse`
   - Session completion logging fires with correct provider name
   - Run tests — expect fail (BaseAgent doesn't exist).

3. **Create BaseAgent** — `src/services/worker/BaseAgent.ts`. Abstract class with:
   - Constructor taking `dbManager: DatabaseManager`, `sessionManager: SessionManager`
   - Abstract `startSession(session: ActiveSession, worker?: WorkerRef): Promise<void>`
   - Protected `buildSessionPrompt(session, mode)` — init vs continuation prompt selection (shared across all three)
   - Protected `processMessage(message, session, ...)` — the observation/summary message handler that builds prompts, tracks message IDs, captures cwd, delegates to `processAgentResponse` (shared loop body across all three)
   - Protected session completion logging helper
   - Re-export from `src/services/worker/agents/index.ts`

4. **Run test — should pass**

5. **Refactor SDKAgent to extend BaseAgent** — Remove duplicated constructor, use `buildSessionPrompt` in `createMessageGenerator`, use `processMessage` where applicable. Keep SDK-specific: `findClaudeExecutable`, `getModelId`, `createMessageGenerator` (as a thin wrapper using BaseAgent helpers), Agent SDK query loop, PID/ProcessRegistry, env isolation. **Note: SDKAgent has ~350+ lines of genuinely SDK-specific code — may need to extract `findClaudeExecutable` and SDK config helpers to a separate `SDKUtils.ts` to hit < 200 lines in the agent file.**

6. **Run all tests — must pass**

7. **Refactor GeminiAgent to extend BaseAgent** — Remove duplicated constructor, mode loading, init prompt building, message loop body. Keep Gemini-specific: `queryGeminiMultiTurn`, `getGeminiConfig`, `conversationToGeminiContents`, rate limiting, Gemini types, `setFallbackAgent`/fallback error handling. Target: < 200 lines.

8. **Run all tests — must pass**

9. **Refactor OpenRouterAgent to extend BaseAgent** — Remove duplicated constructor, mode loading, init prompt building, message loop body. Keep OpenRouter-specific: `queryOpenRouterMultiTurn`, `getOpenRouterConfig`, `conversationToOpenAIMessages`, `truncateHistory`, `estimateTokens`, OpenRouter types, `setFallbackAgent`/fallback error handling. Target: < 200 lines.

10. **Run all tests — must pass**

11. **Verify line counts** — `wc -l` on all agent files. BaseAgent.ts should exist, each agent < 200 lines. If SDKAgent exceeds 200 after extraction, document what remains and why — escalate to user rather than force-fitting.

12. **Run `npx tsc --noEmit` — must exit 0**

13. **Run `npm run build-and-sync` — must succeed**

## Success Criteria
- [ ] BaseAgent.ts exists at `src/services/worker/BaseAgent.ts` with shared session lifecycle
- [ ] BaseAgent contains 2+ shared protected methods (not just constructor + abstract startSession)
- [ ] SDKAgent.ts < 200 lines, extends BaseAgent (if unreachable due to SDK-specific code volume, escalate with evidence — do not weaken criterion silently)
- [ ] GeminiAgent.ts < 200 lines, extends BaseAgent
- [ ] OpenRouterAgent.ts < 200 lines, extends BaseAgent
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass (34 pre-existing failures baseline)
- [ ] No runtime behavior changes (tests prove equivalence)
- [ ] BaseAgent tests verify shared behavior (prompt building, message processing delegation), not just class structure

## Anti-Patterns
- NO behavior changes — extract along natural seams, preserve identical runtime behavior
- NO new abstractions beyond BaseAgent — don't add factories, DI, or registries (extracting SDK-specific helpers to a utility module like `SDKUtils.ts` is fine — that's decomposition, not abstraction)
- NO `as any` casts to fix extraction-related type issues
- NO leaving permanent re-exports to hit line count targets — callers must be updated
- NO moving provider-specific logic into BaseAgent "for convenience"
- NO changing the public API of any agent (startSession signature, constructor args)
- NO creating a trivial BaseAgent (just constructor + abstract startSession) to claim "BaseAgent exists" — BaseAgent must contain meaningful shared lifecycle logic (prompt building, message processing delegation)
- NO silently weakening the < 200 line target — if SDKAgent can't reach it, escalate with evidence showing what's genuinely SDK-specific

## Key Considerations
- `processAgentResponse` already exists in `agents/index.ts` as shared utility — BaseAgent should delegate to it, not duplicate it
- SDKAgent uses `@ts-ignore` on Agent SDK import (line 28) — preserve this, it's intentional
- GeminiAgent has provider-specific types (GeminiModel, rate limits) that stay in GeminiAgent
- OpenRouterAgent has OpenAI-compatible message types that stay in OpenRouterAgent
- ModeManager is imported by all three — BaseAgent should own this import
- The `sanitizeEnv` function is only used by SDKAgent (for spawn env) — stays in SDKAgent
- All three agents import prompt builders (`buildInitPrompt`, etc.) — BaseAgent should own these imports if all agents use them the same way

### SRE Edge Cases (verified by code read)
- **Asymmetric fallbackAgent:** Gemini and OpenRouter have `fallbackAgent: FallbackAgent | null` + `setFallbackAgent()`. SDKAgent does NOT. BaseAgent should NOT include fallbackAgent — it would force SDKAgent to inherit an unused pattern. Gemini/OpenRouter keep `setFallbackAgent` as their own method. The `FallbackAgent` interface already exists in `agents/types.ts`.
- **SDKAgent execution model divergence:** SDKAgent's `createMessageGenerator` yields prompts to an SDK subprocess; Gemini/OpenRouter call REST APIs directly. The shared message loop body (iterate SessionManager messages → build prompt → track IDs) exists in all three, but the WRAPPER differs. BaseAgent's `processMessage` should handle the loop body; each agent owns how the prompt is sent to the provider.
- **SDKAgent line count risk:** SDKAgent has ~350+ lines of genuinely SDK-specific code: `findClaudeExecutable` (42), `createMessageGenerator` (109), `getModelId` (6), SDK query setup + message processing (~200). Hitting < 200 requires extracting SDK helpers to a separate module (e.g., `SDKUtils.ts`). This is valid decomposition per epic approach ("extract interface → move methods"). If still over 200, escalate — don't game the count.
- **Existing types:** `BaseAgentConfig` interface already exists in `agents/types.ts` (line 117) with `dbManager` and `sessionManager`. BaseAgent's constructor should use or align with this existing type.
- **OpenRouterAgent commented-out conversation history push:** OpenRouterAgent has `// session.conversationHistory.push(...)` commented out in observation and summary response handling (lines 117, 188, 230 — ALL three push sites for assistant responses). GeminiAgent actively pushes (lines 162, 233, 283). This difference must be preserved — don't assume they're identical.

### Adversarial Failure Catalog

**Temporal Betrayal: SDKAgent dual-use of shared methods**
- Assumption: BaseAgent's shared message-handling methods can be used by all three agents in the same way.
- Betrayal: SDKAgent's `createMessageGenerator` builds prompts and YIELDS them without processing responses — response processing happens separately in `startSession` when SDK responds. Gemini/OpenRouter build prompts AND process responses in the same loop iteration.
- Consequence: If BaseAgent provides a monolithic "handle message end-to-end" method, SDKAgent can't use it — its yield-then-process-later model doesn't fit. Agent either can't use shared methods (defeating the purpose) or forces SDKAgent into a different execution model (behavior change).
- Mitigation: BaseAgent's shared methods must be decomposable: `buildPromptForMessage(message)` (prompt construction only — used by all three) separate from response processing delegation. SDKAgent uses `buildPromptForMessage` in `createMessageGenerator`; Gemini/OpenRouter use both in their loop.

**State Corruption: conversationHistory asymmetry**
- Assumption: Gemini and OpenRouter handle `session.conversationHistory` identically.
- Betrayal: GeminiAgent actively pushes assistant responses to conversationHistory (lines 162, 233, 283). OpenRouterAgent has ALL three push sites commented out (lines 117, 188, 230).
- Consequence: If BaseAgent's shared `processMessage` includes `session.conversationHistory.push(response)`, OpenRouterAgent's behavior changes silently — it would start accumulating conversation history it previously didn't. This could affect context window management (`truncateHistory`) and token estimation.
- Mitigation: conversationHistory push must NOT be in BaseAgent's shared methods. Each agent decides whether to push. Alternatively, BaseAgent provides a protected `shouldTrackConversationHistory(): boolean` that subclasses override — but this adds complexity for a two-line difference (YAGNI). Simpler: keep conversationHistory management in each agent.

**State Corruption: field visibility**
- Assumption: BaseAgent stores `dbManager` and `sessionManager` with appropriate access level.
- Betrayal: If BaseAgent declares them as `private`, all three subclasses break — they all reference `this.dbManager` and `this.sessionManager` throughout their methods.
- Consequence: TypeScript compiler error. Caught at build time, not runtime.
- Mitigation: BaseAgent MUST declare both as `protected`. This is a compile-time guarantee, not a runtime risk.

**Dependency Treachery: error handling scope**
- Assumption: BaseAgent's shared methods can be wrapped by each agent's error handling.
- Betrayal: If BaseAgent's shared methods catch and handle errors internally (e.g., logging + swallowing), Gemini/OpenRouter's fallback-to-Claude pattern breaks — errors never propagate to the catch block that triggers `shouldFallbackToClaude`.
- Consequence: API errors don't trigger fallback to Claude SDK. Sessions silently fail instead of falling back gracefully.
- Mitigation: BaseAgent's shared methods MUST NOT catch errors. They propagate exceptions. Error handling strategy (fallback vs throw vs abort check) stays in each agent's `startSession` or its own catch blocks.

**Dependency Treachery: OpenRouterAgent empty-response handling**
- Assumption: All agents handle empty API responses the same way.
- Betrayal: GeminiAgent wraps `processAgentResponse` in `if (obsResponse.content)` — skips processing on empty response. OpenRouterAgent calls `processAgentResponse(obsResponse.content || '', ...)` — always processes, passing empty string if no content.
- Consequence: If BaseAgent's shared method uses one pattern, the other agent's behavior changes.
- Mitigation: Empty-response handling must stay in each agent, not in BaseAgent. BaseAgent provides the prompt building; each agent decides what to do with empty responses.

## Log

- [2026-03-21T21:34:12Z] [Seth] SRE Review Complete (fresh session). Key findings: (1) SDKAgent < 200 lines may be unreachable — has ~350+ lines genuinely SDK-specific code. Skeleton updated to escalate rather than silently weaken. (2) Agents don't share as much as originally claimed — SDKAgent event stream vs Gemini/OpenRouter REST loop are fundamentally different execution models. Shared surface is narrower: constructor, prompt building, processAgentResponse delegation. (3) conversationHistory asymmetry: GeminiAgent pushes assistant responses, OpenRouterAgent has all pushes commented out — BaseAgent MUST NOT normalize this. (4) Adversarial findings added: temporal betrayal (SDKAgent dual-use), state corruption (history asymmetry, field visibility), dependency treachery (error handling scope, empty-response handling differences). (5) Success criteria strengthened: added BaseAgent content verification, test behavior verification, escalation protocol for line count misses.
