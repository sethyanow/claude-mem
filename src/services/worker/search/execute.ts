/**
 * Shared search execution functions for SearchManager.
 *
 * Two patterns extracted from 8 SearchManager methods:
 * - Pattern A (query-first): searchObservations, searchSessions, searchUserPrompts
 * - Pattern B (metadata-first): decisions, changes, howItWorks, findByConcept, findByType
 *
 * Each SearchManager method becomes a thin wrapper that passes config to
 * one of these functions.
 */

import { logger } from '../../../utils/logger.js';
import { SEARCH_CONSTANTS } from './types.js';
import type { ObservationSearchResult } from '../../sqlite/types.js';
import type { FormattingService } from '../FormattingService.js';

/**
 * Dependencies provided by SearchManager to shared functions.
 * Built via SearchManager.searchDeps() from private members.
 */
export interface SearchDeps {
  normalizeParams: (args: any) => any;
  queryChroma: (query: string, limit: number, whereFilter?: Record<string, any>) => Promise<{ ids: number[]; distances: number[]; metadatas: any[] }>;
  chromaAvailable: boolean;
  formatter: FormattingService;
}

/** MCP tool response shape */
interface McpResponse {
  content: [{ type: 'text'; text: string }];
}

function mcpText(text: string): McpResponse {
  return { content: [{ type: 'text' as const, text }] };
}

// ─── Pattern A: Query-first search ──────────────────────────────────

/**
 * Config for Pattern A methods (Chroma semantic → recency filter → hydrate).
 * T is the result type (ObservationSearchResult, SessionSummarySearchResult, etc.)
 */
export interface QueryFirstConfig<T> {
  /** Optional Chroma where-filter (e.g. { doc_type: 'session_summary' }) */
  chromaFilter?: Record<string, any>;
  /** Hydrate result IDs from SQLite */
  hydrate: (ids: number[], opts: { orderBy: 'date_desc' | 'date_asc'; limit: number }) => T[];
  /** Empty-result message. Receives the query string. */
  emptyMessage: (query: string) => string;
  /** Format a single result row */
  formatResult: (result: T, index: number) => string;
  /** Header text (before table header). Receives count and query. */
  headerText: (count: number, query: string) => string;
  /** Log label for debug messages (e.g. 'observations', 'sessions') */
  logLabel: string;
}

/**
 * Executes a query-first search: Chroma semantic → 90-day recency → SQLite hydration.
 * Used by searchObservations, searchSessions, searchUserPrompts.
 */
export async function executeQueryFirstSearch<T>(
  args: any,
  deps: SearchDeps,
  config: QueryFirstConfig<T>
): Promise<McpResponse> {
  const normalized = deps.normalizeParams(args);
  const { query, ...options } = normalized;
  let results: T[] = [];

  if (deps.chromaAvailable) {
    logger.debug('SEARCH', `Using hybrid semantic search (Chroma + SQLite)`, {});

    const chromaResults = await deps.queryChroma(query, 100, config.chromaFilter);
    logger.debug('SEARCH', `Chroma returned semantic matches`, { matchCount: chromaResults.ids.length });

    if (chromaResults.ids.length > 0) {
      const ninetyDaysAgo = Date.now() - SEARCH_CONSTANTS.RECENCY_WINDOW_MS;
      const recentIds = chromaResults.ids.filter((_id: number, idx: number) => {
        const meta = chromaResults.metadatas[idx];
        return meta && meta.created_at_epoch > ninetyDaysAgo;
      });

      logger.debug('SEARCH', 'Results within 90-day window', { count: recentIds.length });

      if (recentIds.length > 0) {
        const limit = options.limit || 20;
        results = config.hydrate(recentIds, { orderBy: 'date_desc', limit });
        logger.debug('SEARCH', `Hydrated ${config.logLabel} from SQLite`, { count: results.length });
      }
    }
  }

  if (results.length === 0) {
    return mcpText(config.emptyMessage(query));
  }

  const header = `${config.headerText(results.length, query)}\n\n${deps.formatter.formatTableHeader()}`;
  const formattedResults = results.map((r, i) => config.formatResult(r, i));
  return mcpText(header + '\n' + formattedResults.join('\n'));
}


// ─── Pattern B: Metadata-first search ───────────────────────────────

/**
 * Config for Pattern B methods (metadata filter → Chroma ranking → hydrate).
 * All Pattern B methods return ObservationSearchResult[].
 */
export interface MetadataFirstConfig {
  /**
   * Get deduplicated IDs from metadata search.
   * For most methods: single sessionSearch call → map to IDs.
   * For changes(): three calls + Set dedup → array of IDs.
   */
  getMetadataIds: (normalized: any) => number[];

  /** Chroma query string for ranking (e.g. 'decision', 'how it works architecture') */
  chromaQueryString: (normalized: any) => string;

  /** Hydrate observation IDs from SQLite */
  hydrateObservations: (ids: number[], opts: { limit: number }) => ObservationSearchResult[];

  /**
   * Optional: direct Chroma search when query is present (for decisions()).
   * Returns results directly, skipping the metadata-first flow.
   */
  directChromaSearch?: (deps: SearchDeps, query: string, normalized: any) => Promise<ObservationSearchResult[]>;

  /** Extract query from normalized params (for decisions() query branch). Undefined = no query branch. */
  extractQuery?: (normalized: any) => string | undefined;

  /** Whether to wrap Chroma operations in try/catch with error logging */
  wrapInTryCatch: boolean;

  /** Fallback results when Chroma unavailable or produced no results */
  getFallbackResults: (normalized: any) => ObservationSearchResult[];

  /** Empty-result message. String or function receiving normalized params. */
  emptyMessage: string | ((normalized: any) => string);

  /** Header text (before table header). Receives count and normalized params. */
  headerText: (count: number, normalized: any) => string;

  /** Format a single observation row */
  formatResult: (result: ObservationSearchResult, index: number) => string;

  /** Log label for debug messages */
  logLabel: string;
}

/**
 * Core metadata-first ranking logic: metadata IDs → Chroma → intersect → hydrate.
 * Extracted to avoid duplication between the main flow and try/catch wrapper.
 */
async function metadataRankFlow(
  deps: SearchDeps,
  config: MetadataFirstConfig,
  normalized: any,
): Promise<ObservationSearchResult[]> {
  const metadataIds = config.getMetadataIds(normalized);

  logger.debug('SEARCH', `Found metadata results for ${config.logLabel}`, { count: metadataIds.length });

  if (metadataIds.length === 0) {
    return [];
  }

  const chromaStr = config.chromaQueryString(normalized);
  const chromaResults = await deps.queryChroma(chromaStr, Math.min(metadataIds.length, 100));

  const rankedIds: number[] = [];
  for (const chromaId of chromaResults.ids) {
    if (metadataIds.includes(chromaId) && !rankedIds.includes(chromaId)) {
      rankedIds.push(chromaId);
    }
  }

  logger.debug('SEARCH', `Chroma ranked results by semantic relevance`, { count: rankedIds.length });

  if (rankedIds.length === 0) {
    return [];
  }

  const limit = normalized.limit || 20;
  const results = config.hydrateObservations(rankedIds, { limit });
  results.sort((a: ObservationSearchResult, b: ObservationSearchResult) =>
    rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id)
  );

  return results;
}

/**
 * Executes a metadata-first search: metadata filter → Chroma ranking → hydrate.
 * Used by decisions, changes, howItWorks, findByConcept, findByType.
 */
export async function executeMetadataFirstSearch(
  args: any,
  deps: SearchDeps,
  config: MetadataFirstConfig,
): Promise<McpResponse> {
  const normalized = deps.normalizeParams(args);
  let results: ObservationSearchResult[] = [];

  if (deps.chromaAvailable) {
    logger.debug('SEARCH', `Using metadata-first + semantic ranking for ${config.logLabel}`, {});

    // Check for optional query branch (decisions() when query is present)
    const query = config.extractQuery?.(normalized);
    if (query && config.directChromaSearch) {
      // Direct Chroma search — decisions() with query
      if (config.wrapInTryCatch) {
        try {
          results = await config.directChromaSearch(deps, query, normalized);
        } catch (chromaError) {
          logger.error('SEARCH', `Chroma search failed for ${config.logLabel}, falling back to metadata search`, {}, chromaError as Error);
        }
      } else {
        results = await config.directChromaSearch(deps, query, normalized);
      }
    } else {
      // Standard metadata-first flow
      if (config.wrapInTryCatch) {
        try {
          results = await metadataRankFlow(deps, config, normalized);
        } catch (chromaError) {
          logger.error('SEARCH', `Chroma search failed for ${config.logLabel}, falling back to metadata search`, {}, chromaError as Error);
        }
      } else {
        results = await metadataRankFlow(deps, config, normalized);
      }
    }
  }

  // Fallback: metadata-only when Chroma unavailable or produced no results
  if (results.length === 0) {
    results = config.getFallbackResults(normalized);
  }

  if (results.length === 0) {
    const msg = typeof config.emptyMessage === 'function' ? config.emptyMessage(normalized) : config.emptyMessage;
    return mcpText(msg);
  }

  const header = `${config.headerText(results.length, normalized)}\n\n${deps.formatter.formatTableHeader()}`;
  const formattedResults = results.map((r, i) => config.formatResult(r, i));
  return mcpText(header + '\n' + formattedResults.join('\n'));
}
