/**
 * multi-search — Extracted from SearchManager.search()
 *
 * Multi-type search with chroma ranking, date filtering, file grouping.
 * Supports observations, sessions, and prompts with optional type filtering.
 */

import { logger } from '../../../utils/logger.js';
import { groupByDate, extractFirstFile } from '../../../shared/timeline-formatting.js';
import { SEARCH_CONSTANTS } from './types.js';
import type { ObservationSearchResult, SessionSummarySearchResult, UserPromptSearchResult } from '../../sqlite/types.js';
import type { SearchDeps } from './execute.js';
import type { SessionSearch } from '../../sqlite/SessionSearch.js';
import type { SessionStore } from '../../sqlite/SessionStore.js';

export interface MultiSearchDeps extends SearchDeps {
  sessionSearch: SessionSearch;
  sessionStore: SessionStore;
}

interface CombinedResult {
  type: 'observation' | 'session' | 'prompt';
  data: any;
  epoch: number;
  created_at: string;
}

export async function multiSearch(deps: MultiSearchDeps, args: any): Promise<any> {
  const normalized = deps.normalizeParams(args);
  const { query, type, obs_type, concepts, files, format, ...options } = normalized;
  let observations: ObservationSearchResult[] = [];
  let sessions: SessionSummarySearchResult[] = [];
  let prompts: UserPromptSearchResult[] = [];
  let chromaFailed = false;

  const searchObservations = !type || type === 'observations';
  const searchSessions = !type || type === 'sessions';
  const searchPrompts = !type || type === 'prompts';

  // PATH 1: FILTER-ONLY (no query text)
  if (!query) {
    logger.debug('SEARCH', 'Filter-only query (no query text), using direct SQLite filtering', { enablesDateFilters: true });
    const obsOptions = { ...options, type: obs_type, concepts, files };
    if (searchObservations) {
      observations = deps.sessionSearch.searchObservations(undefined, obsOptions);
    }
    if (searchSessions) {
      sessions = deps.sessionSearch.searchSessions(undefined, options);
    }
    if (searchPrompts) {
      prompts = deps.sessionSearch.searchUserPrompts(undefined, options);
    }
  }
  // PATH 2: CHROMA SEMANTIC SEARCH
  else if (deps.chromaAvailable) {
    let chromaSucceeded = false;
    logger.debug('SEARCH', 'Using ChromaDB semantic search', { typeFilter: type || 'all' });

    let whereFilter: Record<string, any> | undefined;
    if (type === 'observations') {
      whereFilter = { doc_type: 'observation' };
    } else if (type === 'sessions') {
      whereFilter = { doc_type: 'session_summary' };
    } else if (type === 'prompts') {
      whereFilter = { doc_type: 'user_prompt' };
    }

    if (options.project) {
      const projectFilter = { project: options.project };
      whereFilter = whereFilter
        ? { $and: [whereFilter, projectFilter] }
        : projectFilter;
    }

    const chromaResults = await deps.queryChroma(query, 100, whereFilter);
    chromaSucceeded = true;
    logger.debug('SEARCH', 'ChromaDB returned semantic matches', { matchCount: chromaResults.ids.length });

    if (chromaResults.ids.length > 0) {
      const { dateRange } = options;
      let startEpoch: number | undefined;
      let endEpoch: number | undefined;

      if (dateRange) {
        if (dateRange.start) {
          startEpoch = typeof dateRange.start === 'number'
            ? dateRange.start
            : new Date(dateRange.start).getTime();
        }
        if (dateRange.end) {
          endEpoch = typeof dateRange.end === 'number'
            ? dateRange.end
            : new Date(dateRange.end).getTime();
        }
      } else {
        startEpoch = Date.now() - SEARCH_CONSTANTS.RECENCY_WINDOW_MS;
      }

      const recentMetadata = chromaResults.metadatas.map((meta, idx) => ({
        id: chromaResults.ids[idx],
        meta,
        isRecent: meta && meta.created_at_epoch != null
          && (!startEpoch || meta.created_at_epoch >= startEpoch)
          && (!endEpoch || meta.created_at_epoch <= endEpoch)
      })).filter(item => item.isRecent);

      logger.debug('SEARCH', dateRange ? 'Results within user date range' : 'Results within 90-day window', { count: recentMetadata.length });

      const obsIds: number[] = [];
      const sessionIds: number[] = [];
      const promptIds: number[] = [];

      for (const item of recentMetadata) {
        const docType = item.meta?.doc_type;
        if (docType === 'observation' && searchObservations) {
          obsIds.push(item.id);
        } else if (docType === 'session_summary' && searchSessions) {
          sessionIds.push(item.id);
        } else if (docType === 'user_prompt' && searchPrompts) {
          promptIds.push(item.id);
        }
      }

      logger.debug('SEARCH', 'Categorized results by type', { observations: obsIds.length, sessions: sessionIds.length, prompts: prompts.length });

      if (obsIds.length > 0) {
        const obsOptions = { ...options, type: obs_type, concepts, files };
        observations = deps.sessionStore.getObservationsByIds(obsIds, obsOptions);
      }
      if (sessionIds.length > 0) {
        sessions = deps.sessionStore.getSessionSummariesByIds(sessionIds, { orderBy: 'date_desc', limit: options.limit, project: options.project });
      }
      if (promptIds.length > 0) {
        prompts = deps.sessionStore.getUserPromptsByIds(promptIds, { orderBy: 'date_desc', limit: options.limit, project: options.project });
      }

      logger.debug('SEARCH', 'Hydrated results from SQLite', { observations: observations.length, sessions: sessions.length, prompts: prompts.length });
    } else {
      logger.debug('SEARCH', 'ChromaDB found no matches (final result, no FTS5 fallback)', {});
    }
  }
  // ChromaDB not initialized
  else if (query) {
    chromaFailed = true;
    logger.debug('SEARCH', 'ChromaDB not initialized - semantic search unavailable', {});
    logger.debug('SEARCH', 'Install UVX/Python to enable vector search', { url: 'https://docs.astral.sh/uv/getting-started/installation/' });
    observations = [];
    sessions = [];
    prompts = [];
  }

  const totalResults = observations.length + sessions.length + prompts.length;

  if (format === 'json') {
    return {
      observations,
      sessions,
      prompts,
      totalResults,
      query: query || ''
    };
  }

  if (totalResults === 0) {
    if (chromaFailed) {
      return {
        content: [{
          type: 'text' as const,
          text: `Vector search failed - semantic search unavailable.\n\nTo enable semantic search:\n1. Install uv: https://docs.astral.sh/uv/getting-started/installation/\n2. Restart the worker: npm run worker:restart\n\nNote: You can still use filter-only searches (date ranges, types, files) without a query term.`
        }]
      };
    }
    return {
      content: [{
        type: 'text' as const,
        text: `No results found matching "${query}"`
      }]
    };
  }

  const allResults: CombinedResult[] = [
    ...observations.map(obs => ({
      type: 'observation' as const,
      data: obs,
      epoch: obs.created_at_epoch,
      created_at: obs.created_at
    })),
    ...sessions.map(sess => ({
      type: 'session' as const,
      data: sess,
      epoch: sess.created_at_epoch,
      created_at: sess.created_at
    })),
    ...prompts.map(prompt => ({
      type: 'prompt' as const,
      data: prompt,
      epoch: prompt.created_at_epoch,
      created_at: prompt.created_at
    }))
  ];

  if (options.orderBy === 'date_desc') {
    allResults.sort((a, b) => b.epoch - a.epoch);
  } else if (options.orderBy === 'date_asc') {
    allResults.sort((a, b) => a.epoch - b.epoch);
  }

  const limitedResults = allResults.slice(0, options.limit || 20);

  const cwd = process.cwd();
  const resultsByDate = groupByDate(limitedResults, item => item.created_at);

  const lines: string[] = [];
  lines.push(`Found ${totalResults} result(s) matching "${query}" (${observations.length} obs, ${sessions.length} sessions, ${prompts.length} prompts)`);
  lines.push('');

  for (const [day, dayResults] of resultsByDate) {
    lines.push(`### ${day}`);
    lines.push('');

    const resultsByFile = new Map<string, CombinedResult[]>();
    for (const result of dayResults) {
      let file = 'General';
      if (result.type === 'observation') {
        file = extractFirstFile(result.data.files_modified, cwd, result.data.files_read);
      }
      if (!resultsByFile.has(file)) {
        resultsByFile.set(file, []);
      }
      resultsByFile.get(file)!.push(result);
    }

    for (const [file, fileResults] of resultsByFile) {
      lines.push(`**${file}**`);
      lines.push(deps.formatter.formatSearchTableHeader());

      let lastTime = '';
      for (const result of fileResults) {
        if (result.type === 'observation') {
          const formatted = deps.formatter.formatObservationSearchRow(result.data as ObservationSearchResult, lastTime);
          lines.push(formatted.row);
          lastTime = formatted.time;
        } else if (result.type === 'session') {
          const formatted = deps.formatter.formatSessionSearchRow(result.data as SessionSummarySearchResult, lastTime);
          lines.push(formatted.row);
          lastTime = formatted.time;
        } else {
          const formatted = deps.formatter.formatUserPromptSearchRow(result.data as UserPromptSearchResult, lastTime);
          lines.push(formatted.row);
          lastTime = formatted.time;
        }
      }

      lines.push('');
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: lines.join('\n')
    }]
  };
}
