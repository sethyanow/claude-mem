import { Database } from 'bun:sqlite';
import { DATA_DIR, DB_PATH, ensureDir } from '../../shared/paths.js';
import { logger } from '../../utils/logger.js';
import {
  UserPromptRecord,
} from '../../types/database.js';
import { MigrationRunner } from './migrations/runner.js';
import type { ObservationRow, SessionSummaryRow } from './types.js';
import type { PendingMessageStore } from './PendingMessageStore.js';

// Observation sub-module imports
import {
  storeObservation as _storeObservation,
} from './observations/store.js';
import {
  getObservationById as _getObservationById,
  getObservationsByIds as _getObservationsByIds,
  getObservationsForSession as _getObservationsForSession,
} from './observations/get.js';
import {
  getRecentObservations as _getRecentObservations,
  getAllRecentObservations as _getAllRecentObservations,
} from './observations/recent.js';
import {
  getFilesForSession as _getFilesForSession,
} from './observations/files.js';

// Summary sub-module imports
import {
  storeSummary as _storeSummary,
} from './summaries/store.js';
import {
  getSummaryForSession as _getSummaryForSession,
  getSummariesByIds as _getSummariesByIds,
} from './summaries/get.js';
import {
  getRecentSummaries as _getRecentSummaries,
  getRecentSummariesWithSessionInfo as _getRecentSummariesWithSessionInfo,
  getAllRecentSummaries as _getAllRecentSummaries,
} from './summaries/recent.js';

// Session sub-module imports
import {
  createSDKSession as _createSDKSession,
  updateMemorySessionId as _updateMemorySessionId,
  ensureMemorySessionIdRegistered as _ensureMemorySessionIdRegistered,
  getOrCreateManualSession as _getOrCreateManualSession,
} from './sessions/create.js';
import {
  getSessionById as _getSessionById,
  getSdkSessionsBySessionIds as _getSdkSessionsBySessionIds,
  getRecentSessionsWithStatus as _getRecentSessionsWithStatus,
  getSessionSummaryById as _getSessionSummaryById,
} from './sessions/get.js';

// Prompt sub-module imports
import {
  saveUserPrompt as _saveUserPrompt,
} from './prompts/store.js';
import {
  getUserPrompt as _getUserPrompt,
  getPromptNumberFromUserPrompts as _getPromptNumberFromUserPrompts,
  getLatestUserPrompt as _getLatestUserPrompt,
  getAllRecentUserPrompts as _getAllRecentUserPrompts,
  getPromptById as _getPromptById,
  getPromptsByIds as _getPromptsByIds,
  getUserPromptsByIds as _getUserPromptsByIds,
} from './prompts/get.js';

// Timeline sub-module imports
import {
  getTimelineAroundTimestamp as _getTimelineAroundTimestamp,
  getTimelineAroundObservation as _getTimelineAroundObservation,
  getAllProjects as _getAllProjects,
} from './timeline/queries.js';

// Transaction sub-module imports
import {
  storeObservations as _storeObservations,
  storeObservationsAndMarkComplete as _storeObservationsAndMarkComplete,
} from './transactions.js';

// Import sub-module imports
import {
  importSdkSession as _importSdkSession,
  importSessionSummary as _importSessionSummary,
  importObservation as _importObservation,
  importUserPrompt as _importUserPrompt
} from './import/bulk.js';

/**
 * Session data store for SDK sessions, observations, and summaries
 * Thin facade — all SQL lives in sub-modules under observations/, summaries/,
 * sessions/, prompts/, timeline/, and transactions.ts
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


  // ===========================================
  // Session Methods
  // ===========================================

  updateMemorySessionId(sessionDbId: number, memorySessionId: string | null): void {
    return _updateMemorySessionId(this.db, sessionDbId, memorySessionId);
  }

  ensureMemorySessionIdRegistered(sessionDbId: number, memorySessionId: string): void {
    return _ensureMemorySessionIdRegistered(this.db, sessionDbId, memorySessionId);
  }

  createSDKSession(contentSessionId: string, project: string, userPrompt: string, customTitle?: string): number {
    return _createSDKSession(this.db, contentSessionId, project, userPrompt, customTitle);
  }

  getSessionById(id: number): {
    id: number;
    content_session_id: string;
    memory_session_id: string | null;
    project: string;
    user_prompt: string;
    custom_title: string | null;
  } | null {
    return _getSessionById(this.db, id);
  }

  getSdkSessionsBySessionIds(memorySessionIds: string[]): {
    id: number;
    content_session_id: string;
    memory_session_id: string;
    project: string;
    user_prompt: string;
    custom_title: string | null;
    started_at: string;
    started_at_epoch: number;
    completed_at: string | null;
    completed_at_epoch: number | null;
    status: string;
  }[] {
    return _getSdkSessionsBySessionIds(this.db, memorySessionIds) as any[];
  }

  getRecentSessionsWithStatus(project: string, limit: number = 3): Array<{
    memory_session_id: string | null;
    status: string;
    started_at: string;
    user_prompt: string | null;
    has_summary: boolean;
  }> {
    return _getRecentSessionsWithStatus(this.db, project, limit) as any[];
  }

  getOrCreateManualSession(project: string): string {
    return _getOrCreateManualSession(this.db, project);
  }

  getSessionSummaryById(id: number): {
    id: number;
    memory_session_id: string | null;
    content_session_id: string;
    project: string;
    user_prompt: string;
    request_summary: string | null;
    learned_summary: string | null;
    status: string;
    created_at: string;
    created_at_epoch: number;
  } | null {
    return _getSessionSummaryById(this.db, id) as any;
  }


  // ===========================================
  // Observation Methods
  // ===========================================

  getRecentObservations(project: string, limit: number = 20): Array<{
    type: string;
    text: string;
    prompt_number: number | null;
    created_at: string;
  }> {
    return _getRecentObservations(this.db, project, limit) as any[];
  }

  getAllRecentObservations(limit: number = 100): Array<{
    id: number;
    type: string;
    title: string | null;
    subtitle: string | null;
    text: string;
    project: string;
    prompt_number: number | null;
    created_at: string;
    created_at_epoch: number;
  }> {
    return _getAllRecentObservations(this.db, limit) as any[];
  }

  getObservationsForSession(memorySessionId: string): Array<{
    title: string;
    subtitle: string;
    type: string;
    prompt_number: number | null;
  }> {
    return _getObservationsForSession(this.db, memorySessionId) as any[];
  }

  getObservationById(id: number): ObservationRow | null {
    return _getObservationById(this.db, id);
  }

  getObservationsByIds(
    ids: number[],
    options: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string; type?: string | string[]; concepts?: string | string[]; files?: string | string[] } = {}
  ): ObservationRow[] {
    return _getObservationsByIds(this.db, ids, options);
  }

  getFilesForSession(memorySessionId: string): {
    filesRead: string[];
    filesModified: string[];
  } {
    return _getFilesForSession(this.db, memorySessionId);
  }

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
  ): { id: number; createdAtEpoch: number } {
    return _storeObservation(this.db, memorySessionId, project, observation, promptNumber, discoveryTokens, overrideTimestampEpoch);
  }


  // ===========================================
  // Summary Methods
  // ===========================================

  getRecentSummaries(project: string, limit: number = 10): Array<{
    request: string | null;
    investigated: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    files_read: string | null;
    files_edited: string | null;
    notes: string | null;
    prompt_number: number | null;
    created_at: string;
  }> {
    return _getRecentSummaries(this.db, project, limit) as any[];
  }

  getRecentSummariesWithSessionInfo(project: string, limit: number = 3): Array<{
    memory_session_id: string;
    request: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    prompt_number: number | null;
    created_at: string;
  }> {
    return _getRecentSummariesWithSessionInfo(this.db, project, limit) as any[];
  }

  getAllRecentSummaries(limit: number = 50): Array<{
    id: number;
    request: string | null;
    investigated: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    files_read: string | null;
    files_edited: string | null;
    notes: string | null;
    project: string;
    prompt_number: number | null;
    created_at: string;
    created_at_epoch: number;
  }> {
    return _getAllRecentSummaries(this.db, limit) as any[];
  }

  getSummaryForSession(memorySessionId: string): {
    request: string | null;
    investigated: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    files_read: string | null;
    files_edited: string | null;
    notes: string | null;
    prompt_number: number | null;
    created_at: string;
    created_at_epoch: number;
  } | null {
    return _getSummaryForSession(this.db, memorySessionId) as any;
  }

  getSessionSummariesByIds(
    ids: number[],
    options: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string } = {}
  ): SessionSummaryRow[] {
    return _getSummariesByIds(this.db, ids, options);
  }

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
  ): { id: number; createdAtEpoch: number } {
    return _storeSummary(this.db, memorySessionId, project, summary, promptNumber, discoveryTokens, overrideTimestampEpoch);
  }


  // ===========================================
  // Prompt Methods
  // ===========================================

  getAllRecentUserPrompts(limit: number = 100): Array<{
    id: number;
    content_session_id: string;
    project: string;
    prompt_number: number;
    prompt_text: string;
    created_at: string;
    created_at_epoch: number;
  }> {
    return _getAllRecentUserPrompts(this.db, limit) as any[];
  }

  getLatestUserPrompt(contentSessionId: string): {
    id: number;
    content_session_id: string;
    memory_session_id: string;
    project: string;
    prompt_number: number;
    prompt_text: string;
    created_at_epoch: number;
  } | undefined {
    return _getLatestUserPrompt(this.db, contentSessionId) as any;
  }

  getPromptNumberFromUserPrompts(contentSessionId: string): number {
    return _getPromptNumberFromUserPrompts(this.db, contentSessionId);
  }

  saveUserPrompt(contentSessionId: string, promptNumber: number, promptText: string): number {
    return _saveUserPrompt(this.db, contentSessionId, promptNumber, promptText);
  }

  getUserPrompt(contentSessionId: string, promptNumber: number): string | null {
    return _getUserPrompt(this.db, contentSessionId, promptNumber);
  }

  getPromptById(id: number): {
    id: number;
    content_session_id: string;
    prompt_number: number;
    prompt_text: string;
    project: string;
    created_at: string;
    created_at_epoch: number;
  } | null {
    return _getPromptById(this.db, id) as any;
  }

  getPromptsByIds(ids: number[]): Array<{
    id: number;
    content_session_id: string;
    prompt_number: number;
    prompt_text: string;
    project: string;
    created_at: string;
    created_at_epoch: number;
  }> {
    return _getPromptsByIds(this.db, ids) as any[];
  }

  getUserPromptsByIds(
    ids: number[],
    options: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string } = {}
  ): UserPromptRecord[] {
    return _getUserPromptsByIds(this.db, ids, options);
  }


  // ===========================================
  // Timeline Methods
  // ===========================================

  getAllProjects(): string[] {
    return _getAllProjects(this.db);
  }

  getTimelineAroundTimestamp(
    anchorEpoch: number,
    depthBefore: number = 10,
    depthAfter: number = 10,
    project?: string
  ): {
    observations: any[];
    sessions: any[];
    prompts: any[];
  } {
    return _getTimelineAroundTimestamp(this.db, anchorEpoch, depthBefore, depthAfter, project);
  }

  getTimelineAroundObservation(
    anchorObservationId: number | null,
    anchorEpoch: number,
    depthBefore: number = 10,
    depthAfter: number = 10,
    project?: string
  ): {
    observations: any[];
    sessions: any[];
    prompts: any[];
  } {
    return _getTimelineAroundObservation(this.db, anchorObservationId, anchorEpoch, depthBefore, depthAfter, project);
  }


  // ===========================================
  // Transaction Methods (Atomic)
  // ===========================================

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
    return _storeObservations(this.db, memorySessionId, project, observations, summary, promptNumber, discoveryTokens, overrideTimestampEpoch);
  }

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
    return _storeObservationsAndMarkComplete(this.db, memorySessionId, project, observations, summary, messageId, promptNumber, discoveryTokens, overrideTimestampEpoch) as any;
  }


  // ===========================================
  // Import Methods (for import-memories script)
  // ===========================================

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

  importUserPrompt(prompt: {
    content_session_id: string;
    prompt_number: number;
    prompt_text: string;
    created_at: string;
    created_at_epoch: number;
  }): { imported: boolean; id: number } {
    return _importUserPrompt(this.db, prompt);
  }


  // ===========================================
  // Lifecycle
  // ===========================================

  close(): void {
    this.db.close();
  }
}
