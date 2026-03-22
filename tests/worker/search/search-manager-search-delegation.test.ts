/**
 * Tests that SearchManager search methods delegate to shared execution
 * functions rather than containing inline Chroma/DB/format logic.
 *
 * RED: SearchManager methods currently contain inline search logic.
 * GREEN: Methods become thin wrappers delegating to shared functions.
 *
 * Uses Function.prototype.toString() because ESM module spying can't
 * intercept aliased named imports in Bun (same approach as SessionStore
 * delegation tests in clmem-h4d).
 */

import { describe, it, expect } from 'bun:test';
import { SearchManager } from '../../../src/services/worker/SearchManager.js';

// Structural markers that indicate inline search logic.
// After delegation, these should only exist in the shared execution
// function, not in the method bodies themselves.
const INLINE_MARKERS = {
  // Recency filter variable — created only when doing inline 90-day filtering
  recencyFilter: 'ninetyDaysAgo',
  // Ranking loop variable — created only when doing inline Chroma ranking
  rankingVar: 'rankedIds',
  // Inline formatting call — should be in shared function, not method body
  formatHeader: 'formatTableHeader',
};

describe('SearchManager search method delegation', () => {
  describe('Pattern A — query-first methods', () => {
    it('searchObservations should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.searchObservations.toString();
      expect(source).not.toContain(INLINE_MARKERS.recencyFilter);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });

    it('searchSessions should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.searchSessions.toString();
      expect(source).not.toContain(INLINE_MARKERS.recencyFilter);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });

    it('searchUserPrompts should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.searchUserPrompts.toString();
      expect(source).not.toContain(INLINE_MARKERS.recencyFilter);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });
  });

  describe('Pattern B — metadata-first methods', () => {
    it('decisions should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.decisions.toString();
      expect(source).not.toContain(INLINE_MARKERS.rankingVar);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });

    it('changes should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.changes.toString();
      expect(source).not.toContain(INLINE_MARKERS.rankingVar);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });

    it('howItWorks should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.howItWorks.toString();
      expect(source).not.toContain(INLINE_MARKERS.rankingVar);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });

    it('findByConcept should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.findByConcept.toString();
      expect(source).not.toContain(INLINE_MARKERS.rankingVar);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });

    it('findByType should delegate (no inline search logic)', () => {
      const source = SearchManager.prototype.findByType.toString();
      expect(source).not.toContain(INLINE_MARKERS.rankingVar);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
    });
  });

  describe('Pattern C — complex methods (extracted to dedicated modules)', () => {
    it('findByFile should delegate (no inline search/format logic)', () => {
      const source = SearchManager.prototype.findByFile.toString();
      expect(source).not.toContain(INLINE_MARKERS.rankingVar);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
      // groupByDate is inline date grouping — should be in extracted module
      expect(source).not.toContain('groupByDate');
    });

    it('search should delegate (no inline chroma/format/date logic)', () => {
      const source = SearchManager.prototype.search.toString();
      expect(source).not.toContain(INLINE_MARKERS.recencyFilter);
      expect(source).not.toContain(INLINE_MARKERS.formatHeader);
      // groupByDate is inline date grouping — should be in extracted module
      expect(source).not.toContain('groupByDate');
    });

    it('timeline should delegate (no inline timeline rendering logic)', () => {
      const source = SearchManager.prototype.timeline.toString();
      expect(source).not.toContain(INLINE_MARKERS.recencyFilter);
      // dayMap is inline day grouping — should be in extracted module
      expect(source).not.toContain('dayMap');
      // ModeManager icon selection — should be in extracted module
      expect(source).not.toContain('ModeManager');
    });

    it('getContextTimeline should delegate (no inline timeline rendering logic)', () => {
      const source = SearchManager.prototype.getContextTimeline.toString();
      // dayMap is inline day grouping — should be in extracted module
      expect(source).not.toContain('dayMap');
      // ModeManager icon selection — should be in extracted module
      expect(source).not.toContain('ModeManager');
    });

    it('getTimelineByQuery should delegate (no inline timeline rendering logic)', () => {
      const source = SearchManager.prototype.getTimelineByQuery.toString();
      expect(source).not.toContain(INLINE_MARKERS.recencyFilter);
      // dayMap is inline day grouping — should be in extracted module
      expect(source).not.toContain('dayMap');
      // ModeManager icon selection — should be in extracted module
      expect(source).not.toContain('ModeManager');
    });
  });
});
