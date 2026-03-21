import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { logger } from '../../../src/utils/logger.js';

// Mock modules that cause import chain issues - MUST be before imports
mock.module('../../../src/services/worker-service.js', () => ({
  updateCursorContextForProject: () => Promise.resolve(),
}));

mock.module('../../../src/shared/worker-utils.js', () => ({
  getWorkerPort: () => 37777,
}));

// Mock ModeManager
const mockMode = {
  name: 'code',
  description: 'Test mode',
  version: '1.0',
  prompts: {
    system_identity: 'Test identity',
    continuation_greeting: 'Hello, continuing session',
    continuation_instruction: 'Continue generating observations',
    observer_role: 'Observer role text',
    spatial_awareness: '',
    recording_focus: '',
    skip_guidance: '',
    output_format_header: '',
    type_guidance: '',
    field_guidance: '',
    xml_title_placeholder: '',
    xml_subtitle_placeholder: '',
    xml_fact_placeholder: '',
    xml_narrative_placeholder: '',
    xml_concept_placeholder: '',
    xml_files_read_placeholder: '',
    xml_files_modified_placeholder: '',
    output_format_footer: '',
    summary_instruction: 'Write summary',
    summary_context_label: 'Context:',
    summary_format_instruction: 'Use XML',
    summary_footer: 'End summary',
    header_memory_start: '',
    header_memory_continued: '',
    header_summary_checkpoint: '',
    xml_summary_request_placeholder: '',
    xml_summary_investigated_placeholder: '',
    xml_summary_learned_placeholder: '',
    xml_summary_completed_placeholder: '',
    xml_summary_next_steps_placeholder: '',
    xml_summary_notes_placeholder: '',
  },
  observation_types: [{ id: 'discovery', label: 'Discovery', description: '', emoji: '', work_emoji: '' }],
  observation_concepts: [],
};

mock.module('../../../src/services/domain/ModeManager.js', () => ({
  ModeManager: {
    getInstance: () => ({
      getActiveMode: () => mockMode,
    }),
  },
}));

// Import after mocks
import { BaseAgent } from '../../../src/services/worker/BaseAgent.js';
import type { WorkerRef } from '../../../src/services/worker/agents/types.js';
import type { ActiveSession, PendingMessageWithId } from '../../../src/services/worker-types.js';
import type { DatabaseManager } from '../../../src/services/worker/DatabaseManager.js';
import type { SessionManager } from '../../../src/services/worker/SessionManager.js';
import type { ModeConfig } from '../../../src/services/domain/types.js';

const typedMockMode = mockMode as unknown as ModeConfig;

// Suppress logger output during tests
let loggerSpies: ReturnType<typeof spyOn>[] = [];

// Concrete test subclass — minimal provider implementation
class TestAgent extends BaseAgent {
  async startSession(session: ActiveSession, worker?: WorkerRef): Promise<void> {
    // Minimal provider-specific implementation for testing
  }
}

function createMockSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    sessionDbId: 1,
    contentSessionId: 'test-session-123',
    memorySessionId: 'memory-session-456',
    project: '/test/project',
    userPrompt: 'test user prompt',
    pendingMessages: [],
    abortController: new AbortController(),
    generatorPromise: null,
    lastPromptNumber: 1,
    startTime: Date.now(),
    cumulativeInputTokens: 0,
    cumulativeOutputTokens: 0,
    earliestPendingTimestamp: null,
    conversationHistory: [],
    currentProvider: null,
    consecutiveRestarts: 0,
    lastGeneratorActivity: Date.now(),
    processingMessageIds: [],
    ...overrides,
  };
}

function createMockDbManager(): DatabaseManager {
  return {
    getSessionStore: () => ({
      storeObservations: mock(() => ({
        observationIds: [1],
        summaryId: null,
        createdAtEpoch: Date.now(),
      })),
      ensureMemorySessionIdRegistered: mock(() => {}),
      getSessionById: mock(() => ({ memory_session_id: 'memory-session-456' })),
    }),
    getChromaSync: () => ({
      syncObservation: mock(() => Promise.resolve()),
      syncSummary: mock(() => Promise.resolve()),
    }),
  } as unknown as DatabaseManager;
}

function createMockSessionManager(): SessionManager {
  return {
    getMessageIterator: async function* () {
      yield* [];
    },
    getPendingMessageStore: () => ({
      markProcessed: mock(() => {}),
      confirmProcessed: mock(() => {}),
      cleanupProcessed: mock(() => 0),
      resetStuckMessages: mock(() => 0),
    }),
  } as unknown as SessionManager;
}

describe('BaseAgent', () => {
  beforeEach(() => {
    loggerSpies = [
      spyOn(logger, 'info').mockImplementation(() => {}),
      spyOn(logger, 'debug').mockImplementation(() => {}),
      spyOn(logger, 'warn').mockImplementation(() => {}),
      spyOn(logger, 'error').mockImplementation(() => {}),
      spyOn(logger, 'success').mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    loggerSpies.forEach(spy => spy.mockRestore());
    mock.restore();
  });

  describe('construction', () => {
    it('can be constructed with dbManager and sessionManager', () => {
      const dbManager = createMockDbManager();
      const sessionManager = createMockSessionManager();
      const agent = new TestAgent(dbManager, sessionManager);
      expect(agent).toBeInstanceOf(BaseAgent);
    });
  });

  describe('buildSessionPrompt', () => {
    it('returns init prompt when lastPromptNumber is 1', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const session = createMockSession({ lastPromptNumber: 1 });

      const prompt = agent.buildSessionPrompt(session, typedMockMode);

      // Init prompt includes system identity and init instructions
      expect(prompt).toContain('Test identity');
    });

    it('returns continuation prompt when lastPromptNumber > 1', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const session = createMockSession({ lastPromptNumber: 3 });

      const prompt = agent.buildSessionPrompt(session, typedMockMode);

      // Continuation prompt starts with continuation_greeting, not system_identity
      expect(prompt).toContain('Hello, continuing session');
      expect(prompt).toContain('Continue generating observations');
    });

    it('passes session project and contentSessionId for init prompts', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const session = createMockSession({
        lastPromptNumber: 1,
        project: '/my/special/project',
        userPrompt: 'analyze this code',
      });

      const prompt = agent.buildSessionPrompt(session, typedMockMode);

      // Init prompt includes user prompt
      expect(prompt).toContain('analyze this code');
    });
  });

  describe('buildObsPrompt', () => {
    it('builds observation prompt from PendingMessage with tool data', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const message: PendingMessageWithId = {
        type: 'observation',
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        tool_response: 'file contents here',
        prompt_number: 2,
        cwd: '/test',
        _persistentId: 42,
        _originalTimestamp: 1700000000000,
      };

      const prompt = agent.buildObsPrompt(message);

      // Observation prompt includes tool name and serialized data
      expect(prompt).toContain('Read');
      expect(prompt).toContain('file_path');
    });

    it('uses provided originalTimestamp when available', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const message: PendingMessageWithId = {
        type: 'observation',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
        tool_response: 'output',
        _persistentId: 43,
        _originalTimestamp: 1700000000000,
      };

      // Should not throw — the timestamp parameter is accepted
      const prompt = agent.buildObsPrompt(message, 1700000000000);
      expect(prompt).toContain('Bash');
    });
  });

  describe('buildSumPrompt', () => {
    it('builds summary prompt from session and message data', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const session = createMockSession({
        sessionDbId: 5,
        memorySessionId: 'mem-123',
        project: '/test/project',
        userPrompt: 'refactor the auth module',
      });
      const message: PendingMessageWithId = {
        type: 'summarize',
        last_assistant_message: 'I completed the refactoring.',
        _persistentId: 44,
        _originalTimestamp: 1700000000000,
      };

      const prompt = agent.buildSumPrompt(session, message, typedMockMode);

      // Summary prompt includes the last assistant message and summary mode switch header
      expect(prompt).toContain('I completed the refactoring.');
      expect(prompt).toContain('PROGRESS SUMMARY');
    });

    it('handles empty last_assistant_message', () => {
      const agent = new TestAgent(createMockDbManager(), createMockSessionManager());
      const session = createMockSession();
      const message: PendingMessageWithId = {
        type: 'summarize',
        _persistentId: 45,
        _originalTimestamp: 1700000000000,
      };

      // Should not throw — empty message handled with || ''
      const prompt = agent.buildSumPrompt(session, message, typedMockMode);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });
});
