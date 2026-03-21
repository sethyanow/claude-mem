import { describe, it, expect, mock } from 'bun:test';

// Mock modules that cause import chain issues
mock.module('../../../src/services/worker-service.js', () => ({
  updateCursorContextForProject: () => Promise.resolve(),
}));

mock.module('../../../src/shared/worker-utils.js', () => ({
  getWorkerPort: () => 37777,
}));

mock.module('../../../src/services/domain/ModeManager.js', () => ({
  ModeManager: {
    getInstance: () => ({
      getActiveMode: () => ({
        name: 'code',
        prompts: { init: '', observation: '', summary: '' },
        observation_types: [],
        observation_concepts: [],
      }),
    }),
  },
}));

// Import after mocks
import { BaseAgent } from '../../../src/services/worker/agents/BaseAgent.js';
import type { ActiveSession } from '../../../src/services/worker-types.js';
import type { WorkerRef } from '../../../src/services/worker/agents/types.js';
import type { DatabaseManager } from '../../../src/services/worker/DatabaseManager.js';
import type { SessionManager } from '../../../src/services/worker/SessionManager.js';

// Concrete test subclass with minimal startSession stub
class TestAgent extends BaseAgent {
  async startSession(_session: ActiveSession, _worker?: WorkerRef): Promise<void> {
    // Stub — no-op for testing BaseAgent constructor
  }
}

describe('BaseAgent', () => {
  const mockDbManager = { storeObservation: () => {} } as unknown as DatabaseManager;
  const mockSessionManager = { getSession: () => null } as unknown as SessionManager;

  describe('constructor', () => {
    it('stores dbManager and sessionManager as properties', () => {
      const agent = new TestAgent(mockDbManager, mockSessionManager);

      // Access via the concrete subclass — protected properties should be
      // accessible to subclasses. We verify via the TestAgent instance.
      expect(agent).toBeDefined();
      expect(agent instanceof BaseAgent).toBe(true);
    });

    it('allows subclass to access dbManager via protected property', () => {
      // Extend TestAgent to expose protected properties for testing
      class ExposingAgent extends BaseAgent {
        async startSession(_session: ActiveSession, _worker?: WorkerRef): Promise<void> {}
        getDbManager() { return this.dbManager; }
        getSessionManager() { return this.sessionManager; }
      }

      const agent = new ExposingAgent(mockDbManager, mockSessionManager);
      expect(agent.getDbManager()).toBe(mockDbManager);
      expect(agent.getSessionManager()).toBe(mockSessionManager);
    });
  });

  describe('adversarial: constructor edge cases', () => {
    it('survives same object passed as both dbManager and sessionManager', () => {
      // Self-referential: same reference for both params
      const dual = {} as unknown as DatabaseManager & SessionManager;

      class ExposingAgent extends BaseAgent {
        async startSession(_session: ActiveSession, _worker?: WorkerRef): Promise<void> {}
        getDbManager() { return this.dbManager; }
        getSessionManager() { return this.sessionManager; }
      }

      const agent = new ExposingAgent(dual, dual as unknown as SessionManager);
      expect(agent.getDbManager()).toBe(dual);
      expect(agent.getSessionManager()).toBe(dual);
    });

    it('stores references, not copies — mutations visible through agent', () => {
      // State transition: mutate after construction
      const mutableDb = { marker: 'original' } as unknown as DatabaseManager;

      class ExposingAgent extends BaseAgent {
        async startSession(_session: ActiveSession, _worker?: WorkerRef): Promise<void> {}
        getDbManager() { return this.dbManager; }
      }

      const agent = new ExposingAgent(mutableDb, mockSessionManager);
      (mutableDb as any).marker = 'mutated';
      expect((agent.getDbManager() as any).marker).toBe('mutated');
    });

    it('accepts minimally-shaped objects with no useful methods', () => {
      // Semantically hostile: valid types, no real behavior
      const emptyDb = {} as unknown as DatabaseManager;
      const emptySm = {} as unknown as SessionManager;

      const agent = new TestAgent(emptyDb, emptySm);
      expect(agent).toBeDefined();
      expect(agent instanceof BaseAgent).toBe(true);
    });
  });

  describe('startSession', () => {
    it('is callable on concrete subclass with correct signature', async () => {
      const agent = new TestAgent(mockDbManager, mockSessionManager);
      const mockSession = { id: 'test-session' } as unknown as ActiveSession;

      // Should not throw — startSession is a valid method on the concrete subclass
      await expect(agent.startSession(mockSession)).resolves.toBeUndefined();
    });

    it('accepts optional WorkerRef parameter', async () => {
      const agent = new TestAgent(mockDbManager, mockSessionManager);
      const mockSession = { id: 'test-session' } as unknown as ActiveSession;
      const mockWorker: WorkerRef = {};

      await expect(agent.startSession(mockSession, mockWorker)).resolves.toBeUndefined();
    });
  });
});
