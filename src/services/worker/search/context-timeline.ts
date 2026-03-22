/**
 * context-timeline — Extracted from SearchManager.getContextTimeline()
 *
 * Context timeline around an observation with day grouping.
 * Renders a timeline view around an anchor point (observation ID,
 * session ID, or ISO timestamp).
 */

import { logger } from '../../../utils/logger.js';
import { formatDate, formatTime, formatDateTime, extractFirstFile, estimateTokens } from '../../../shared/timeline-formatting.js';
import type { ObservationSearchResult, SessionSummarySearchResult, UserPromptSearchResult } from '../../sqlite/types.js';
import type { TimelineItem } from '../TimelineService.js';
import type { TimelineService } from '../TimelineService.js';
import type { SessionStore } from '../../sqlite/SessionStore.js';
import { ModeManager } from '../../domain/ModeManager.js';

export interface ContextTimelineDeps {
  sessionStore: SessionStore;
  timelineService: TimelineService;
}

export async function contextTimeline(deps: ContextTimelineDeps, args: any): Promise<any> {
  const { anchor, depth_before = 10, depth_after = 10, project } = args;
  const cwd = process.cwd();
  let anchorEpoch: number;
  let anchorId: string | number = anchor;

  // Resolve anchor and get timeline data
  let timelineData;
  if (typeof anchor === 'number') {
    const obs = deps.sessionStore.getObservationById(anchor);
    if (!obs) {
      return {
        content: [{
          type: 'text' as const,
          text: `Observation #${anchor} not found`
        }],
        isError: true
      };
    }
    anchorEpoch = obs.created_at_epoch;
    timelineData = deps.sessionStore.getTimelineAroundObservation(anchor, anchorEpoch, depth_before, depth_after, project);
  } else if (typeof anchor === 'string') {
    if (anchor.startsWith('S') || anchor.startsWith('#S')) {
      const sessionId = anchor.replace(/^#?S/, '');
      const sessionNum = parseInt(sessionId, 10);
      const sessions = deps.sessionStore.getSessionSummariesByIds([sessionNum]);
      if (sessions.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `Session #${sessionNum} not found`
          }],
          isError: true
        };
      }
      anchorEpoch = sessions[0].created_at_epoch;
      anchorId = `S${sessionNum}`;
      timelineData = deps.sessionStore.getTimelineAroundTimestamp(anchorEpoch, depth_before, depth_after, project);
    } else {
      const date = new Date(anchor);
      if (isNaN(date.getTime())) {
        return {
          content: [{
            type: 'text' as const,
            text: `Invalid timestamp: ${anchor}`
          }],
          isError: true
        };
      }
      anchorEpoch = date.getTime();
      timelineData = deps.sessionStore.getTimelineAroundTimestamp(anchorEpoch, depth_before, depth_after, project);
    }
  } else {
    return {
      content: [{
        type: 'text' as const,
        text: 'Invalid anchor: must be observation ID (number), session ID (e.g., "S123"), or ISO timestamp'
      }],
      isError: true
    };
  }

  // Combine, sort, and filter timeline items
  // Use 'as any' on session data to match runtime shape — the store query returns
  // basic session fields, not full SessionSummarySearchResult. This matches the
  // pre-extraction behavior (the TS error existed before extraction).
  const items: TimelineItem[] = [
    ...timelineData.observations.map((obs: any) => ({ type: 'observation' as const, data: obs, epoch: obs.created_at_epoch })),
    ...(timelineData.sessions as any[]).map((sess: any) => ({ type: 'session' as const, data: sess, epoch: sess.created_at_epoch })),
    ...timelineData.prompts.map((prompt: any) => ({ type: 'prompt' as const, data: prompt, epoch: prompt.created_at_epoch }))
  ];
  items.sort((a, b) => a.epoch - b.epoch);
  const filteredItems = deps.timelineService.filterByDepth(items, anchorId, anchorEpoch, depth_before, depth_after);

  if (!filteredItems || filteredItems.length === 0) {
    const anchorDate = new Date(anchorEpoch).toLocaleString();
    return {
      content: [{
        type: 'text' as const,
        text: `No context found around ${anchorDate} (${depth_before} records before, ${depth_after} records after)`
      }]
    };
  }

  // Format results
  const lines: string[] = [];

  lines.push(`# Timeline around anchor: ${anchorId}`);
  lines.push(`**Window:** ${depth_before} records before -> ${depth_after} records after | **Items:** ${filteredItems?.length ?? 0}`);
  lines.push('');

  // Group by day
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
      const isAnchor = (
        (typeof anchorId === 'number' && item.type === 'observation' && item.data.id === anchorId) ||
        (typeof anchorId === 'string' && anchorId.startsWith('S') && item.type === 'session' && `S${item.data.id}` === anchorId)
      );

      if (item.type === 'session') {
        if (tableOpen) {
          lines.push('');
          tableOpen = false;
          currentFile = null;
          lastTime = '';
        }

        const sess = item.data as SessionSummarySearchResult;
        const title = sess.request || 'Session summary';
        const marker = isAnchor ? ' <- **ANCHOR**' : '';

        lines.push(`**\uD83C\uDFAF #S${sess.id}** ${title} (${formatDateTime(item.epoch)})${marker}`);
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
