/**
 * BaseAgent: Abstract base class for all observation extraction agents
 *
 * Responsibility:
 * - Shared constructor (dbManager, sessionManager)
 * - Shared prompt building helpers (init/continuation, observation, summary)
 * - Abstract startSession for provider-specific implementations
 *
 * Subclasses: SDKAgent, GeminiAgent, OpenRouterAgent
 */

import { DatabaseManager } from './DatabaseManager.js';
import { SessionManager } from './SessionManager.js';
import { logger } from '../../utils/logger.js';
import { buildInitPrompt, buildObservationPrompt, buildSummaryPrompt, buildContinuationPrompt } from '../../sdk/prompts.js';
import type { ActiveSession, PendingMessageWithId } from '../worker-types.js';
import type { WorkerRef } from './agents/types.js';
import type { ModeConfig } from '../domain/types.js';

export abstract class BaseAgent {
  protected dbManager: DatabaseManager;
  protected sessionManager: SessionManager;

  constructor(dbManager: DatabaseManager, sessionManager: SessionManager) {
    this.dbManager = dbManager;
    this.sessionManager = sessionManager;
  }

  /**
   * Start agent for a session — provider-specific implementation
   */
  abstract startSession(session: ActiveSession, worker?: WorkerRef): Promise<void>;

  /**
   * Build init or continuation prompt based on session state
   * Shared across all agents: init for first prompt, continuation for subsequent
   */
  buildSessionPrompt(session: ActiveSession, mode: ModeConfig): string {
    if (session.lastPromptNumber === 1) {
      return buildInitPrompt(session.project, session.contentSessionId, session.userPrompt, mode);
    }
    return buildContinuationPrompt(session.userPrompt, session.lastPromptNumber, session.contentSessionId, mode);
  }

  /**
   * Build observation prompt from a pending message
   * Shared across all agents: constructs Observation struct from PendingMessage fields
   */
  buildObsPrompt(message: PendingMessageWithId, originalTimestamp?: number | null): string {
    return buildObservationPrompt({
      id: 0,
      tool_name: message.tool_name!,
      tool_input: JSON.stringify(message.tool_input),
      tool_output: JSON.stringify(message.tool_response),
      created_at_epoch: originalTimestamp ?? Date.now(),
      cwd: message.cwd,
    });
  }

  /**
   * Build summary prompt from session and message data
   * Shared across all agents: constructs SDKSession struct from ActiveSession + message
   */
  buildSumPrompt(session: ActiveSession, message: PendingMessageWithId, mode: ModeConfig): string {
    return buildSummaryPrompt({
      id: session.sessionDbId,
      memory_session_id: session.memorySessionId,
      project: session.project,
      user_prompt: session.userPrompt,
      last_assistant_message: message.last_assistant_message || '',
    }, mode);
  }
}
