/**
 * query-timeline — Extracted from SearchManager.getTimelineByQuery()
 *
 * Query-based timeline with chroma ranking. Searches for observations
 * matching a query, then builds a timeline around the top result.
 * Supports 'auto' (immediate timeline) and 'interactive' (show matches) modes.
 */

import { logger } from '../../../utils/logger.js';
import { formatDate, formatTime, formatDateTime, extractFirstFile, estimateTokens } from '../../../shared/timeline-formatting.js';
import { SEARCH_CONSTANTS } from './types.js';
import type { ObservationSearchResult, SessionSummarySearchResult, UserPromptSearchResult } from '../../sqlite/types.js';
import type { TimelineItem } from '../TimelineService.js';
import type { TimelineService } from '../TimelineService.js';
import type { SessionStore } from '../../sqlite/SessionStore.js';
import { ModeManager } from '../../domain/ModeManager.js';

export interface QueryTimelineDeps {
  queryChroma: (query: string, limit: number, whereFilter?: Record<string, any>) => Promise<{ ids: number[]; distances: number[]; metadatas: any[] }>;
  chromaAvailable: boolean;
  sessionStore: SessionStore;
  timelineService: TimelineService;
}

export async function queryTimeline(deps: QueryTimelineDeps, args: any): Promise<any> {
  const { query, mode = 'auto', depth_before = 10, depth_after = 10, limit = 5, project } = args;
  const cwd = process.cwd();

  // Step 1: Search for observations
  let results: ObservationSearchResult[] = [];

  if (deps.chromaAvailable) {
    logger.debug('SEARCH', 'Using hybrid semantic search for timeline query', {});
    const chromaResults = await deps.queryChroma(query, 100);
    logger.debug('SEARCH', 'Chroma returned semantic matches for timeline', { matchCount: chromaResults.ids.length });

    if (chromaResults.ids.length > 0) {
      const ninetyDaysAgo = Date.now() - SEARCH_CONSTANTS.RECENCY_WINDOW_MS;
      const recentIds = chromaResults.ids.filter((_id, idx) => {
        const meta = chromaResults.metadatas[idx];
        return meta && meta.created_at_epoch > ninetyDaysAgo;
      });

      logger.debug('SEARCH', 'Results within 90-day window', { count: recentIds.length });

      if (recentIds.length > 0) {
        results = deps.sessionStore.getObservationsByIds(recentIds, { orderBy: 'date_desc', limit: mode === 'auto' ? 1 : limit });
        logger.debug('SEARCH', 'Hydrated observations from SQLite', { count: results.length });
      }
    }
  }

  if (results.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `No observations found matching "${query}". Try a different search query.`
      }]
    };
  }

  // Step 2: Handle based on mode
  if (mode === 'interactive') {
    const lines: string[] = [];
    lines.push(`# Timeline Anchor Search Results`);
    lines.push('');
    lines.push(`Found ${results.length} observation(s) matching "${query}"`);
    lines.push('');
    lines.push(`To get timeline context around any of these observations, use the \`get_context_timeline\` tool with the observation ID as the anchor.`);
    lines.push('');
    lines.push(`**Top ${results.length} matches:**`);
    lines.push('');

    for (let i = 0; i < results.length; i++) {
      const obs = results[i];
      const title = obs.title || `Observation #${obs.id}`;
      const date = new Date(obs.created_at_epoch).toLocaleString();
      const type = obs.type ? `[${obs.type}]` : '';

      lines.push(`${i + 1}. **${type} ${title}**`);
      lines.push(`   - ID: ${obs.id}`);
      lines.push(`   - Date: ${date}`);
      if (obs.subtitle) {
        lines.push(`   - ${obs.subtitle}`);
      }
      lines.push('');
    }

    return {
      content: [{
        type: 'text' as const,
        text: lines.join('\n')
      }]
    };
  } else {
    // Auto mode: Use top result as timeline anchor
    const topResult = results[0];
    logger.debug('SEARCH', 'Auto mode: Using observation as timeline anchor', { observationId: topResult.id });

    const timelineData = deps.sessionStore.getTimelineAroundObservation(
      topResult.id,
      topResult.created_at_epoch,
      depth_before,
      depth_after,
      project
    );

    // Use 'as any' on session data — same runtime type mismatch as context-timeline
    const items: TimelineItem[] = [
      ...(timelineData.observations || []).map((obs: any) => ({ type: 'observation' as const, data: obs, epoch: obs.created_at_epoch })),
      ...((timelineData.sessions || []) as any[]).map((sess: any) => ({ type: 'session' as const, data: sess, epoch: sess.created_at_epoch })),
      ...(timelineData.prompts || []).map((prompt: any) => ({ type: 'prompt' as const, data: prompt, epoch: prompt.created_at_epoch }))
    ];
    items.sort((a, b) => a.epoch - b.epoch);
    const filteredItems = deps.timelineService.filterByDepth(items, topResult.id, 0, depth_before, depth_after);

    if (!filteredItems || filteredItems.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `Found observation #${topResult.id} matching "${query}", but no timeline context available (${depth_before} records before, ${depth_after} records after).`
        }]
      };
    }

    const lines: string[] = [];

    lines.push(`# Timeline for query: "${query}"`);
    lines.push(`**Anchor:** Observation #${topResult.id} - ${topResult.title || 'Untitled'}`);
    lines.push(`**Window:** ${depth_before} records before -> ${depth_after} records after | **Items:** ${filteredItems?.length ?? 0}`);
    lines.push('');

    const dayMap = new Map<string, TimelineItem[]>();
    for (const item of filteredItems) {
      const day = formatDate(item.epoch);
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(item);
    }

    const sortedDays = Array.from(dayMap.entries()).sort((a, b) => {
      const aDate = new Date(a[0]).getTime();
      const bDate = new Date(b[0]).getTime();
      return aDate - bDate;
    });

    for (const [day, dayItems] of sortedDays) {
      lines.push(`### ${day}`);
      lines.push('');

      let currentFile: string | null = null;
      let lastTime = '';
      let tableOpen = false;

      for (const item of dayItems) {
        const isAnchor = (item.type === 'observation' && item.data.id === topResult.id);

        if (item.type === 'session') {
          if (tableOpen) {
            lines.push('');
            tableOpen = false;
            currentFile = null;
            lastTime = '';
          }

          const sess = item.data as SessionSummarySearchResult;
          const title = sess.request || 'Session summary';

          lines.push(`**\uD83C\uDFAF #S${sess.id}** ${title} (${formatDateTime(item.epoch)})`);
          lines.push('');
        } else if (item.type === 'prompt') {
          if (tableOpen) {
            lines.push('');
            tableOpen = false;
            currentFile = null;
            lastTime = '';
          }

          const prompt = item.data as UserPromptSearchResult;
          const truncated = prompt.prompt_text.length > 100 ? prompt.prompt_text.substring(0, 100) + '...' : prompt.prompt_text;

          lines.push(`**\uD83D\uDCAC User Prompt #${prompt.prompt_number}** (${formatDateTime(item.epoch)})`);
          lines.push(`> ${truncated}`);
          lines.push('');
        } else if (item.type === 'observation') {
          const obs = item.data as ObservationSearchResult;
          const file = extractFirstFile(obs.files_modified, cwd, obs.files_read);

          if (file !== currentFile) {
            if (tableOpen) {
              lines.push('');
            }

            lines.push(`**${file}**`);
            lines.push(`| ID | Time | T | Title | Tokens |`);
            lines.push(`|----|------|---|-------|--------|`);

            currentFile = file;
            tableOpen = true;
            lastTime = '';
          }

          const icon = ModeManager.getInstance().getTypeIcon(obs.type);

          const time = formatTime(item.epoch);
          const title = obs.title || 'Untitled';
          const tokens = estimateTokens(obs.narrative);

          const showTime = time !== lastTime;
          const timeDisplay = showTime ? time : '"';
          lastTime = time;

          const anchorMarker = isAnchor ? ' <- **ANCHOR**' : '';
          lines.push(`| #${obs.id} | ${timeDisplay} | ${icon} | ${title}${anchorMarker} | ~${tokens} |`);
        }
      }

      if (tableOpen) {
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
}
