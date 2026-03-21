import type { DatabaseManager } from '../DatabaseManager.js';
import type { SessionManager } from '../SessionManager.js';
import type { ActiveSession } from '../../worker-types.js';
import type { WorkerRef } from './types.js';
import { logger } from '../../../utils/logger.js';

/**
 * Abstract base class for all agent implementations.
 *
 * Provides shared constructor pattern for dependency injection of
 * DatabaseManager and SessionManager. Concrete agents (SDKAgent,
 * GeminiAgent, OpenRouterAgent) implement provider-specific startSession.
 */
export abstract class BaseAgent {
  protected dbManager: DatabaseManager;
  protected sessionManager: SessionManager;

  constructor(dbManager: DatabaseManager, sessionManager: SessionManager) {
    this.dbManager = dbManager;
    this.sessionManager = sessionManager;
  }

  abstract startSession(session: ActiveSession, worker?: WorkerRef): Promise<void>;
}
