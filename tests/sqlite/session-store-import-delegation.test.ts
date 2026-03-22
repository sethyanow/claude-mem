/**
 * Tests that SessionStore delegates import methods to modular functions
 * in import/bulk.ts rather than executing SQL directly.
 *
 * RED: SessionStore import methods currently contain inline SQL.
 * GREEN: SessionStore import methods become thin wrappers delegating to import/bulk.ts.
 */

import { describe, it, expect } from 'bun:test';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';

describe('SessionStore import delegation', () => {
  /**
   * Structural delegation tests — verify method bodies delegate
   * rather than containing inline SQL. Uses Function.prototype.toString()
   * because ESM module spying can't intercept aliased named imports.
   */
  describe('delegation structure', () => {
    it('importSdkSession should delegate (no inline SQL)', () => {
      const store = new SessionStore(':memory:');
      const source = store.importSdkSession.toString();
      expect(source).not.toContain('INSERT INTO');
      expect(source).not.toContain('SELECT id FROM');
      store.close();
    });

    it('importSessionSummary should delegate (no inline SQL)', () => {
      const store = new SessionStore(':memory:');
      const source = store.importSessionSummary.toString();
      expect(source).not.toContain('INSERT INTO');
      expect(source).not.toContain('SELECT id FROM');
      store.close();
    });

    it('importObservation should delegate (no inline SQL)', () => {
      const store = new SessionStore(':memory:');
      const source = store.importObservation.toString();
      expect(source).not.toContain('INSERT INTO');
      expect(source).not.toContain('SELECT id FROM');
      store.close();
    });

    it('importUserPrompt should delegate (no inline SQL)', () => {
      const store = new SessionStore(':memory:');
      const source = store.importUserPrompt.toString();
      expect(source).not.toContain('INSERT INTO');
      expect(source).not.toContain('SELECT id FROM');
      store.close();
    });
  });

  /**
   * Behavioral regression tests — verify import + dedup behavior
   * is preserved after delegation. These pass both before and after
   * (logic is identical), serving as a safety net.
   */
  describe('behavioral regression', () => {
    it('importSdkSession should insert new session and skip duplicate', () => {
      const store = new SessionStore(':memory:');

      const session = {
        content_session_id: 'test-session-1',
        memory_session_id: 'mem-1',
        project: '/test/project',
        user_prompt: 'test prompt',
        started_at: '2024-01-01T00:00:00Z',
        started_at_epoch: 1704067200,
        completed_at: null,
        completed_at_epoch: null,
        status: 'active',
      };

      const first = store.importSdkSession(session);
      expect(first.imported).toBe(true);
      expect(first.id).toBeGreaterThan(0);

      const second = store.importSdkSession(session);
      expect(second.imported).toBe(false);
      expect(second.id).toBe(first.id);

      store.close();
    });

    it('importObservation should insert new observation and skip duplicate', () => {
      const store = new SessionStore(':memory:');

      // Need a session first for the foreign key
      store.importSdkSession({
        content_session_id: 'test-session-obs',
        memory_session_id: 'mem-obs',
        project: '/test/project',
        user_prompt: 'test',
        started_at: '2024-01-01T00:00:00Z',
        started_at_epoch: 1704067200,
        completed_at: null,
        completed_at_epoch: null,
        status: 'active',
      });

      const obs = {
        memory_session_id: 'mem-obs',
        project: '/test/project',
        text: 'test observation text',
        type: 'tool_use',
        title: 'Test Title',
        subtitle: 'Test Subtitle',
        facts: null,
        narrative: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        prompt_number: 1,
        discovery_tokens: 100,
        created_at: '2024-01-01T00:00:00Z',
        created_at_epoch: 1704067200,
      };

      const first = store.importObservation(obs);
      expect(first.imported).toBe(true);
      expect(first.id).toBeGreaterThan(0);

      const second = store.importObservation(obs);
      expect(second.imported).toBe(false);
      expect(second.id).toBe(first.id);

      store.close();
    });

    it('importUserPrompt should insert new prompt and skip duplicate', () => {
      const store = new SessionStore(':memory:');

      // Need a session first for the foreign key
      store.importSdkSession({
        content_session_id: 'test-session-prompt',
        memory_session_id: 'mem-prompt',
        project: '/test/project',
        user_prompt: 'test',
        started_at: '2024-01-01T00:00:00Z',
        started_at_epoch: 1704067200,
        completed_at: null,
        completed_at_epoch: null,
        status: 'active',
      });

      const prompt = {
        content_session_id: 'test-session-prompt',
        prompt_number: 1,
        prompt_text: 'Hello world',
        created_at: '2024-01-01T00:00:00Z',
        created_at_epoch: 1704067200,
      };

      const first = store.importUserPrompt(prompt);
      expect(first.imported).toBe(true);
      expect(first.id).toBeGreaterThan(0);

      const second = store.importUserPrompt(prompt);
      expect(second.imported).toBe(false);
      expect(second.id).toBe(first.id);

      store.close();
    });
  });
});
