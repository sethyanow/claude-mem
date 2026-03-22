import { Database } from 'bun:sqlite';
import { DATA_DIR, DB_PATH, ensureDir } from '../../shared/paths.js';
import { logger } from '../../utils/logger.js';
import {
  UserPromptRecord,
  LatestPromptResult
} from '../../types/database.js';
import { MigrationRunner } from './migrations/runner.js';
import type { ObservationRow, SessionSummaryRow } from './types.js';
import type { PendingMessageStore } from './PendingMessageStore.js';
import { computeObservationContentHash, findDuplicateObservation, storeObservation as _storeObservation } from './observations/store.js';
import { getObservationById as _getObservationById, getObservationsByIds as _getObservationsByIds, getObservationsForSession as _getObservationsForSession } from './observations/get.js';
import { getRecentObservations as _getRecentObservations, getAllRecentObservations as _getAllRecentObservations } from './observations/recent.js';
import { getFilesForSession as _getFilesForSession } from './observations/files.js';
import { createSDKSession as _createSDKSession, updateMemorySessionId as _updateMemorySessionId } from './sessions/create.js';
import { getSessionById as _getSessionById, getSdkSessionsBySessionIds as _getSdkSessionsBySessionIds, getRecentSessionsWithStatus as _getRecentSessionsWithStatus, getSessionSummaryById as _getSessionSummaryById } from './sessions/get.js';
import { storeSummary as _storeSummary } from './summaries/store.js';
import { getSummaryForSession as _getSummaryForSession, getSummariesByIds as _getSummariesByIds } from './summaries/get.js';
import { getRecentSummaries as _getRecentSummaries, getRecentSummariesWithSessionInfo as _getRecentSummariesWithSessionInfo, getAllRecentSummaries as _getAllRecentSummaries } from './summaries/recent.js';
import { getTimelineAroundObservation as _getTimelineAroundObservation, getTimelineAroundTimestamp as _getTimelineAroundTimestamp, getAllProjects as _getAllProjects } from './timeline/queries.js';
import {
  importSdkSession as _importSdkSession,
  importSessionSummary as _importSessionSummary,
  importObservation as _importObservation,
  importUserPrompt as _importUserPrompt
} from './import/bulk.js';

/**
 * Session data store for SDK sessions, observations, and summaries
 * Provides simple, synchronous CRUD operations for session-based memory
 */
export class SessionStore {
  public db: Database;

  constructor(dbPath: string = DB_PATH) {
    if (dbPath !== ':memory:') {
      ensureDir(DATA_DIR);
    }
    this.db = new Database(dbPath);

    // Ensure optimized settings
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA foreign_keys = ON');

    // Delegate all schema initialization and migrations to MigrationRunner
    new MigrationRunner(this.db).runAllMigrations();
  }


  /**
   * Update the memory session ID for a session
   * Called by SDKAgent when it captures the session ID from the first SDK message
   * Also used to RESET to null on stale resume failures (worker-service.ts)
   */
  updateMemorySessionId(sessionDbId: number, memorySessionId: string | null): void {
    return _updateMemorySessionId(this.db, sessionDbId, memorySessionId);
  }

  /**
   * Ensures memory_session_id is registered in sdk_sessions before FK-constrained INSERT.
   * This fixes Issue #846 where observations fail after worker restart because the
   * SDK generates a new memory_session_id but it's not registered in the parent table
   * before child records try to reference it.
   *
   * @param sessionDbId - The database ID of the session
   * @param memorySessionId - The memory session ID to ensure is registered
   */
  ensureMemorySessionIdRegistered(sessionDbId: number, memorySessionId: string): void {
    const session = this.db.prepare(`
      SELECT id, memory_session_id FROM sdk_sessions WHERE id = ?
    `).get(sessionDbId) as { id: number; memory_session_id: string | null } | undefined;

    if (!session) {
      throw new Error(`Session ${sessionDbId} not found in sdk_sessions`);
    }

    if (session.memory_session_id !== memorySessionId) {
      this.db.prepare(`
        UPDATE sdk_sessions SET memory_session_id = ? WHERE id = ?
      `).run(memorySessionId, sessionDbId);

      logger.info('DB', 'Registered memory_session_id before storage (FK fix)', {
        sessionDbId,
        oldId: session.memory_session_id,
        newId: memorySessionId
      });
    }
  }

  /**
   * Get recent session summaries for a project
   */
  getRecentSummaries(project: string, limit: number = 10) {
    return _getRecentSummaries(this.db, project, limit);
  }

  /**
   * Get recent summaries with session info for context display
   */
  getRecentSummariesWithSessionInfo(project: string, limit: number = 3) {
    return _getRecentSummariesWithSessionInfo(this.db, project, limit);
  }

  /**
   * Get recent observations for a project
   */
  getRecentObservations(project: string, limit: number = 20) {
    return _getRecentObservations(this.db, project, limit);
  }

  /**
   * Get recent observations across all projects (for web UI)
   */
  getAllRecentObservations(limit: number = 100) {
    return _getAllRecentObservations(this.db, limit);
  }

  /**
   * Get recent summaries across all projects (for web UI)
   */
  getAllRecentSummaries(limit: number = 50) {
    return _getAllRecentSummaries(this.db, limit);
  }

  /**
   * Get recent user prompts across all sessions (for web UI)
   */
  getAllRecentUserPrompts(limit: number = 100): Array<{
    id: number;
    content_session_id: string;
    project: string;
    prompt_number: number;
    prompt_text: string;
    created_at: string;
    created_at_epoch: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT
        up.id,
        up.content_session_id,
        s.project,
        up.prompt_number,
        up.prompt_text,
        up.created_at,
        up.created_at_epoch
      FROM user_prompts up
      LEFT JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      ORDER BY up.created_at_epoch DESC
      LIMIT ?
    `);

    return stmt.all(limit) as Array<{
      id: number;
      content_session_id: string;
      project: string;
      prompt_number: number;
      prompt_text: string;
      created_at: string;
      created_at_epoch: number;
    }>;
  }

  /**
   * Get all unique projects from the database (for web UI project filter)
   */
  getAllProjects(): string[] {
    return _getAllProjects(this.db);
  }

  /**
   * Get latest user prompt with session info for a Claude session
   * Used for syncing prompts to Chroma during session initialization
   */
  getLatestUserPrompt(contentSessionId: string): {
    id: number;
    content_session_id: string;
    memory_session_id: string;
    project: string;
    prompt_number: number;
    prompt_text: string;
    created_at_epoch: number;
  } | undefined {
    const stmt = this.db.prepare(`
      SELECT
        up.*,
        s.memory_session_id,
        s.project
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.content_session_id = ?
      ORDER BY up.created_at_epoch DESC
      LIMIT 1
    `);

    return stmt.get(contentSessionId) as LatestPromptResult | undefined;
  }

  /**
   * Get recent sessions with their status and summary info
   */
  getRecentSessionsWithStatus(project: string, limit: number = 3) {
    return _getRecentSessionsWithStatus(this.db, project, limit);
  }

  /**
   * Get observations for a specific session
   */
  getObservationsForSession(memorySessionId: string) {
    return _getObservationsForSession(this.db, memorySessionId);
  }

  /**
   * Get a single observation by ID
   */
  getObservationById(id: number): ObservationRow | null {
    return _getObservationById(this.db, id);
  }

  /**
   * Get observations by array of IDs with ordering and limit
   */
  getObservationsByIds(
    ids: number[],
    options: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string; type?: string | string[]; concepts?: string | string[]; files?: string | string[] } = {}
  ): ObservationRow[] {
    return _getObservationsByIds(this.db, ids, options);
  }

  /**
   * Get summary for a specific session
   */
  getSummaryForSession(memorySessionId: string) {
    return _getSummaryForSession(this.db, memorySessionId);
  }

  /**
   * Get aggregated files from all observations for a session
   */
  getFilesForSession(memorySessionId: string) {
    return _getFilesForSession(this.db, memorySessionId);
  }

  /**
   * Get session by ID
   */
  getSessionById(id: number) {
    return _getSessionById(this.db, id);
  }

  /**
   * Get SDK sessions by SDK session IDs
   * Used for exporting session metadata
   */
  getSdkSessionsBySessionIds(memorySessionIds: string[]) {
    return _getSdkSessionsBySessionIds(this.db, memorySessionIds);
  }






  /**
   * Get current prompt number by counting user_prompts for this session
   * Replaces the prompt_counter column which is no longer maintained
   */
  getPromptNumberFromUserPrompts(contentSessionId: string): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?
    `).get(contentSessionId) as { count: number };
    return result.count;
  }

  /**
   * Create a new SDK session (idempotent - returns existing session ID if already exists)
   *
   * CRITICAL ARCHITECTURE: Session ID Threading
   * ============================================
   * This function is the KEY to how claude-mem stays unified across hooks:
   *
   * - NEW hook calls: createSDKSession(session_id, project, prompt)
   * - SAVE hook calls: createSDKSession(session_id, '', '')
   * - Both use the SAME session_id from Claude Code's hook context
   *
   * IDEMPOTENT BEHAVIOR (INSERT OR IGNORE):
   * - Prompt #1: session_id not in database → INSERT creates new row
   * - Prompt #2+: session_id exists → INSERT ignored, fetch existing ID
   * - Result: Same database ID returned for all prompts in conversation
   *
   * Pure get-or-create: never modifies memory_session_id.
   * Multi-terminal isolation is handled by ON UPDATE CASCADE at the schema level.
   */
  createSDKSession(contentSessionId: string, project: string, userPrompt: string, customTitle?: string): number {
    return _createSDKSession(this.db, contentSessionId, project, userPrompt, customTitle);
  }




  /**
   * Save a user prompt
   */
  saveUserPrompt(contentSessionId: string, promptNumber: number, promptText: string): number {
    const now = new Date();
    const nowEpoch = now.getTime();

    const stmt = this.db.prepare(`
      INSERT INTO user_prompts
      (content_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(contentSessionId, promptNumber, promptText, now.toISOString(), nowEpoch);
    return result.lastInsertRowid as number;
  }

  /**
   * Get user prompt by session ID and prompt number
   * Returns the prompt text, or null if not found
   */
  getUserPrompt(contentSessionId: string, promptNumber: number): string | null {
    const stmt = this.db.prepare(`
      SELECT prompt_text
      FROM user_prompts
      WHERE content_session_id = ? AND prompt_number = ?
      LIMIT 1
    `);

    const result = stmt.get(contentSessionId, promptNumber) as { prompt_text: string } | undefined;
    return result?.prompt_text ?? null;
  }

  /**
   * Store an observation (from SDK parsing)
   * Assumes session already exists (created by hook)
   * Performs content-hash deduplication: skips INSERT if an identical observation exists within 30s
   */
  storeObservation(
    memorySessionId: string,
    project: string,
    observation: {
      type: string;
      title: string | null;
      subtitle: string | null;
      facts: string[];
      narrative: string | null;
      concepts: string[];
      files_read: string[];
      files_modified: string[];
    },
    promptNumber?: number,
    discoveryTokens: number = 0,
    overrideTimestampEpoch?: number
  ) {
    return _storeObservation(this.db, memorySessionId, project, observation, promptNumber, discoveryTokens, overrideTimestampEpoch);
  }

  /**
   * Store a session summary (from SDK parsing)
   * Assumes session already exists - will fail with FK error if not
   */
  storeSummary(
    memorySessionId: string,
    project: string,
    summary: {
      request: string;
      investigated: string;
      learned: string;
      completed: string;
      next_steps: string;
      notes: string | null;
    },
    promptNumber?: number,
    discoveryTokens: number = 0,
    overrideTimestampEpoch?: number
  ) {
    return _storeSummary(this.db, memorySessionId, project, summary, promptNumber, discoveryTokens, overrideTimestampEpoch);
  }

  /**
   * ATOMIC: Store observations + summary (no message tracking)
   *
   * Simplified version for use with claim-and-delete queue pattern.
   * Messages are deleted from queue immediately on claim, so there's no
   * message completion to track. This just stores observations and summary.
   *
   * @param memorySessionId - SDK memory session ID
   * @param project - Project name
   * @param observations - Array of observations to store (can be empty)
   * @param summary - Optional summary to store
   * @param promptNumber - Optional prompt number
   * @param discoveryTokens - Discovery tokens count
   * @param overrideTimestampEpoch - Optional override timestamp
   * @returns Object with observation IDs, optional summary ID, and timestamp
   */
  storeObservations(
    memorySessionId: string,
    project: string,
    observations: Array<{
      type: string;
      title: string | null;
      subtitle: string | null;
      facts: string[];
      narrative: string | null;
      concepts: string[];
      files_read: string[];
      files_modified: string[];
    }>,
    summary: {
      request: string;
      investigated: string;
      learned: string;
      completed: string;
      next_steps: string;
      notes: string | null;
    } | null,
    promptNumber?: number,
    discoveryTokens: number = 0,
    overrideTimestampEpoch?: number
  ): { observationIds: number[]; summaryId: number | null; createdAtEpoch: number } {
    // Use override timestamp if provided
    const timestampEpoch = overrideTimestampEpoch ?? Date.now();
    const timestampIso = new Date(timestampEpoch).toISOString();

    // Create transaction that wraps all operations
    const storeTx = this.db.transaction(() => {
      const observationIds: number[] = [];

      // 1. Store all observations (with content-hash deduplication)
      const obsStmt = this.db.prepare(`
        INSERT INTO observations
        (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
         files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const observation of observations) {
        // Content-hash deduplication (same logic as storeObservation singular)
        const contentHash = computeObservationContentHash(memorySessionId, observation.title, observation.narrative);
        const existing = findDuplicateObservation(this.db, contentHash, timestampEpoch);
        if (existing) {
          observationIds.push(existing.id);
          continue;
        }

        const result = obsStmt.run(
          memorySessionId,
          project,
          observation.type,
          observation.title,
          observation.subtitle,
          JSON.stringify(observation.facts),
          observation.narrative,
          JSON.stringify(observation.concepts),
          JSON.stringify(observation.files_read),
          JSON.stringify(observation.files_modified),
          promptNumber || null,
          discoveryTokens,
          contentHash,
          timestampIso,
          timestampEpoch
        );
        observationIds.push(Number(result.lastInsertRowid));
      }

      // 2. Store summary if provided
      let summaryId: number | null = null;
      if (summary) {
        const summaryStmt = this.db.prepare(`
          INSERT INTO session_summaries
          (memory_session_id, project, request, investigated, learned, completed,
           next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = summaryStmt.run(
          memorySessionId,
          project,
          summary.request,
          summary.investigated,
          summary.learned,
          summary.completed,
          summary.next_steps,
          summary.notes,
          promptNumber || null,
          discoveryTokens,
          timestampIso,
          timestampEpoch
        );
        summaryId = Number(result.lastInsertRowid);
      }

      return { observationIds, summaryId, createdAtEpoch: timestampEpoch };
    });

    // Execute the transaction and return results
    return storeTx();
  }

  /**
   * @deprecated Use storeObservations instead. This method is kept for backwards compatibility.
   *
   * ATOMIC: Store observations + summary + mark pending message as processed
   *
   * This method wraps observation storage, summary storage, and message completion
   * in a single database transaction to prevent race conditions. If the worker crashes
   * during processing, either all operations succeed together or all fail together.
   *
   * This fixes the observation duplication bug where observations were stored but
   * the message wasn't marked complete, causing reprocessing on crash recovery.
   *
   * @param memorySessionId - SDK memory session ID
   * @param project - Project name
   * @param observations - Array of observations to store (can be empty)
   * @param summary - Optional summary to store
   * @param messageId - Pending message ID to mark as processed
   * @param pendingStore - PendingMessageStore instance for marking complete
   * @param promptNumber - Optional prompt number
   * @param discoveryTokens - Discovery tokens count
   * @param overrideTimestampEpoch - Optional override timestamp
   * @returns Object with observation IDs, optional summary ID, and timestamp
   */
  storeObservationsAndMarkComplete(
    memorySessionId: string,
    project: string,
    observations: Array<{
      type: string;
      title: string | null;
      subtitle: string | null;
      facts: string[];
      narrative: string | null;
      concepts: string[];
      files_read: string[];
      files_modified: string[];
    }>,
    summary: {
      request: string;
      investigated: string;
      learned: string;
      completed: string;
      next_steps: string;
      notes: string | null;
    } | null,
    messageId: number,
    _pendingStore: PendingMessageStore,
    promptNumber?: number,
    discoveryTokens: number = 0,
    overrideTimestampEpoch?: number
  ): { observationIds: number[]; summaryId?: number; createdAtEpoch: number } {
    // Use override timestamp if provided
    const timestampEpoch = overrideTimestampEpoch ?? Date.now();
    const timestampIso = new Date(timestampEpoch).toISOString();

    // Create transaction that wraps all operations
    const storeAndMarkTx = this.db.transaction(() => {
      const observationIds: number[] = [];

      // 1. Store all observations (with content-hash deduplication)
      const obsStmt = this.db.prepare(`
        INSERT INTO observations
        (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
         files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const observation of observations) {
        // Content-hash deduplication (same logic as storeObservation singular)
        const contentHash = computeObservationContentHash(memorySessionId, observation.title, observation.narrative);
        const existing = findDuplicateObservation(this.db, contentHash, timestampEpoch);
        if (existing) {
          observationIds.push(existing.id);
          continue;
        }

        const result = obsStmt.run(
          memorySessionId,
          project,
          observation.type,
          observation.title,
          observation.subtitle,
          JSON.stringify(observation.facts),
          observation.narrative,
          JSON.stringify(observation.concepts),
          JSON.stringify(observation.files_read),
          JSON.stringify(observation.files_modified),
          promptNumber || null,
          discoveryTokens,
          contentHash,
          timestampIso,
          timestampEpoch
        );
        observationIds.push(Number(result.lastInsertRowid));
      }

      // 2. Store summary if provided
      let summaryId: number | undefined;
      if (summary) {
        const summaryStmt = this.db.prepare(`
          INSERT INTO session_summaries
          (memory_session_id, project, request, investigated, learned, completed,
           next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = summaryStmt.run(
          memorySessionId,
          project,
          summary.request,
          summary.investigated,
          summary.learned,
          summary.completed,
          summary.next_steps,
          summary.notes,
          promptNumber || null,
          discoveryTokens,
          timestampIso,
          timestampEpoch
        );
        summaryId = Number(result.lastInsertRowid);
      }

      // 3. Mark pending message as processed
      // This UPDATE is part of the same transaction, so if it fails,
      // observations and summary will be rolled back
      const updateStmt = this.db.prepare(`
        UPDATE pending_messages
        SET
          status = 'processed',
          completed_at_epoch = ?,
          tool_input = NULL,
          tool_response = NULL
        WHERE id = ? AND status = 'processing'
      `);
      updateStmt.run(timestampEpoch, messageId);

      return { observationIds, summaryId, createdAtEpoch: timestampEpoch };
    });

    // Execute the transaction and return results
    return storeAndMarkTx();
  }



  // REMOVED: cleanupOrphanedSessions - violates "EVERYTHING SHOULD SAVE ALWAYS"
  // There's no such thing as an "orphaned" session. Sessions are created by hooks
  // and managed by Claude Code's lifecycle. Worker restarts don't invalidate them.
  // Marking all active sessions as 'failed' on startup destroys the user's current work.

  /**
   * Get session summaries by IDs (for hybrid Chroma search)
   * Returns summaries in specified temporal order
   */
  getSessionSummariesByIds(
    ids: number[],
    options: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string } = {}
  ): SessionSummaryRow[] {
    return _getSummariesByIds(this.db, ids, options);
  }

  /**
   * Get user prompts by IDs (for hybrid Chroma search)
   * Returns prompts in specified temporal order
   */
  getUserPromptsByIds(
    ids: number[],
    options: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string } = {}
  ): UserPromptRecord[] {
    if (ids.length === 0) return [];

    const { orderBy = 'date_desc', limit, project } = options;
    const orderClause = orderBy === 'date_asc' ? 'ASC' : 'DESC';
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const placeholders = ids.map(() => '?').join(',');
    const params: any[] = [...ids];

    // Apply project filter
    const projectFilter = project ? 'AND s.project = ?' : '';
    if (project) params.push(project);

    const stmt = this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.memory_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.id IN (${placeholders}) ${projectFilter}
      ORDER BY up.created_at_epoch ${orderClause}
      ${limitClause}
    `);

    return stmt.all(...params) as UserPromptRecord[];
  }

  /**
   * Get a unified timeline of all records (observations, sessions, prompts) around an anchor point
   * @param anchorEpoch The anchor timestamp (epoch milliseconds)
   * @param depthBefore Number of records to retrieve before anchor (any type)
   * @param depthAfter Number of records to retrieve after anchor (any type)
   * @param project Optional project filter
   * @returns Object containing observations, sessions, and prompts for the specified window
   */
  getTimelineAroundTimestamp(
    anchorEpoch: number,
    depthBefore: number = 10,
    depthAfter: number = 10,
    project?: string
  ) {
    return _getTimelineAroundTimestamp(this.db, anchorEpoch, depthBefore, depthAfter, project);
  }

  /**
   * Get timeline around a specific observation ID
   * Uses observation ID offsets to determine time boundaries, then fetches all record types in that window
   */
  getTimelineAroundObservation(
    anchorObservationId: number | null,
    anchorEpoch: number,
    depthBefore: number = 10,
    depthAfter: number = 10,
    project?: string
  ) {
    return _getTimelineAroundObservation(this.db, anchorObservationId, anchorEpoch, depthBefore, depthAfter, project);
  }

  /**
   * Get a single user prompt by ID
   */
  getPromptById(id: number): {
    id: number;
    content_session_id: string;
    prompt_number: number;
    prompt_text: string;
    project: string;
    created_at: string;
    created_at_epoch: number;
  } | null {
    const stmt = this.db.prepare(`
      SELECT
        p.id,
        p.content_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
      WHERE p.id = ?
      LIMIT 1
    `);

    return stmt.get(id) as {
      id: number;
      content_session_id: string;
      prompt_number: number;
      prompt_text: string;
      project: string;
      created_at: string;
      created_at_epoch: number;
    } | null || null;
  }

  /**
   * Get multiple user prompts by IDs
   */
  getPromptsByIds(ids: number[]): Array<{
    id: number;
    content_session_id: string;
    prompt_number: number;
    prompt_text: string;
    project: string;
    created_at: string;
    created_at_epoch: number;
  }> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT
        p.id,
        p.content_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
      WHERE p.id IN (${placeholders})
      ORDER BY p.created_at_epoch DESC
    `);

    return stmt.all(...ids) as Array<{
      id: number;
      content_session_id: string;
      prompt_number: number;
      prompt_text: string;
      project: string;
      created_at: string;
      created_at_epoch: number;
    }>;
  }

  /**
   * Get full session summary by ID (includes request_summary and learned_summary)
   */
  getSessionSummaryById(id: number) {
    return _getSessionSummaryById(this.db, id);
  }

  /**
   * Get or create a manual session for storing user-created observations
   * Manual sessions use a predictable ID format: "manual-{project}"
   */
  getOrCreateManualSession(project: string): string {
    const memorySessionId = `manual-${project}`;
    const contentSessionId = `manual-content-${project}`;

    const existing = this.db.prepare(
      'SELECT memory_session_id FROM sdk_sessions WHERE memory_session_id = ?'
    ).get(memorySessionId) as { memory_session_id: string } | undefined;

    if (existing) {
      return memorySessionId;
    }

    // Create new manual session
    const now = new Date();
    this.db.prepare(`
      INSERT INTO sdk_sessions (memory_session_id, content_session_id, project, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(memorySessionId, contentSessionId, project, now.toISOString(), now.getTime());

    logger.info('SESSION', 'Created manual session', { memorySessionId, project });

    return memorySessionId;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  // ===========================================
  // Import Methods (for import-memories script)
  // ===========================================

  /**
   * Import SDK session with duplicate checking
   * Returns: { imported: boolean, id: number }
   */
  importSdkSession(session: {
    content_session_id: string;
    memory_session_id: string;
    project: string;
    user_prompt: string;
    started_at: string;
    started_at_epoch: number;
    completed_at: string | null;
    completed_at_epoch: number | null;
    status: string;
  }): { imported: boolean; id: number } {
    return _importSdkSession(this.db, session);
  }

  /**
   * Import session summary with duplicate checking
   * Returns: { imported: boolean, id: number }
   */
  importSessionSummary(summary: {
    memory_session_id: string;
    project: string;
    request: string | null;
    investigated: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    files_read: string | null;
    files_edited: string | null;
    notes: string | null;
    prompt_number: number | null;
    discovery_tokens: number;
    created_at: string;
    created_at_epoch: number;
  }): { imported: boolean; id: number } {
    return _importSessionSummary(this.db, summary);
  }

  /**
   * Import observation with duplicate checking
   * Duplicates are identified by memory_session_id + title + created_at_epoch
   * Returns: { imported: boolean, id: number }
   */
  importObservation(obs: {
    memory_session_id: string;
    project: string;
    text: string | null;
    type: string;
    title: string | null;
    subtitle: string | null;
    facts: string | null;
    narrative: string | null;
    concepts: string | null;
    files_read: string | null;
    files_modified: string | null;
    prompt_number: number | null;
    discovery_tokens: number;
    created_at: string;
    created_at_epoch: number;
  }): { imported: boolean; id: number } {
    return _importObservation(this.db, obs);
  }

  /**
   * Import user prompt with duplicate checking
   * Duplicates are identified by content_session_id + prompt_number
   * Returns: { imported: boolean, id: number }
   */
  importUserPrompt(prompt: {
    content_session_id: string;
    prompt_number: number;
    prompt_text: string;
    created_at: string;
    created_at_epoch: number;
  }): { imported: boolean; id: number } {
    return _importUserPrompt(this.db, prompt);
  }
}
