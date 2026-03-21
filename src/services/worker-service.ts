/**
 * Worker Service - Slim Orchestrator
 *
 * Refactored from 2000-line monolith to ~300-line orchestrator.
 * Delegates to specialized modules:
 * - src/services/server/ - HTTP server, middleware, error handling
 * - src/services/infrastructure/ - Process management, health monitoring, shutdown
 * - src/services/integrations/ - IDE integrations (Cursor)
 * - src/services/worker/ - Business logic, routes, agents
 */

import path from 'path';
import { existsSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getWorkerPort, getWorkerHost } from '../shared/worker-utils.js';
import { HOOK_TIMEOUTS } from '../shared/hook-constants.js';
import { SettingsDefaultsManager } from '../shared/SettingsDefaultsManager.js';
import { getAuthMethodDescription } from '../shared/EnvManager.js';
import { logger } from '../utils/logger.js';
import { ChromaMcpManager } from './sync/ChromaMcpManager.js';
import { ChromaSync } from './sync/ChromaSync.js';
import { configureSupervisorSignalHandlers, getSupervisor, startSupervisor } from '../supervisor/index.js';
import { sanitizeEnv } from '../supervisor/env-sanitizer.js';

// Windows: avoid repeated spawn popups when startup fails (issue #921)
const WINDOWS_SPAWN_COOLDOWN_MS = 2 * 60 * 1000;

function getWorkerSpawnLockPath(): string {
  return path.join(SettingsDefaultsManager.get('CLAUDE_MEM_DATA_DIR'), '.worker-start-attempted');
}

function shouldSkipSpawnOnWindows(): boolean {
  if (process.platform !== 'win32') return false;
  const lockPath = getWorkerSpawnLockPath();
  if (!existsSync(lockPath)) return false;
  try {
    const modifiedTimeMs = statSync(lockPath).mtimeMs;
    return Date.now() - modifiedTimeMs < WINDOWS_SPAWN_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markWorkerSpawnAttempted(): void {
  if (process.platform !== 'win32') return;
  try {
    writeFileSync(getWorkerSpawnLockPath(), '', 'utf-8');
  } catch {
    // Best-effort lock file — failure to write shouldn't block startup
  }
}

function clearWorkerSpawnAttempted(): void {
  if (process.platform !== 'win32') return;
  try {
    const lockPath = getWorkerSpawnLockPath();
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    // Best-effort cleanup
  }
}

// Re-export for backward compatibility — canonical implementation in shared/plugin-state.ts
export { isPluginDisabledInClaudeSettings } from '../shared/plugin-state.js';
import { isPluginDisabledInClaudeSettings } from '../shared/plugin-state.js';

// Version injected at build time by esbuild define
declare const __DEFAULT_PACKAGE_VERSION__: string;
const packageVersion = typeof __DEFAULT_PACKAGE_VERSION__ !== 'undefined' ? __DEFAULT_PACKAGE_VERSION__ : '0.0.0-dev';

// Infrastructure imports
import {
  writePidFile,
  readPidFile,
  removePidFile,
  getPlatformTimeout,
  aggressiveStartupCleanup,
  runOneTimeChromaMigration,
  cleanStalePidFile,
  isProcessAlive,
  spawnDaemon,
  isPidFileRecent,
  touchPidFile
} from './infrastructure/ProcessManager.js';
import {
  isPortInUse,
  waitForHealth,
  waitForReadiness,
  waitForPortFree,
  httpShutdown,
  checkVersionMatch
} from './infrastructure/HealthMonitor.js';
import { performGracefulShutdown } from './infrastructure/GracefulShutdown.js';

// Server imports
import { Server } from './server/Server.js';

// Integration imports
import {
  updateCursorContextForProject,
  handleCursorCommand
} from './integrations/CursorHooksInstaller.js';

// Service layer imports
import { DatabaseManager } from './worker/DatabaseManager.js';
import { SessionManager } from './worker/SessionManager.js';
import { SSEBroadcaster } from './worker/SSEBroadcaster.js';
import { SDKAgent } from './worker/SDKAgent.js';
import { GeminiAgent, isGeminiSelected, isGeminiAvailable } from './worker/GeminiAgent.js';
import { OpenRouterAgent, isOpenRouterSelected, isOpenRouterAvailable } from './worker/OpenRouterAgent.js';
import { PaginationHelper } from './worker/PaginationHelper.js';
import { SettingsManager } from './worker/SettingsManager.js';
import { SearchManager } from './worker/SearchManager.js';
import { FormattingService } from './worker/FormattingService.js';
import { TimelineService } from './worker/TimelineService.js';
import { SessionEventBroadcaster } from './worker/events/SessionEventBroadcaster.js';
import { SessionOrchestrator } from './worker/SessionOrchestrator.js';

// HTTP route handlers
import { ViewerRoutes } from './worker/http/routes/ViewerRoutes.js';
import { SessionRoutes } from './worker/http/routes/SessionRoutes.js';
import { DataRoutes } from './worker/http/routes/DataRoutes.js';
import { SearchRoutes } from './worker/http/routes/SearchRoutes.js';
import { SettingsRoutes } from './worker/http/routes/SettingsRoutes.js';
import { LogsRoutes } from './worker/http/routes/LogsRoutes.js';
import { MemoryRoutes } from './worker/http/routes/MemoryRoutes.js';

// Process management for zombie cleanup (Issue #737)
import { startOrphanReaper } from './worker/ProcessRegistry.js';

/**
 * Build JSON status output for hook framework communication.
 * This is a pure function extracted for testability.
 *
 * @param status - 'ready' for successful startup, 'error' for failures
 * @param message - Optional error message (only included when provided)
 * @returns JSON object with continue, suppressOutput, status, and optionally message
 */
export interface StatusOutput {
  continue: true;
  suppressOutput: true;
  status: 'ready' | 'error';
  message?: string;
}

export function buildStatusOutput(status: 'ready' | 'error', message?: string): StatusOutput {
  return {
    continue: true,
    suppressOutput: true,
    status,
    ...(message && { message })
  };
}

export class WorkerService {
  private server: Server;
  private startTime: number = Date.now();
  private mcpClient: Client;

  // Initialization flags
  private mcpReady: boolean = false;
  private initializationCompleteFlag: boolean = false;
  private isShuttingDown: boolean = false;

  // Service layer
  private dbManager: DatabaseManager;
  private sessionManager: SessionManager;
  sseBroadcaster: SSEBroadcaster;
  private sdkAgent: SDKAgent;
  private geminiAgent: GeminiAgent;
  private openRouterAgent: OpenRouterAgent;
  private paginationHelper: PaginationHelper;
  private settingsManager: SettingsManager;
  private sessionEventBroadcaster: SessionEventBroadcaster;
  private sessionOrchestrator: SessionOrchestrator;

  // Route handlers
  private searchRoutes: SearchRoutes | null = null;

  // Chroma MCP manager (lazy - connects on first use)
  private chromaMcpManager: ChromaMcpManager | null = null;

  // Initialization tracking
  private initializationComplete: Promise<void>;
  private resolveInitialization!: () => void;

  // Orphan reaper cleanup function (Issue #737)
  private stopOrphanReaper: (() => void) | null = null;

  // Stale session reaper interval (Issue #1168)
  private staleSessionReaperInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Initialize the promise that will resolve when background initialization completes
    this.initializationComplete = new Promise((resolve) => {
      this.resolveInitialization = resolve;
    });

    // Initialize service layer
    this.dbManager = new DatabaseManager();
    this.sessionManager = new SessionManager(this.dbManager);
    this.sseBroadcaster = new SSEBroadcaster();
    this.sdkAgent = new SDKAgent(this.dbManager, this.sessionManager);
    this.geminiAgent = new GeminiAgent(this.dbManager, this.sessionManager);
    this.openRouterAgent = new OpenRouterAgent(this.dbManager, this.sessionManager);

    this.paginationHelper = new PaginationHelper(this.dbManager);
    this.settingsManager = new SettingsManager(this.dbManager);
    this.sessionEventBroadcaster = new SessionEventBroadcaster(this.sseBroadcaster, this);

    // Create session orchestrator — handles agent selection, session processing, and queue draining
    this.sessionOrchestrator = new SessionOrchestrator({
      sdkAgent: this.sdkAgent,
      geminiAgent: this.geminiAgent,
      openRouterAgent: this.openRouterAgent,
      sessionManager: this.sessionManager,
      dbManager: this.dbManager,
      sseBroadcaster: this.sseBroadcaster,
      sessionEventBroadcaster: this.sessionEventBroadcaster,
      broadcastProcessingStatus: () => this.broadcastProcessingStatus(),
      workerRef: this,
    });

    // Set callback for when sessions are deleted
    this.sessionManager.setOnSessionDeleted(() => {
      this.broadcastProcessingStatus();
    });


    // Initialize MCP client
    // Empty capabilities object: this client only calls tools, doesn't expose any
    this.mcpClient = new Client({
      name: 'worker-search-proxy',
      version: packageVersion
    }, { capabilities: {} });

    // Initialize HTTP server with core routes
    this.server = new Server({
      getInitializationComplete: () => this.initializationCompleteFlag,
      getMcpReady: () => this.mcpReady,
      onShutdown: () => this.shutdown(),
      onRestart: () => this.shutdown(),
      workerPath: __filename,
      getAiStatus: () => {
        let provider = 'claude';
        if (isOpenRouterSelected() && isOpenRouterAvailable()) provider = 'openrouter';
        else if (isGeminiSelected() && isGeminiAvailable()) provider = 'gemini';
        const lastAiInteraction = this.sessionOrchestrator.getLastAiInteraction();
        return {
          provider,
          authMethod: getAuthMethodDescription(),
          lastInteraction: lastAiInteraction
            ? {
                timestamp: lastAiInteraction.timestamp,
                success: lastAiInteraction.success,
                ...(lastAiInteraction.error && { error: lastAiInteraction.error }),
              }
            : null,
        };
      },
    });

    // Register route handlers
    this.registerRoutes();

    // Register signal handlers early to ensure cleanup even if start() hasn't completed
    this.registerSignalHandlers();
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerSignalHandlers(): void {
    configureSupervisorSignalHandlers(async () => {
      this.isShuttingDown = true;
      await this.shutdown();
    });
  }

  /**
   * Register all route handlers with the server
   */
  private registerRoutes(): void {
    // IMPORTANT: Middleware must be registered BEFORE routes (Express processes in order)

    // Early handler for /api/context/inject — fail open if not yet initialized
    this.server.app.get('/api/context/inject', async (req, res, next) => {
      if (!this.initializationCompleteFlag || !this.searchRoutes) {
        logger.warn('SYSTEM', 'Context requested before initialization complete, returning empty');
        res.status(200).json({ content: [{ type: 'text', text: '' }] });
        return;
      }

      next(); // Delegate to SearchRoutes handler
    });

    // Guard ALL /api/* routes during initialization — wait for DB with timeout
    // Exceptions: /api/health, /api/readiness, /api/version (handled by Server.ts core routes)
    // and /api/context/inject (handled above with fail-open)
    this.server.app.use('/api', async (req, res, next) => {
      if (this.initializationCompleteFlag) {
        next();
        return;
      }

      const timeoutMs = 30000;
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Database initialization timeout')), timeoutMs)
      );

      try {
        await Promise.race([this.initializationComplete, timeoutPromise]);
        next();
      } catch (error) {
        logger.error('HTTP', `Request to ${req.method} ${req.path} rejected — DB not initialized`, {}, error as Error);
        res.status(503).json({
          error: 'Service initializing',
          message: 'Database is still initializing, please retry'
        });
      }
    });

    // Standard routes (registered AFTER guard middleware)
    this.server.registerRoutes(new ViewerRoutes(this.sseBroadcaster, this.dbManager, this.sessionManager));
    this.server.registerRoutes(new SessionRoutes(this.sessionManager, this.dbManager, this.sdkAgent, this.geminiAgent, this.openRouterAgent, this.sessionEventBroadcaster, this));
    this.server.registerRoutes(new DataRoutes(this.paginationHelper, this.dbManager, this.sessionManager, this.sseBroadcaster, this, this.startTime));
    this.server.registerRoutes(new SettingsRoutes(this.settingsManager));
    this.server.registerRoutes(new LogsRoutes());
    this.server.registerRoutes(new MemoryRoutes(this.dbManager, 'claude-mem'));
  }

  /**
   * Start the worker service
   */
  async start(): Promise<void> {
    const port = getWorkerPort();
    const host = getWorkerHost();

    await startSupervisor();

    // Start HTTP server FIRST - make it available immediately
    await this.server.listen(port, host);

    // Worker writes its own PID - reliable on all platforms
    // This happens after listen() succeeds, ensuring the worker is actually ready
    // On Windows, the spawner's PID is cmd.exe (useless), so worker must write its own
    writePidFile({
      pid: process.pid,
      port,
      startedAt: new Date().toISOString()
    });

    getSupervisor().registerProcess('worker', {
      pid: process.pid,
      type: 'worker',
      startedAt: new Date().toISOString()
    });

    logger.info('SYSTEM', 'Worker started', { host, port, pid: process.pid });

    // Do slow initialization in background (non-blocking)
    this.initializeBackground().catch((error) => {
      logger.error('SYSTEM', 'Background initialization failed', {}, error as Error);
    });
  }

  /**
   * Background initialization - runs after HTTP server is listening
   */
  private async initializeBackground(): Promise<void> {
    try {
      await aggressiveStartupCleanup();

      // Load mode configuration
      const { ModeManager } = await import('./domain/ModeManager.js');
      const { SettingsDefaultsManager } = await import('../shared/SettingsDefaultsManager.js');
      const { USER_SETTINGS_PATH } = await import('../shared/paths.js');

      const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);

      // One-time chroma wipe for users upgrading from versions with duplicate worker bugs.
      // Only runs in local mode (chroma is local-only). Backfill at line ~414 rebuilds from SQLite.
      if (settings.CLAUDE_MEM_MODE === 'local' || !settings.CLAUDE_MEM_MODE) {
        runOneTimeChromaMigration();
      }

      // Initialize ChromaMcpManager only if Chroma is enabled
      const chromaEnabled = settings.CLAUDE_MEM_CHROMA_ENABLED !== 'false';
      if (chromaEnabled) {
        this.chromaMcpManager = ChromaMcpManager.getInstance();
        logger.info('SYSTEM', 'ChromaMcpManager initialized (lazy - connects on first use)');
      } else {
        logger.info('SYSTEM', 'Chroma disabled via CLAUDE_MEM_CHROMA_ENABLED=false, skipping ChromaMcpManager');
      }

      const modeId = settings.CLAUDE_MEM_MODE;
      ModeManager.getInstance().loadMode(modeId);
      logger.info('SYSTEM', `Mode loaded: ${modeId}`);

      await this.dbManager.initialize();

      // Reset any messages that were processing when worker died
      const { PendingMessageStore } = await import('./sqlite/PendingMessageStore.js');
      const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
      const resetCount = pendingStore.resetStaleProcessingMessages(0); // 0 = reset ALL processing
      if (resetCount > 0) {
        logger.info('SYSTEM', `Reset ${resetCount} stale processing messages to pending`);
      }

      // Initialize search services
      const formattingService = new FormattingService();
      const timelineService = new TimelineService();
      const searchManager = new SearchManager(
        this.dbManager.getSessionSearch(),
        this.dbManager.getSessionStore(),
        this.dbManager.getChromaSync(),
        formattingService,
        timelineService
      );
      this.searchRoutes = new SearchRoutes(searchManager);
      this.server.registerRoutes(this.searchRoutes);
      logger.info('WORKER', 'SearchManager initialized and search routes registered');

      // DB and search are ready — mark initialization complete so hooks can proceed.
      // MCP connection is tracked separately via mcpReady and is NOT required for
      // the worker to serve context/search requests.
      this.initializationCompleteFlag = true;
      this.resolveInitialization();
      logger.info('SYSTEM', 'Core initialization complete (DB + search ready)');

      // Auto-backfill Chroma for all projects if out of sync with SQLite (fire-and-forget)
      if (this.chromaMcpManager) {
        ChromaSync.backfillAllProjects().then(() => {
          logger.info('CHROMA_SYNC', 'Backfill check complete for all projects');
        }).catch(error => {
          logger.error('CHROMA_SYNC', 'Backfill failed (non-blocking)', {}, error as Error);
        });
      }

      // Connect to MCP server
      const mcpServerPath = path.join(__dirname, 'mcp-server.cjs');
      getSupervisor().assertCanSpawn('mcp server');
      const transport = new StdioClientTransport({
        command: 'node',
        args: [mcpServerPath],
        env: sanitizeEnv(process.env)
      });

      const MCP_INIT_TIMEOUT_MS = 300000;
      const mcpConnectionPromise = this.mcpClient.connect(transport);
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('MCP connection timeout after 5 minutes')),
          MCP_INIT_TIMEOUT_MS
        );
      });

      try {
        await Promise.race([mcpConnectionPromise, timeoutPromise]);
      } catch (connectionError) {
        clearTimeout(timeoutId!);
        logger.warn('WORKER', 'MCP server connection failed, cleaning up subprocess', {
          error: connectionError instanceof Error ? connectionError.message : String(connectionError)
        });
        try {
          await transport.close();
        } catch {
          // Best effort: the supervisor handles later process cleanup for survivors.
        }
        throw connectionError;
      }
      clearTimeout(timeoutId!);

      const mcpProcess = (transport as unknown as { _process?: import('child_process').ChildProcess })._process;
      if (mcpProcess?.pid) {
        getSupervisor().registerProcess('mcp-server', {
          pid: mcpProcess.pid,
          type: 'mcp',
          startedAt: new Date().toISOString()
        }, mcpProcess);
        mcpProcess.once('exit', () => {
          getSupervisor().unregisterProcess('mcp-server');
        });
      }
      this.mcpReady = true;
      logger.success('WORKER', 'MCP server connected');

      // Start orphan reaper to clean up zombie processes (Issue #737)
      this.stopOrphanReaper = startOrphanReaper(() => {
        const activeIds = new Set<number>();
        for (const [id] of this.sessionManager['sessions']) {
          activeIds.add(id);
        }
        return activeIds;
      });
      logger.info('SYSTEM', 'Started orphan reaper (runs every 30 seconds)');

      // Reap stale sessions to unblock orphan process cleanup (Issue #1168)
      this.staleSessionReaperInterval = setInterval(async () => {
        try {
          const reaped = await this.sessionManager.reapStaleSessions();
          if (reaped > 0) {
            logger.info('SYSTEM', `Reaped ${reaped} stale sessions`);
          }
        } catch (e) {
          logger.error('SYSTEM', 'Stale session reaper error', { error: e instanceof Error ? e.message : String(e) });
        }
      }, 2 * 60 * 1000);

      // Auto-recover orphaned queues (fire-and-forget with error logging)
      this.sessionOrchestrator.processPendingQueues(50).then(result => {
        if (result.sessionsStarted > 0) {
          logger.info('SYSTEM', `Auto-recovered ${result.sessionsStarted} sessions with pending work`, {
            totalPending: result.totalPendingSessions,
            started: result.sessionsStarted,
            sessionIds: result.startedSessionIds
          });
        }
      }).catch(error => {
        logger.error('SYSTEM', 'Auto-recovery of pending queues failed', {}, error as Error);
      });
    } catch (error) {
      logger.error('SYSTEM', 'Background initialization failed', {}, error as Error);
      throw error;
    }
  }

  /**
   * Delegate to SessionOrchestrator for processing pending queues.
   * External callers (DataRoutes) access this through WorkerService.
   */
  async processPendingQueues(sessionLimit: number = 10) {
    return this.sessionOrchestrator.processPendingQueues(sessionLimit);
  }

  /**
   * Shutdown the worker service
   */
  async shutdown(): Promise<void> {
    // Stop orphan reaper before shutdown (Issue #737)
    if (this.stopOrphanReaper) {
      this.stopOrphanReaper();
      this.stopOrphanReaper = null;
    }

    // Stop stale session reaper (Issue #1168)
    if (this.staleSessionReaperInterval) {
      clearInterval(this.staleSessionReaperInterval);
      this.staleSessionReaperInterval = null;
    }

    await performGracefulShutdown({
      server: this.server.getHttpServer(),
      sessionManager: this.sessionManager,
      mcpClient: this.mcpClient,
      dbManager: this.dbManager,
      chromaMcpManager: this.chromaMcpManager || undefined
    });
  }

  /**
   * Broadcast processing status change to SSE clients
   */
  broadcastProcessingStatus(): void {
    const isProcessing = this.sessionManager.isAnySessionProcessing();
    const queueDepth = this.sessionManager.getTotalActiveWork();
    const activeSessions = this.sessionManager.getActiveSessionCount();

    logger.info('WORKER', 'Broadcasting processing status', {
      isProcessing,
      queueDepth,
      activeSessions
    });

    this.sseBroadcaster.broadcast({
      type: 'processing_status',
      isProcessing,
      queueDepth
    });
  }
}

// ============================================================================
// Reusable Worker Startup Logic
// ============================================================================

/**
 * Ensures the worker is started and healthy.
 * This function can be called by both 'start' and 'hook' commands.
 *
 * @param port - The TCP port (used for port-in-use checks and daemon spawn)
 * @returns true if worker is healthy (existing or newly started), false on failure
 */
async function ensureWorkerStarted(port: number): Promise<boolean> {
  // Clean stale PID file first (cheap: 1 fs read + 1 signal-0 check)
  const pidFileStatus = cleanStalePidFile();
  if (pidFileStatus === 'alive') {
    logger.info('SYSTEM', 'Worker PID file points to a live process, skipping duplicate spawn');
    const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.PORT_IN_USE_WAIT));
    if (healthy) {
      logger.info('SYSTEM', 'Worker became healthy while waiting on live PID');
      return true;
    }
    logger.warn('SYSTEM', 'Live PID detected but worker did not become healthy before timeout');
    return false;
  }

  // Check if worker is already running and healthy
  if (await waitForHealth(port, 1000)) {
    const versionCheck = await checkVersionMatch(port);
    if (!versionCheck.matches) {
      // Guard: If PID file was written recently, another session is likely already
      // restarting the worker. Poll health instead of starting a concurrent restart.
      // This prevents the "100 sessions all restart simultaneously" storm (#1145).
      const RESTART_COORDINATION_THRESHOLD_MS = 15000;
      if (isPidFileRecent(RESTART_COORDINATION_THRESHOLD_MS)) {
        logger.info('SYSTEM', 'Version mismatch detected but PID file is recent — another restart likely in progress, polling health', {
          pluginVersion: versionCheck.pluginVersion,
          workerVersion: versionCheck.workerVersion
        });
        const healthy = await waitForHealth(port, RESTART_COORDINATION_THRESHOLD_MS);
        if (healthy) {
          logger.info('SYSTEM', 'Worker became healthy after waiting for concurrent restart');
          return true;
        }
        logger.warn('SYSTEM', 'Worker did not become healthy after waiting — proceeding with own restart');
      }

      logger.info('SYSTEM', 'Worker version mismatch detected - auto-restarting', {
        pluginVersion: versionCheck.pluginVersion,
        workerVersion: versionCheck.workerVersion
      });

      await httpShutdown(port);
      const freed = await waitForPortFree(port, getPlatformTimeout(HOOK_TIMEOUTS.PORT_IN_USE_WAIT));
      if (!freed) {
        logger.error('SYSTEM', 'Port did not free up after shutdown for version mismatch restart', { port });
        return false;
      }
      removePidFile();
    } else {
      logger.info('SYSTEM', 'Worker already running and healthy');
      return true;
    }
  }

  // Check if port is in use by something else
  const portInUse = await isPortInUse(port);
  if (portInUse) {
    logger.info('SYSTEM', 'Port in use, waiting for worker to become healthy');
    const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.PORT_IN_USE_WAIT));
    if (healthy) {
      logger.info('SYSTEM', 'Worker is now healthy');
      return true;
    }
    logger.error('SYSTEM', 'Port in use but worker not responding to health checks');
    return false;
  }

  // Windows: skip spawn if a recent attempt already failed (prevents repeated bun.exe popups, issue #921)
  if (shouldSkipSpawnOnWindows()) {
    logger.warn('SYSTEM', 'Worker unavailable on Windows — skipping spawn (recent attempt failed within cooldown)');
    return false;
  }

  // Spawn new worker daemon
  logger.info('SYSTEM', 'Starting worker daemon');
  markWorkerSpawnAttempted();
  const pid = spawnDaemon(__filename, port);
  if (pid === undefined) {
    logger.error('SYSTEM', 'Failed to spawn worker daemon');
    return false;
  }

  // PID file is written by the worker itself after listen() succeeds
  // This is race-free and works correctly on Windows where cmd.exe PID is useless

  const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.POST_SPAWN_WAIT));
  if (!healthy) {
    removePidFile();
    logger.error('SYSTEM', 'Worker failed to start (health check timeout)');
    return false;
  }

  // Health passed (HTTP listening). Now wait for DB + search initialization
  // so hooks that run immediately after can actually use the worker.
  const ready = await waitForReadiness(port, getPlatformTimeout(HOOK_TIMEOUTS.READINESS_WAIT));
  if (!ready) {
    logger.warn('SYSTEM', 'Worker is alive but readiness timed out — proceeding anyway');
  }

  clearWorkerSpawnAttempted();
  // Touch PID file to signal other sessions that a restart just completed.
  // Other sessions checking isPidFileRecent() will see this and skip their own restart.
  touchPidFile();
  logger.info('SYSTEM', 'Worker started successfully');
  return true;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const command = process.argv[2];

  // Early exit if plugin is disabled in Claude Code settings (#781).
  // Only gate hook-initiated commands; CLI management (stop/status) still works.
  const hookInitiatedCommands = ['start', 'hook', 'restart', '--daemon'];
  if ((hookInitiatedCommands.includes(command) || command === undefined) && isPluginDisabledInClaudeSettings()) {
    process.exit(0);
  }

  const port = getWorkerPort();

  // Helper for JSON status output in 'start' command
  // Exit code 0 ensures Windows Terminal doesn't keep tabs open
  function exitWithStatus(status: 'ready' | 'error', message?: string): never {
    const output = buildStatusOutput(status, message);
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  switch (command) {
    case 'start': {
      const success = await ensureWorkerStarted(port);
      if (success) {
        exitWithStatus('ready');
      } else {
        exitWithStatus('error', 'Failed to start worker');
      }
      break;
    }

    case 'stop': {
      await httpShutdown(port);
      const freed = await waitForPortFree(port, getPlatformTimeout(15000));
      if (!freed) {
        logger.warn('SYSTEM', 'Port did not free up after shutdown', { port });
      }
      removePidFile();
      logger.info('SYSTEM', 'Worker stopped successfully');
      process.exit(0);
      break;
    }

    case 'restart': {
      logger.info('SYSTEM', 'Restarting worker');
      await httpShutdown(port);
      const restartFreed = await waitForPortFree(port, getPlatformTimeout(15000));
      if (!restartFreed) {
        logger.error('SYSTEM', 'Port did not free up after shutdown, aborting restart', { port });
        process.exit(0);
      }
      removePidFile();

      const pid = spawnDaemon(__filename, port);
      if (pid === undefined) {
        logger.error('SYSTEM', 'Failed to spawn worker daemon during restart');
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      }

      // PID file is written by the worker itself after listen() succeeds
      // This is race-free and works correctly on Windows where cmd.exe PID is useless

      const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.POST_SPAWN_WAIT));
      if (!healthy) {
        removePidFile();
        logger.error('SYSTEM', 'Worker failed to restart');
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      }

      logger.info('SYSTEM', 'Worker restarted successfully');
      process.exit(0);
      break;
    }

    case 'status': {
      const portInUse = await isPortInUse(port);
      const pidInfo = readPidFile();
      if (portInUse && pidInfo) {
        console.log('Worker is running');
        console.log(`  PID: ${pidInfo.pid}`);
        console.log(`  Port: ${pidInfo.port}`);
        console.log(`  Started: ${pidInfo.startedAt}`);
      } else {
        console.log('Worker is not running');
      }
      process.exit(0);
      break;
    }

    case 'cursor': {
      const subcommand = process.argv[3];
      const cursorResult = await handleCursorCommand(subcommand, process.argv.slice(4));
      process.exit(cursorResult);
      break;
    }

    case 'hook': {
      // Validate CLI args first (before any I/O)
      const platform = process.argv[3];
      const event = process.argv[4];
      if (!platform || !event) {
        console.error('Usage: claude-mem hook <platform> <event>');
        console.error('Platforms: claude-code, cursor, raw');
        console.error('Events: context, session-init, observation, summarize, session-complete');
        process.exit(1);
      }

      // Ensure worker is running as a detached daemon (#1249).
      //
      // IMPORTANT: The hook process MUST NOT become the worker. Starting the
      // worker in-process makes it a grandchild of Claude Code, which the
      // sandbox kills. Instead, ensureWorkerStarted() spawns a fully detached
      // daemon (detached: true, stdio: 'ignore', child.unref()) that survives
      // the hook process's exit and is invisible to Claude Code's sandbox.
      const workerReady = await ensureWorkerStarted(port);
      if (!workerReady) {
        logger.warn('SYSTEM', 'Worker failed to start before hook, handler will proceed gracefully');
      }

      const { hookCommand } = await import('../cli/hook-command.js');
      await hookCommand(platform, event);
      break;
    }

    case 'generate': {
      const dryRun = process.argv.includes('--dry-run');
      const { generateClaudeMd } = await import('../cli/claude-md-commands.js');
      const result = await generateClaudeMd(dryRun);
      process.exit(result);
      break;
    }

    case 'clean': {
      const dryRun = process.argv.includes('--dry-run');
      const { cleanClaudeMd } = await import('../cli/claude-md-commands.js');
      const result = await cleanClaudeMd(dryRun);
      process.exit(result);
      break;
    }

    case '--daemon':
    default: {
      // GUARD 1: Refuse to start if another worker is already alive (PID check).
      // Instant check (kill -0) — no HTTP dependency.
      const existingPidInfo = readPidFile();
      if (existingPidInfo && isProcessAlive(existingPidInfo.pid)) {
        logger.info('SYSTEM', 'Worker already running (PID alive), refusing to start duplicate', {
          existingPid: existingPidInfo.pid,
          existingPort: existingPidInfo.port,
          startedAt: existingPidInfo.startedAt
        });
        process.exit(0);
      }

      // GUARD 2: Refuse to start if the port is already bound.
      // Catches the race where two daemons start simultaneously before
      // either writes a PID file. Must run BEFORE constructing WorkerService
      // because the constructor registers signal handlers and timers that
      // prevent the process from exiting even if listen() fails later.
      if (await isPortInUse(port)) {
        logger.info('SYSTEM', 'Port already in use, refusing to start duplicate', { port });
        process.exit(0);
      }

      // Prevent daemon from dying silently on unhandled errors.
      // The HTTP server can continue serving even if a background task throws.
      process.on('unhandledRejection', (reason) => {
        logger.error('SYSTEM', 'Unhandled rejection in daemon', {
          reason: reason instanceof Error ? reason.message : String(reason)
        });
      });
      process.on('uncaughtException', (error) => {
        logger.error('SYSTEM', 'Uncaught exception in daemon', {}, error as Error);
        // Don't exit — keep the HTTP server running
      });

      const worker = new WorkerService();
      worker.start().catch((error) => {
        logger.failure('SYSTEM', 'Worker failed to start', {}, error as Error);
        removePidFile();
        // Exit gracefully: Windows Terminal won't keep tab open on exit 0
        // The wrapper/plugin will handle restart logic if needed
        process.exit(0);
      });
    }
  }
}

// Check if running as main module in both ESM and CommonJS
const isMainModule = typeof require !== 'undefined' && typeof module !== 'undefined'
  ? require.main === module || !module.parent
  : import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('worker-service');

if (isMainModule) {
  main().catch((error) => {
    logger.error('SYSTEM', 'Fatal error in main', {}, error instanceof Error ? error : undefined);
    process.exit(0);  // Exit 0: don't block Claude Code, don't leave Windows Terminal tabs open
  });
}
