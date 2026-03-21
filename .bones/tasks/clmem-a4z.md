---
id: clmem-a4z
title: Extract BaseAgent with shared session lifecycle from SDKAgent, GeminiAgent, OpenRouterAgent
status: open
type: task
priority: 1
parent: clmem-l6j
---

## Context
Second task in Phase 1 (clmem-l6j). Blocked by: none (clmem-x2a closed — type system clean). Unlocks: R1 complete, all 3 agents < 200 lines, BaseAgent.ts exists. Independent of R2-R4 (god class splits).

All three agents (SDKAgent 489 lines, GeminiAgent 471, OpenRouterAgent 474) share the same constructor pattern (`dbManager`, `sessionManager`), same `startSession(session, worker?)` signature, same imports (DatabaseManager, SessionManager, logger, prompts, SettingsDefaultsManager, ModeManager, processAgentResponse), and the same response processing pipeline. Each has provider-specific API calls and configuration.

## Requirements
R1. Extract `BaseAgent` with shared session lifecycle from SDKAgent, OpenRouterAgent, and GeminiAgent. All 3 agents survive as thin provider-specific wrappers.

## Implementation

1. **Identify shared lifecycle** — Read all three agent files via LSP (`documentSymbol` on each). Catalog which methods/fields are shared across all three vs provider-specific. Expected shared: constructor, session setup, prompt building, response processing, error handling, abort handling. Expected provider-specific: API calls, config loading, model selection, rate limiting.

2. **Write failing test for BaseAgent** — Create `tests/worker/agents/base-agent.test.ts`. Test that BaseAgent can be constructed with `dbManager` and `sessionManager`, exposes `startSession` as abstract, and that a minimal concrete subclass can be instantiated. Run test — expect fail (BaseAgent doesn't exist).

3. **Create BaseAgent** — `src/services/worker/BaseAgent.ts`. Abstract class with:
   - Constructor taking `dbManager: DatabaseManager`, `sessionManager: SessionManager`
   - Abstract `startSession(session: ActiveSession, worker?: WorkerRef): Promise<void>`
   - Shared protected methods extracted from the three agents (prompt building helpers, response processing delegation, abort signal handling, session lifecycle logging)
   - Re-export from `src/services/worker/agents/index.ts`

4. **Run test — should pass**

5. **Refactor SDKAgent to extend BaseAgent** — Remove duplicated constructor, session lifecycle, and shared methods. Keep SDK-specific: Claude executable finding, Agent SDK query loop, PID capture, spawn options. Target: < 200 lines.

6. **Run all tests — must pass**

7. **Refactor GeminiAgent to extend BaseAgent** — Remove duplicated constructor, session lifecycle, shared methods. Keep Gemini-specific: REST API calls, rate limiting, model selection, billing config, conversation history management. Target: < 200 lines.

8. **Run all tests — must pass**

9. **Refactor OpenRouterAgent to extend BaseAgent** — Remove duplicated constructor, session lifecycle, shared methods. Keep OpenRouter-specific: REST API calls, model selection, context window management, app name config. Target: < 200 lines.

10. **Run all tests — must pass**

11. **Verify line counts** — `wc -l` on all four files. BaseAgent.ts should exist, each agent < 200 lines.

12. **Run `npx tsc --noEmit` — must exit 0**

13. **Run `npm run build-and-sync` — must succeed**

## Success Criteria
- [ ] BaseAgent.ts exists at `src/services/worker/BaseAgent.ts` with shared session lifecycle
- [ ] SDKAgent.ts < 200 lines, extends BaseAgent
- [ ] GeminiAgent.ts < 200 lines, extends BaseAgent
- [ ] OpenRouterAgent.ts < 200 lines, extends BaseAgent
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass
- [ ] No runtime behavior changes (tests prove equivalence)

## Anti-Patterns
- NO behavior changes — extract along natural seams, preserve identical runtime behavior
- NO new abstractions beyond BaseAgent — don't add factories, DI, or registries
- NO `as any` casts to fix extraction-related type issues
- NO leaving permanent re-exports to hit line count targets — callers must be updated
- NO moving provider-specific logic into BaseAgent "for convenience"
- NO changing the public API of any agent (startSession signature, constructor args)

## Key Considerations
- `processAgentResponse` already exists in `agents/index.ts` as shared utility — BaseAgent should delegate to it, not duplicate it
- SDKAgent uses `@ts-ignore` on Agent SDK import (line 28) — preserve this, it's intentional
- GeminiAgent has provider-specific types (GeminiModel, rate limits) that stay in GeminiAgent
- OpenRouterAgent has OpenAI-compatible message types that stay in OpenRouterAgent
- ModeManager is imported by all three — BaseAgent should own this import
- The `sanitizeEnv` function is only used by SDKAgent (for spawn env) — stays in SDKAgent
- All three agents import prompt builders (`buildInitPrompt`, etc.) — BaseAgent should own these imports if all agents use them the same way
