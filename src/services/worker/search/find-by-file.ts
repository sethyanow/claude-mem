/**
 * Extracted from SearchManager.findByFile()
 * File-specific search with observation+session combination and chroma ranking.
 */

import type { ObservationSearchResult, SessionSummarySearchResult } from '../../sqlite/types.js';
import { logger } from '../../../utils/logger.js';
import { groupByDate } from '../../../shared/timeline-formatting.js';

export interface FindByFileDeps {
  normalizeParams: (args: any) => any;
  queryChroma: (query: string, limit: number, whereFilter?: Record<string, any>) => Promise<{ ids: number[]; distances: number[]; metadatas: any[] }>;
  chromaAvailable: boolean;
  sessionSearch: {
    findByFile: (filePath: string, filters: any) => { observations: ObservationSearchResult[]; sessions: SessionSummarySearchResult[] };
  };
  sessionStore: {
    getObservationsByIds: (ids: number[], opts: any) => ObservationSearchResult[];
  };
  formatter: {
    formatTableHeader: () => string;
    formatObservationIndex: (obs: ObservationSearchResult, i: number) => string;
    formatSessionIndex: (sess: SessionSummarySearchResult, i: number) => string;
  };
}

export async function executeFindByFile(args: any, deps: FindByFileDeps): Promise<any> {
  const normalized = deps.normalizeParams(args);
  const { files: rawFilePath, ...filters } = normalized;
  // Handle both string and array (normalizeParams may split on comma)
  const filePath = Array.isArray(rawFilePath) ? rawFilePath[0] : rawFilePath;
  let observations: ObservationSearchResult[] = [];
  let sessions: SessionSummarySearchResult[] = [];

  // Metadata-first, semantic-enhanced search for observations
  if (deps.chromaAvailable) {
    logger.debug('SEARCH', 'Using metadata-first + semantic ranking for file search', {});

    // Step 1: SQLite metadata filter (get all results with this file)
    const metadataResults = deps.sessionSearch.findByFile(filePath, filters);
    logger.debug('SEARCH', 'Found results for file', { file: filePath, observations: metadataResults.observations.length, sessions: metadataResults.sessions.length });

    // Sessions: Keep as-is (already summarized, no semantic ranking needed)
    sessions = metadataResults.sessions;

    // Observations: Apply semantic ranking
    if (metadataResults.observations.length > 0) {
      // Step 2: Chroma semantic ranking (rank by relevance to file path)
      const ids = metadataResults.observations.map(obs => obs.id);
      const chromaResults = await deps.queryChroma(filePath, Math.min(ids.length, 100));

      // Intersect: Keep only IDs that passed metadata filter, in semantic rank order
      const rankedIds: number[] = [];
      for (const chromaId of chromaResults.ids) {
        if (ids.includes(chromaId) && !rankedIds.includes(chromaId)) {
          rankedIds.push(chromaId);
        }
      }

      logger.debug('SEARCH', 'Chroma ranked observations by semantic relevance', { count: rankedIds.length });

      // Step 3: Hydrate in semantic rank order
      if (rankedIds.length > 0) {
        observations = deps.sessionStore.getObservationsByIds(rankedIds, { limit: filters.limit || 20 });
        // Restore semantic ranking order
        observations.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
      }
    }
  }

  // Fall back to SQLite-only if Chroma unavailable or failed
  if (observations.length === 0 && sessions.length === 0) {
    logger.debug('SEARCH', 'Using SQLite-only file search', {});
    const results = deps.sessionSearch.findByFile(filePath, filters);
    observations = results.observations;
    sessions = results.sessions;
  }

  const totalResults = observations.length + sessions.length;

  if (totalResults === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `No results found for file "${filePath}"`
      }]
    };
  }

  // Combine observations and sessions with timestamps for date grouping
  const combined: Array<{
    type: 'observation' | 'session';
    data: ObservationSearchResult | SessionSummarySearchResult;
    epoch: number;
    created_at: string;
  }> = [
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
    }))
  ];

  // Sort by date (most recent first)
  combined.sort((a, b) => b.epoch - a.epoch);

  // Group by date for proper timeline rendering
  const resultsByDate = groupByDate(combined, item => item.created_at);

  // Format with date headers for proper date parsing by folder CLAUDE.md generator
  const lines: string[] = [];
  lines.push(`Found ${totalResults} result(s) for file "${filePath}"`);
  lines.push('');

  for (const [day, dayResults] of resultsByDate) {
    lines.push(`### ${day}`);
    lines.push('');
    lines.push(deps.formatter.formatTableHeader());

    for (const result of dayResults) {
      if (result.type === 'observation') {
        lines.push(deps.formatter.formatObservationIndex(result.data as ObservationSearchResult, 0));
      } else {
        lines.push(deps.formatter.formatSessionIndex(result.data as SessionSummarySearchResult, 0));
      }
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
