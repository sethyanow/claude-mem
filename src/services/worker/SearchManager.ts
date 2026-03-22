/**
 * SearchManager - Core search orchestration for claude-mem
 *
 * This class is a thin wrapper that delegates to the modular search infrastructure.
 * It maintains the same public interface for backward compatibility.
 *
 * The actual search logic is now in:
 * - SearchOrchestrator: Strategy selection and coordination
 * - ChromaSearchStrategy: Vector-based semantic search
 * - SQLiteSearchStrategy: Filter-only queries
 * - HybridSearchStrategy: Metadata filtering + semantic ranking
 * - ResultFormatter: Output formatting
 * - TimelineBuilder: Timeline construction
 */

import { basename } from 'path';
import { SessionSearch } from '../sqlite/SessionSearch.js';
import { SessionStore } from '../sqlite/SessionStore.js';
import { ChromaSync } from '../sync/ChromaSync.js';
import { FormattingService } from './FormattingService.js';
import { TimelineService } from './TimelineService.js';
import type { ObservationSearchResult } from '../sqlite/types.js';
import { logger } from '../../utils/logger.js';

import {
  SearchOrchestrator,
  TimelineBuilder,
} from './search/index.js';
import { executeQueryFirstSearch, executeMetadataFirstSearch } from './search/execute.js';
import type { SearchDeps } from './search/execute.js';
import { findByFile as findByFileImpl } from './search/find-by-file.js';
import type { FindByFileDeps } from './search/find-by-file.js';
import { multiSearch } from './search/multi-search.js';
import { timelineHandler } from './search/timeline-handler.js';
import { contextTimeline } from './search/context-timeline.js';
import { queryTimeline } from './search/query-timeline.js';

export class SearchManager {
  private orchestrator: SearchOrchestrator;
  private timelineBuilder: TimelineBuilder;

  constructor(
    private sessionSearch: SessionSearch,
    private sessionStore: SessionStore,
    private chromaSync: ChromaSync | null,
    private formatter: FormattingService,
    private timelineService: TimelineService
  ) {
    // Initialize the new modular search infrastructure
    this.orchestrator = new SearchOrchestrator(
      sessionSearch,
      sessionStore,
      chromaSync
    );
    this.timelineBuilder = new TimelineBuilder();
  }

  /** Build deps object for shared search execution functions */
  private searchDeps(): SearchDeps {
    return {
      normalizeParams: (a: any) => this.normalizeParams(a),
      queryChroma: (q: string, l: number, f?: Record<string, any>) => this.queryChroma(q, l, f),
      chromaAvailable: !!this.chromaSync,
      formatter: this.formatter,
    };
  }

  /**
   * Query Chroma vector database via ChromaSync
   * @deprecated Use orchestrator.search() instead
   */
  private async queryChroma(
    query: string,
    limit: number,
    whereFilter?: Record<string, any>
  ): Promise<{ ids: number[]; distances: number[]; metadatas: any[] }> {
    if (!this.chromaSync) {
      return { ids: [], distances: [], metadatas: [] };
    }
    return await this.chromaSync.queryChroma(query, limit, whereFilter);
  }

  /**
   * Helper to normalize query parameters from URL-friendly format
   * Converts comma-separated strings to arrays and flattens date params
   */
  private normalizeParams(args: any): any {
    const normalized: any = { ...args };

    // Map filePath to files (API uses filePath, internal uses files)
    if (normalized.filePath && !normalized.files) {
      normalized.files = normalized.filePath;
      delete normalized.filePath;
    }

    // Parse comma-separated concepts into array
    if (normalized.concepts && typeof normalized.concepts === 'string') {
      normalized.concepts = normalized.concepts.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    // Parse comma-separated files into array
    if (normalized.files && typeof normalized.files === 'string') {
      normalized.files = normalized.files.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    // Parse comma-separated obs_type into array
    if (normalized.obs_type && typeof normalized.obs_type === 'string') {
      normalized.obs_type = normalized.obs_type.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    // Parse comma-separated type (for filterSchema) into array
    if (normalized.type && typeof normalized.type === 'string' && normalized.type.includes(',')) {
      normalized.type = normalized.type.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    // Flatten dateStart/dateEnd into dateRange object
    if (normalized.dateStart || normalized.dateEnd) {
      normalized.dateRange = {
        start: normalized.dateStart,
        end: normalized.dateEnd
      };
      delete normalized.dateStart;
      delete normalized.dateEnd;
    }

    // Parse isFolder boolean from string
    if (normalized.isFolder === 'true') {
      normalized.isFolder = true;
    } else if (normalized.isFolder === 'false') {
      normalized.isFolder = false;
    }

    return normalized;
  }

  /**
   * Tool handler: search
   */
  async search(args: any): Promise<any> {
    return multiSearch(this.findByFileDeps(), args);
  }

  /**
   * Tool handler: timeline
   */
  async timeline(args: any): Promise<any> {
    return timelineHandler(this.timelineDeps(), args);
  }

  private timelineDeps() {
    return {
      queryChroma: (q: string, l: number, f?: Record<string, any>) => this.queryChroma(q, l, f),
      chromaAvailable: !!this.chromaSync,
      sessionStore: this.sessionStore,
      timelineService: this.timelineService,
    };
  }

  /**
   * Tool handler: decisions
   */
  async decisions(args: any): Promise<any> {
    return executeMetadataFirstSearch(args, this.searchDeps(), {
      getMetadataIds: (n) => this.sessionSearch.findByType('decision', n).map((obs: ObservationSearchResult) => obs.id),
      chromaQueryString: () => 'decision',
      hydrateObservations: (ids, opts) => this.sessionStore.getObservationsByIds(ids, opts),
      extractQuery: (n) => n.query,
      directChromaSearch: async (deps, query, n) => {
        const chromaResults = await deps.queryChroma(query, Math.min((n.limit || 20) * 2, 100), { type: 'decision' });
        const obsIds = chromaResults.ids;
        if (obsIds.length > 0) {
          const results = this.sessionStore.getObservationsByIds(obsIds, { ...n, type: 'decision' });
          results.sort((a: ObservationSearchResult, b: ObservationSearchResult) => obsIds.indexOf(a.id) - obsIds.indexOf(b.id));
          return results;
        }
        return [];
      },
      wrapInTryCatch: true,
      getFallbackResults: (n) => this.sessionSearch.findByType('decision', n),
      emptyMessage: 'No decision observations found',
      headerText: (count: number) => `Found ${count} decision(s)`,
      formatResult: (obs, i) => this.formatter.formatObservationIndex(obs, i),
      logLabel: 'decisions',
    });
  }

  /**
   * Tool handler: changes
   */
  async changes(args: any): Promise<any> {
    // Helper: multi-source metadata query with deduplication
    const getChangeIds = (n: any): number[] => {
      const typeResults = this.sessionSearch.findByType('change', n);
      const conceptChange = this.sessionSearch.findByConcept('change', n);
      const conceptWhatChanged = this.sessionSearch.findByConcept('what-changed', n);
      const allIds = new Set<number>();
      [...typeResults, ...conceptChange, ...conceptWhatChanged].forEach(obs => allIds.add(obs.id));
      return Array.from(allIds);
    };

    // Helper: multi-source fallback with dedup and temporal sort
    const getChangeFallback = (n: any): ObservationSearchResult[] => {
      const typeResults = this.sessionSearch.findByType('change', n);
      const conceptResults = this.sessionSearch.findByConcept('change', n);
      const whatChangedResults = this.sessionSearch.findByConcept('what-changed', n);
      const allIds = new Set<number>();
      [...typeResults, ...conceptResults, ...whatChangedResults].forEach(obs => allIds.add(obs.id));
      const results = Array.from(allIds).map(id =>
        typeResults.find(obs => obs.id === id) ||
        conceptResults.find(obs => obs.id === id) ||
        whatChangedResults.find(obs => obs.id === id)
      ).filter(Boolean) as ObservationSearchResult[];
      results.sort((a, b) => b.created_at_epoch - a.created_at_epoch);
      return results.slice(0, n.limit || 20);
    };

    return executeMetadataFirstSearch(args, this.searchDeps(), {
      getMetadataIds: getChangeIds,
      chromaQueryString: () => 'what changed',
      hydrateObservations: (ids, opts) => this.sessionStore.getObservationsByIds(ids, opts),
      wrapInTryCatch: true,
      getFallbackResults: getChangeFallback,
      emptyMessage: 'No change-related observations found',
      headerText: (count: number) => `Found ${count} change-related observation(s)`,
      formatResult: (obs, i) => this.formatter.formatObservationIndex(obs, i),
      logLabel: 'changes',
    });
  }


  /**
   * Tool handler: how_it_works
   */
  async howItWorks(args: any): Promise<any> {
    return executeMetadataFirstSearch(args, this.searchDeps(), {
      getMetadataIds: (normalized) => this.sessionSearch.findByConcept('how-it-works', normalized).map(obs => obs.id),
      chromaQueryString: () => 'how it works architecture',
      hydrateObservations: (ids, opts) => this.sessionStore.getObservationsByIds(ids, opts),
      wrapInTryCatch: false,
      getFallbackResults: (normalized) => this.sessionSearch.findByConcept('how-it-works', normalized),
      emptyMessage: 'No "how it works" observations found',
      headerText: (count: number) => `Found ${count} "how it works" observation(s)`,
      formatResult: (obs, i) => this.formatter.formatObservationIndex(obs, i),
      logLabel: 'how-it-works',
    });
  }


  /**
   * Tool handler: search_observations
   */
  async searchObservations(args: any): Promise<any> {
    return executeQueryFirstSearch(args, this.searchDeps(), {
      hydrate: (ids, opts) => this.sessionStore.getObservationsByIds(ids, opts),
      emptyMessage: (query) => `No observations found matching "${query}"`,
      formatResult: (obs, i) => this.formatter.formatObservationIndex(obs, i),
      headerText: (count, query) => `Found ${count} observation(s) matching "${query}"`,
      logLabel: 'observations',
    });
  }


  /**
   * Tool handler: search_sessions
   */
  async searchSessions(args: any): Promise<any> {
    return executeQueryFirstSearch(args, this.searchDeps(), {
      chromaFilter: { doc_type: 'session_summary' },
      hydrate: (ids, opts) => this.sessionStore.getSessionSummariesByIds(ids, opts),
      emptyMessage: (query) => `No sessions found matching "${query}"`,
      formatResult: (session, i) => this.formatter.formatSessionIndex(session, i),
      headerText: (count, query) => `Found ${count} session(s) matching "${query}"`,
      logLabel: 'sessions',
    });
  }


  /**
   * Tool handler: search_user_prompts
   */
  async searchUserPrompts(args: any): Promise<any> {
    return executeQueryFirstSearch(args, this.searchDeps(), {
      chromaFilter: { doc_type: 'user_prompt' },
      hydrate: (ids, opts) => this.sessionStore.getUserPromptsByIds(ids, opts),
      emptyMessage: (query) => query ? `No user prompts found matching "${query}"` : 'No user prompts found',
      formatResult: (prompt, i) => this.formatter.formatUserPromptIndex(prompt, i),
      headerText: (count, query) => `Found ${count} user prompt(s) matching "${query}"`,
      logLabel: 'user prompts',
    });
  }


  /**
   * Tool handler: find_by_concept
   */
  async findByConcept(args: any): Promise<any> {
    return executeMetadataFirstSearch(args, this.searchDeps(), {
      getMetadataIds: (n) => this.sessionSearch.findByConcept(n.concepts, n).map((obs: ObservationSearchResult) => obs.id),
      chromaQueryString: (n) => n.concepts,
      hydrateObservations: (ids, opts) => this.sessionStore.getObservationsByIds(ids, opts),
      wrapInTryCatch: false,
      getFallbackResults: (n) => this.sessionSearch.findByConcept(n.concepts, n),
      emptyMessage: (n: any) => `No observations found with concept "${n.concepts}"`,
      headerText: (count: number, n: any) => `Found ${count} observation(s) with concept "${n.concepts}"`,
      formatResult: (obs, i) => this.formatter.formatObservationIndex(obs, i),
      logLabel: 'concept search',
    });
  }


  /**
   * Tool handler: find_by_file
   */
  async findByFile(args: any): Promise<any> {
    return findByFileImpl(this.findByFileDeps(), args);
  }

  private findByFileDeps(): FindByFileDeps {
    return {
      ...this.searchDeps(),
      sessionSearch: this.sessionSearch,
      sessionStore: this.sessionStore,
    };
  }


  /**
   * Tool handler: find_by_type
   */
  async findByType(args: any): Promise<any> {
    return executeMetadataFirstSearch(args, this.searchDeps(), {
      getMetadataIds: (n) => this.sessionSearch.findByType(n.type, n).map((obs: ObservationSearchResult) => obs.id),
      chromaQueryString: (n) => Array.isArray(n.type) ? n.type.join(', ') : n.type,
      hydrateObservations: (ids, opts) => this.sessionStore.getObservationsByIds(ids, opts),
      wrapInTryCatch: false,
      getFallbackResults: (n) => this.sessionSearch.findByType(n.type, n),
      emptyMessage: (n: any) => {
        const typeStr = Array.isArray(n.type) ? n.type.join(', ') : n.type;
        return `No observations found with type "${typeStr}"`;
      },
      headerText: (count: number, n: any) => {
        const typeStr = Array.isArray(n.type) ? n.type.join(', ') : n.type;
        return `Found ${count} observation(s) with type "${typeStr}"`;
      },
      formatResult: (obs, i) => this.formatter.formatObservationIndex(obs, i),
      logLabel: 'type search',
    });
  }


  /**
   * Tool handler: get_recent_context
   */
  async getRecentContext(args: any): Promise<any> {
    const project = args.project || basename(process.cwd());
    const limit = args.limit || 3;

    const sessions = this.sessionStore.getRecentSessionsWithStatus(project, limit);

    if (sessions.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `# Recent Session Context\n\nNo previous sessions found for project "${project}".`
        }]
      };
    }

    const lines: string[] = [];
    lines.push('# Recent Session Context');
    lines.push('');
    lines.push(`Showing last ${sessions.length} session(s) for **${project}**:`);
    lines.push('');

    for (const session of sessions) {
      if (!session.memory_session_id) continue;

      lines.push('---');
      lines.push('');

      if (session.has_summary) {
        const summary = this.sessionStore.getSummaryForSession(session.memory_session_id);
        if (summary) {
          const promptLabel = summary.prompt_number ? ` (Prompt #${summary.prompt_number})` : '';
          lines.push(`**Summary${promptLabel}**`);
          lines.push('');

          if (summary.request) lines.push(`**Request:** ${summary.request}`);
          if (summary.completed) lines.push(`**Completed:** ${summary.completed}`);
          if (summary.learned) lines.push(`**Learned:** ${summary.learned}`);
          if (summary.next_steps) lines.push(`**Next Steps:** ${summary.next_steps}`);

          // Handle files_read
          if (summary.files_read) {
            try {
              const filesRead = JSON.parse(summary.files_read);
              if (Array.isArray(filesRead) && filesRead.length > 0) {
                lines.push(`**Files Read:** ${filesRead.join(', ')}`);
              }
            } catch (error) {
              logger.debug('WORKER', 'files_read is plain string, using as-is', {}, error as Error);
              if (summary.files_read.trim()) {
                lines.push(`**Files Read:** ${summary.files_read}`);
              }
            }
          }

          // Handle files_edited
          if (summary.files_edited) {
            try {
              const filesEdited = JSON.parse(summary.files_edited);
              if (Array.isArray(filesEdited) && filesEdited.length > 0) {
                lines.push(`**Files Edited:** ${filesEdited.join(', ')}`);
              }
            } catch (error) {
              logger.debug('WORKER', 'files_edited is plain string, using as-is', {}, error as Error);
              if (summary.files_edited.trim()) {
                lines.push(`**Files Edited:** ${summary.files_edited}`);
              }
            }
          }

          const date = new Date(summary.created_at).toLocaleString();
          lines.push(`**Date:** ${date}`);
        }
      } else if (session.status === 'active') {
        lines.push('**In Progress**');
        lines.push('');

        if (session.user_prompt) {
          lines.push(`**Request:** ${session.user_prompt}`);
        }

        const observations = this.sessionStore.getObservationsForSession(session.memory_session_id);
        if (observations.length > 0) {
          lines.push('');
          lines.push(`**Observations (${observations.length}):**`);
          for (const obs of observations) {
            lines.push(`- ${obs.title}`);
          }
        } else {
          lines.push('');
          lines.push('*No observations yet*');
        }

        lines.push('');
        lines.push('**Status:** Active - summary pending');

        const date = new Date(session.started_at).toLocaleString();
        lines.push(`**Date:** ${date}`);
      } else {
        lines.push(`**${session.status.charAt(0).toUpperCase() + session.status.slice(1)}**`);
        lines.push('');

        if (session.user_prompt) {
          lines.push(`**Request:** ${session.user_prompt}`);
        }

        lines.push('');
        lines.push(`**Status:** ${session.status} - no summary available`);

        const date = new Date(session.started_at).toLocaleString();
        lines.push(`**Date:** ${date}`);
      }

      lines.push('');
    }

    return {
      content: [{
        type: 'text' as const,
        text: lines.join('\n')
      }]
    };
  }

  /**
   * Tool handler: get_context_timeline
   */
  async getContextTimeline(args: any): Promise<any> {
    return contextTimeline(this.timelineDeps(), args);
  }

  /**
   * Tool handler: get_timeline_by_query
   */
  async getTimelineByQuery(args: any): Promise<any> {
    return queryTimeline(this.timelineDeps(), args);
  }
}
