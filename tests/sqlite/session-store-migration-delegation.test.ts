/**
 * Tests that SessionStore delegates migration work to MigrationRunner
 * rather than executing migrations directly.
 *
 * RED: SessionStore currently calls 15 private migration methods directly.
 * GREEN: SessionStore will delegate to MigrationRunner.runAllMigrations().
 */

import { describe, it, expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { MigrationRunner } from '../../src/services/sqlite/migrations/runner.js';

describe('SessionStore migration delegation', () => {
  it('should delegate migrations to MigrationRunner.runAllMigrations', () => {
    // Spy MUST be installed BEFORE constructing SessionStore
    // (adversarial finding: spy after construction passes vacuously)
    const spy = spyOn(MigrationRunner.prototype, 'runAllMigrations');

    const store = new SessionStore(':memory:');

    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
    store.close();
  });

  it('should produce correct schema state after construction', () => {
    // Behavioral regression test: all expected tables exist after migrations
    const store = new SessionStore(':memory:');
    const db = store.db;

    const tables = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);

    // Core tables created by migrations
    expect(tableNames).toContain('sdk_sessions');
    expect(tableNames).toContain('observations');
    expect(tableNames).toContain('session_summaries');
    expect(tableNames).toContain('user_prompts');
    expect(tableNames).toContain('pending_messages');
    expect(tableNames).toContain('schema_versions');

    // Verify key columns added by individual migrations
    const sessionsInfo = db.query('PRAGMA table_info(sdk_sessions)').all() as { name: string }[];
    const sessionCols = sessionsInfo.map(c => c.name);
    expect(sessionCols).toContain('worker_port');        // ensureWorkerPortColumn
    expect(sessionCols).toContain('prompt_counter');     // ensurePromptTrackingColumns
    expect(sessionCols).toContain('content_session_id'); // renameSessionIdColumns
    expect(sessionCols).toContain('memory_session_id');  // renameSessionIdColumns
    expect(sessionCols).toContain('custom_title');       // addSessionCustomTitleColumn

    const obsInfo = db.query('PRAGMA table_info(observations)').all() as { name: string }[];
    const obsCols = obsInfo.map(c => c.name);
    expect(obsCols).toContain('title');                  // addObservationHierarchicalFields
    expect(obsCols).toContain('subtitle');               // addObservationHierarchicalFields
    expect(obsCols).toContain('discovery_tokens');       // ensureDiscoveryTokensColumn
    expect(obsCols).toContain('content_hash');           // addObservationContentHashColumn

    // failed_at_epoch is on pending_messages, not sdk_sessions
    const pendingInfo = db.query('PRAGMA table_info(pending_messages)').all() as { name: string }[];
    const pendingCols = pendingInfo.map(c => c.name);
    expect(pendingCols).toContain('failed_at_epoch');   // addFailedAtEpochColumn

    store.close();
  });

  describe('adversarial: migration idempotency under delegation', () => {
    it('second construction on same DB file should not error (the "second run" test)', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'cmem-test-'));
      const dbPath = join(tmpDir, 'test.db');

      // First construction — runs all migrations
      const store1 = new SessionStore(dbPath);
      store1.close();

      // Second construction — migrations must be idempotent
      const store2 = new SessionStore(dbPath);

      // Verify schema is still correct after second run
      const tables = store2.db.query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as { name: string }[];
      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('sdk_sessions');
      expect(tableNames).toContain('observations');
      expect(tableNames).toContain('schema_versions');

      store2.close();
      rmSync(tmpDir, { recursive: true });
    });

    it('migration version records should be preserved across constructions', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'cmem-test-'));
      const dbPath = join(tmpDir, 'test.db');

      const store1 = new SessionStore(dbPath);
      const versions1 = store1.db.query(
        'SELECT version FROM schema_versions ORDER BY version'
      ).all() as { version: number }[];
      store1.close();

      const store2 = new SessionStore(dbPath);
      const versions2 = store2.db.query(
        'SELECT version FROM schema_versions ORDER BY version'
      ).all() as { version: number }[];
      store2.close();

      // Same versions recorded — no duplicates, no missing
      expect(versions2).toEqual(versions1);
      expect(versions1.length).toBeGreaterThan(0);

      rmSync(tmpDir, { recursive: true });
    });
  });
});
