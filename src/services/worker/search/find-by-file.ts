/**
 * find-by-file — Extracted from SearchManager.findByFile()
 *
 * File-specific search combining observations and sessions,
 * with optional Chroma semantic ranking for observations.
 */

import { logger } from '../../../utils/logger.js';
import { groupByDate } from '../../../shared/timeline-formatting.js';
import type { ObservationSearchResult, SessionSummarySearchResult } from '../../sqlite/types.js';
import type { SearchDeps } from './execute.js';
import type { SessionSearch } from '../../sqlite/SessionSearch.js';
import type { SessionStore } from '../../sqlite/SessionStore.js';

export interface FindByFileDeps extends SearchDeps {
  sessionSearch: SessionSearch;
  sessionStore: SessionStore;
}

export async function findByFile(deps: FindByFileDeps, args: any): Promise<any> {
  const normalized = deps.normalizeParams(args);
  const { files: rawFilePath, ...filters } = normalized;
  const filePath = Array.isArray(rawFilePath) ? rawFilePath[0] : rawFilePath;
  let observations: ObservationSearchResult[] = [];
  let sessions: SessionSummarySearchResult[] = [];

  // Metadata-first, semantic-enhanced search for observations
  if (deps.chromaAvailable) {
    logger.debug('SEARCH', 'Using metadata-first + semantic ranking for file search', {});

    const metadataResults = deps.sessionSearch.findByFile(filePath, filters);
    logger.debug('SEARCH', 'Found results for file', { file: filePath, observations: metadataResults.observations.length, sessions: metadataResults.sessions.length });

    sessions = metadataResults.sessions;

    if (metadataResults.observations.length > 0) {
      const ids = metadataResults.observations.map(obs => obs.id);
      const chromaResults = await deps.queryChroma(filePath, Math.min(ids.length, 100));

      const rankedIds: number[] = [];
      for (const chromaId of chromaResults.ids) {
        if (ids.includes(chromaId) && !rankedIds.includes(chromaId)) {
          rankedIds.push(chromaId);
        }
      }

      logger.debug('SEARCH', 'Chroma ranked observations by semantic relevance', { count: rankedIds.length });

      if (rankedIds.length > 0) {
        observations = deps.sessionStore.getObservationsByIds(rankedIds, { limit: filters.limit || 20 });
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

  combined.sort((a, b) => b.epoch - a.epoch);

  const resultsByDate = groupByDate(combined, item => item.created_at);

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
