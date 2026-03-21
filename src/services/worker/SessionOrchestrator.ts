import type { DatabaseManager } from './DatabaseManager.js';
import type { SessionManager } from './SessionManager.js';
import type { SSEBroadcaster } from './SSEBroadcaster.js';
import type { SDKAgent } from './SDKAgent.js';
import { type GeminiAgent, isGeminiSelected, isGeminiAvailable } from './GeminiAgent.js';
import { type OpenRouterAgent, isOpenRouterSelected, isOpenRouterAvailable } from './OpenRouterAgent.js';
import type { SessionEventBroadcaster } from './events/SessionEventBroadcaster.js';
import type { WorkerRef } from './agents/types.js';
import type { ActiveSession } from '../worker-types.js';
import { logger } from '../../utils/logger.js';
import { getProcessBySession, ensureProcessExit } from './ProcessRegistry.js';

export interface SessionOrchestratorDeps {
  sdkAgent: SDKAgent;
  geminiAgent: GeminiAgent;
  openRouterAgent: OpenRouterAgent;
  sessionManager: SessionManager;
  dbManager: DatabaseManager;
  sseBroadcaster: SSEBroadcaster;
  sessionEventBroadcaster: SessionEventBroadcaster;
  broadcastProcessingStatus: () => void;
  workerRef: WorkerRef;
}

export class SessionOrchestrator {
  private sdkAgent: SDKAgent;
  private geminiAgent: GeminiAgent;
  private openRouterAgent: OpenRouterAgent;
  private sessionManager: SessionManager;
  private dbManager: DatabaseManager;
  private sseBroadcaster: SSEBroadcaster;
  private sessionEventBroadcaster: SessionEventBroadcaster;
  private broadcastProcessingStatus: () => void;
  private workerRef: WorkerRef;

  private lastAiInteraction: {
    timestamp: number;
    success: boolean;
    provider: string;
    error?: string;
  } | null = null;

  constructor(deps: SessionOrchestratorDeps) {
    this.sdkAgent = deps.sdkAgent;
    this.geminiAgent = deps.geminiAgent;
    this.openRouterAgent = deps.openRouterAgent;
    this.sessionManager = deps.sessionManager;
    this.dbManager = deps.dbManager;
    this.sseBroadcaster = deps.sseBroadcaster;
    this.sessionEventBroadcaster = deps.sessionEventBroadcaster;
    this.broadcastProcessingStatus = deps.broadcastProcessingStatus;
    this.workerRef = deps.workerRef;
  }

  getLastAiInteraction() {
    return this.lastAiInteraction;
  }

  isSessionTerminatedError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    const normalized = msg.toLowerCase();
    return (
      normalized.includes('process aborted by user') ||
      normalized.includes('processtransport') ||
      normalized.includes('not ready for writing') ||
      normalized.includes('session generator failed') ||
      normalized.includes('claude code process')
    );
  }

  getActiveAgent(): SDKAgent | GeminiAgent | OpenRouterAgent {
    if (isOpenRouterSelected() && isOpenRouterAvailable()) {
      return this.openRouterAgent;
    }
    if (isGeminiSelected() && isGeminiAvailable()) {
      return this.geminiAgent;
    }
    return this.sdkAgent;
  }

  startSessionProcessor(
    session: ActiveSession | null,
    source: string
  ): void {
    if (!session) return;

    const sid = session.sessionDbId;
    const agent = this.getActiveAgent();
    const providerName = agent.constructor.name;

    // Before starting generator, check if AbortController is already aborted
    // This can happen after a previous generator was aborted but the session still has pending work
    if (session.abortController.signal.aborted) {
      logger.debug('SYSTEM', 'Replacing aborted AbortController before starting generator', {
        sessionId: session.sessionDbId
      });
      session.abortController = new AbortController();
    }

    // Track whether generator failed with an unrecoverable error to prevent infinite restart loops
    let hadUnrecoverableError = false;
    let sessionFailed = false;

    logger.info('SYSTEM', `Starting generator (${source}) using ${providerName}`, { sessionId: sid });

    // Track generator activity for stale detection (Issue #1099)
    session.lastGeneratorActivity = Date.now();

    session.generatorPromise = agent.startSession(session, this.workerRef)
      .catch(async (error: unknown) => {
        const errorMessage = (error as Error)?.message || '';

        // Detect unrecoverable errors that should NOT trigger restart
        // These errors will fail immediately on retry, causing infinite loops
        const unrecoverablePatterns = [
          'Claude executable not found',
          'CLAUDE_CODE_PATH',
          'ENOENT',
          'spawn',
          'Invalid API key',
          'FOREIGN KEY constraint failed',
        ];
        if (unrecoverablePatterns.some(pattern => errorMessage.includes(pattern))) {
          hadUnrecoverableError = true;
          this.lastAiInteraction = {
            timestamp: Date.now(),
            success: false,
            provider: providerName,
            error: errorMessage,
          };
          logger.error('SDK', 'Unrecoverable generator error - will NOT restart', {
            sessionId: session.sessionDbId,
            project: session.project,
            errorMessage
          });
          return;
        }

        // Fallback for terminated SDK sessions (provider abstraction)
        if (this.isSessionTerminatedError(error)) {
          logger.warn('SDK', 'SDK resume failed, falling back to standalone processing', {
            sessionId: session.sessionDbId,
            project: session.project,
            reason: error instanceof Error ? error.message : String(error)
          });
          return this.runFallbackForTerminatedSession(session, error);
        }

        // Detect stale resume failures - SDK session context was lost
        if ((errorMessage.includes('aborted by user') || errorMessage.includes('No conversation found'))
            && session.memorySessionId) {
          logger.warn('SDK', 'Detected stale resume failure, clearing memorySessionId for fresh start', {
            sessionId: session.sessionDbId,
            memorySessionId: session.memorySessionId,
            errorMessage
          });
          // Clear stale memorySessionId and force fresh init on next attempt
          this.dbManager.getSessionStore().updateMemorySessionId(session.sessionDbId, null);
          session.memorySessionId = null;
          session.forceInit = true;
        }
        logger.error('SDK', 'Session generator failed', {
          sessionId: session.sessionDbId,
          project: session.project,
          provider: providerName
        }, error as Error);
        sessionFailed = true;
        this.lastAiInteraction = {
          timestamp: Date.now(),
          success: false,
          provider: providerName,
          error: errorMessage,
        };
        throw error;
      })
      .finally(async () => {
        // CRITICAL: Verify subprocess exit to prevent zombie accumulation (Issue #1168)
        const trackedProcess = getProcessBySession(session.sessionDbId);
        if (trackedProcess && trackedProcess.process.exitCode === null) {
          await ensureProcessExit(trackedProcess, 5000);
        }

        session.generatorPromise = null;

        // Record successful AI interaction if no error occurred
        if (!sessionFailed && !hadUnrecoverableError) {
          this.lastAiInteraction = {
            timestamp: Date.now(),
            success: true,
            provider: providerName,
          };
        }

        // Do NOT restart after unrecoverable errors - prevents infinite loops
        if (hadUnrecoverableError) {
          logger.warn('SYSTEM', 'Skipping restart due to unrecoverable error', {
            sessionId: session.sessionDbId
          });
          this.broadcastProcessingStatus();
          return;
        }

        // Store for pending-count check below
        const { PendingMessageStore } = require('../sqlite/PendingMessageStore.js');
        const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);

        // Idle timeout means no new work arrived for 3 minutes - don't restart
        // No need to reset stale processing messages here — claimNextMessage() self-heals
        if (session.idleTimedOut) {
          logger.info('SYSTEM', 'Generator exited due to idle timeout, not restarting', {
            sessionId: session.sessionDbId
          });
          session.idleTimedOut = false; // Reset flag
          this.broadcastProcessingStatus();
          return;
        }

        // Check if there's pending work that needs processing with a fresh AbortController
        const pendingCount = pendingStore.getPendingCount(session.sessionDbId);
        const MAX_PENDING_RESTARTS = 3;

        if (pendingCount > 0) {
          // Track consecutive pending-work restarts to prevent infinite loops (e.g. FK errors)
          session.consecutiveRestarts = (session.consecutiveRestarts || 0) + 1;

          if (session.consecutiveRestarts > MAX_PENDING_RESTARTS) {
            logger.error('SYSTEM', 'Exceeded max pending-work restarts, stopping to prevent infinite loop', {
              sessionId: session.sessionDbId,
              pendingCount,
              consecutiveRestarts: session.consecutiveRestarts
            });
            session.consecutiveRestarts = 0;
            this.broadcastProcessingStatus();
            return;
          }

          logger.info('SYSTEM', 'Pending work remains after generator exit, restarting with fresh AbortController', {
            sessionId: session.sessionDbId,
            pendingCount,
            attempt: session.consecutiveRestarts
          });
          // Reset AbortController for restart
          session.abortController = new AbortController();
          // Restart processor
          this.startSessionProcessor(session, 'pending-work-restart');
        } else {
          // Successful completion with no pending work — reset counter
          session.consecutiveRestarts = 0;
        }

        this.broadcastProcessingStatus();
      });
  }

  async runFallbackForTerminatedSession(
    session: ActiveSession | null,
    _originalError: unknown
  ): Promise<void> {
    if (!session) return;

    const sessionDbId = session.sessionDbId;

    // Fallback agents need memorySessionId for storeObservations
    if (!session.memorySessionId) {
      const syntheticId = `fallback-${sessionDbId}-${Date.now()}`;
      session.memorySessionId = syntheticId;
      this.dbManager.getSessionStore().updateMemorySessionId(sessionDbId, syntheticId);
    }

    if (isGeminiAvailable()) {
      try {
        await this.geminiAgent.startSession(session, this.workerRef);
        return;
      } catch (e) {
        logger.warn('SDK', 'Fallback Gemini failed, trying OpenRouter', {
          sessionId: sessionDbId,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    if (isOpenRouterAvailable()) {
      try {
        await this.openRouterAgent.startSession(session, this.workerRef);
        return;
      } catch (e) {
        logger.warn('SDK', 'Fallback OpenRouter failed', {
          sessionId: sessionDbId,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    // No fallback or both failed: mark messages abandoned and remove session so queue doesn't grow
    const pendingStore = this.sessionManager.getPendingMessageStore();
    const abandoned = pendingStore.markAllSessionMessagesAbandoned(sessionDbId);
    if (abandoned > 0) {
      logger.warn('SDK', 'No fallback available; marked pending messages abandoned', {
        sessionId: sessionDbId,
        abandoned
      });
    }
    this.sessionManager.removeSessionImmediate(sessionDbId);
    this.sessionEventBroadcaster.broadcastSessionCompleted(sessionDbId);
  }

  async processPendingQueues(sessionLimit: number = 10): Promise<{
    totalPendingSessions: number;
    sessionsStarted: number;
    sessionsSkipped: number;
    startedSessionIds: number[];
  }> {
    const { PendingMessageStore } = await import('../sqlite/PendingMessageStore.js');
    const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
    const sessionStore = this.dbManager.getSessionStore();

    // Clean up stale 'active' sessions before processing
    // Sessions older than 6 hours without activity are likely orphaned
    const STALE_SESSION_THRESHOLD_MS = 6 * 60 * 60 * 1000;
    const staleThreshold = Date.now() - STALE_SESSION_THRESHOLD_MS;

    try {
      const staleSessionIds = sessionStore.db.prepare(`
        SELECT id FROM sdk_sessions
        WHERE status = 'active' AND started_at_epoch < ?
      `).all(staleThreshold) as { id: number }[];

      if (staleSessionIds.length > 0) {
        const ids = staleSessionIds.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');

        sessionStore.db.prepare(`
          UPDATE sdk_sessions
          SET status = 'failed', completed_at_epoch = ?
          WHERE id IN (${placeholders})
        `).run(Date.now(), ...ids);

        logger.info('SYSTEM', `Marked ${ids.length} stale sessions as failed`);

        const msgResult = sessionStore.db.prepare(`
          UPDATE pending_messages
          SET status = 'failed', failed_at_epoch = ?
          WHERE status = 'pending'
          AND session_db_id IN (${placeholders})
        `).run(Date.now(), ...ids);

        if (msgResult.changes > 0) {
          logger.info('SYSTEM', `Marked ${msgResult.changes} pending messages from stale sessions as failed`);
        }
      }
    } catch (error) {
      logger.error('SYSTEM', 'Failed to clean up stale sessions', {}, error as Error);
    }

    const orphanedSessionIds = pendingStore.getSessionsWithPendingMessages();

    const result = {
      totalPendingSessions: orphanedSessionIds.length,
      sessionsStarted: 0,
      sessionsSkipped: 0,
      startedSessionIds: [] as number[]
    };

    if (orphanedSessionIds.length === 0) return result;

    logger.info('SYSTEM', `Processing up to ${sessionLimit} of ${orphanedSessionIds.length} pending session queues`);

    for (const sessionDbId of orphanedSessionIds) {
      if (result.sessionsStarted >= sessionLimit) break;

      try {
        const existingSession = this.sessionManager.getSession(sessionDbId);
        if (existingSession?.generatorPromise) {
          result.sessionsSkipped++;
          continue;
        }

        const session = this.sessionManager.initializeSession(sessionDbId);
        logger.info('SYSTEM', `Starting processor for session ${sessionDbId}`, {
          project: session.project,
          pendingCount: pendingStore.getPendingCount(sessionDbId)
        });

        this.startSessionProcessor(session, 'startup-recovery');
        result.sessionsStarted++;
        result.startedSessionIds.push(sessionDbId);

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('SYSTEM', `Failed to process session ${sessionDbId}`, {}, error as Error);
        result.sessionsSkipped++;
      }
    }

    return result;
  }
}
