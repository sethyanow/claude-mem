import { describe, it, expect, mock } from 'bun:test';

// Mock modules that cause import chain issues — same pattern as base-agent.test.ts.
// NOTE: Do NOT mock worker-service.js here — it causes mock bleed that breaks
// worker-json-status.test.ts (which needs the real buildStatusOutput export).
// SessionOrchestrator does not import worker-service.ts, so no mock needed.

mock.module('../../src/shared/worker-utils.js', () => ({
  getWorkerPort: () => 37777,
}));

mock.module('../../src/services/domain/ModeManager.js', () => ({
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

// Mock provider selection functions — controllable per test
let mockIsOpenRouterSelected = false;
let mockIsOpenRouterAvailable = false;
let mockIsGeminiSelected = false;
let mockIsGeminiAvailable = false;

mock.module('../../src/services/worker/OpenRouterAgent.js', () => ({
  OpenRouterAgent: class {},
  isOpenRouterSelected: () => mockIsOpenRouterSelected,
  isOpenRouterAvailable: () => mockIsOpenRouterAvailable,
}));

mock.module('../../src/services/worker/GeminiAgent.js', () => ({
  GeminiAgent: class {},
  isGeminiSelected: () => mockIsGeminiSelected,
  isGeminiAvailable: () => mockIsGeminiAvailable,
}));

// Import after mocks
import { SessionOrchestrator } from '../../src/services/worker/SessionOrchestrator.js';
import type { WorkerRef } from '../../src/services/worker/agents/types.js';
import type { DatabaseManager } from '../../src/services/worker/DatabaseManager.js';
import type { SessionManager } from '../../src/services/worker/SessionManager.js';
import type { SSEBroadcaster } from '../../src/services/worker/SSEBroadcaster.js';
import type { SDKAgent } from '../../src/services/worker/SDKAgent.js';
import type { GeminiAgent } from '../../src/services/worker/GeminiAgent.js';
import type { OpenRouterAgent } from '../../src/services/worker/OpenRouterAgent.js';
import type { SessionEventBroadcaster } from '../../src/services/worker/events/SessionEventBroadcaster.js';

describe('SessionOrchestrator', () => {
  const mockDbManager = {} as unknown as DatabaseManager;
  const mockSessionManager = {} as unknown as SessionManager;
  const mockSseBroadcaster = {} as unknown as SSEBroadcaster;
  const mockSdkAgent = {} as unknown as SDKAgent;
  const mockGeminiAgent = {} as unknown as GeminiAgent;
  const mockOpenRouterAgent = {} as unknown as OpenRouterAgent;
  const mockSessionEventBroadcaster = {} as unknown as SessionEventBroadcaster;
  const mockBroadcastProcessingStatus = () => {};
  const mockWorkerRef: WorkerRef = {
    sseBroadcaster: { broadcast: () => {} },
    broadcastProcessingStatus: () => {},
  };

  function createOrchestrator() {
    return new SessionOrchestrator({
      sdkAgent: mockSdkAgent,
      geminiAgent: mockGeminiAgent,
      openRouterAgent: mockOpenRouterAgent,
      sessionManager: mockSessionManager,
      dbManager: mockDbManager,
      sseBroadcaster: mockSseBroadcaster,
      sessionEventBroadcaster: mockSessionEventBroadcaster,
      broadcastProcessingStatus: mockBroadcastProcessingStatus,
      workerRef: mockWorkerRef,
    });
  }

  describe('constructor', () => {
    it('accepts all required dependencies', () => {
      const orchestrator = createOrchestrator();

      expect(orchestrator).toBeDefined();
      expect(orchestrator instanceof SessionOrchestrator).toBe(true);
    });
  });

  describe('isSessionTerminatedError', () => {
    it('returns true for process aborted errors', () => {
      const orchestrator = createOrchestrator();
      expect(orchestrator.isSessionTerminatedError(new Error('process aborted by user'))).toBe(true);
    });

    it('returns true for ProcessTransport errors', () => {
      const orchestrator = createOrchestrator();
      expect(orchestrator.isSessionTerminatedError(new Error('ProcessTransport connection lost'))).toBe(true);
    });

    it('returns true for not ready for writing errors', () => {
      const orchestrator = createOrchestrator();
      expect(orchestrator.isSessionTerminatedError(new Error('Socket not ready for writing'))).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      const orchestrator = createOrchestrator();
      expect(orchestrator.isSessionTerminatedError(new Error('Invalid API key'))).toBe(false);
    });

    it('handles non-Error objects', () => {
      const orchestrator = createOrchestrator();
      expect(orchestrator.isSessionTerminatedError('process aborted by user')).toBe(true);
      expect(orchestrator.isSessionTerminatedError('some random string')).toBe(false);
    });
  });

  describe('getActiveAgent', () => {
    it('returns sdkAgent when no alternative provider is selected', () => {
      mockIsOpenRouterSelected = false;
      mockIsOpenRouterAvailable = false;
      mockIsGeminiSelected = false;
      mockIsGeminiAvailable = false;

      const orchestrator = createOrchestrator();
      const agent = orchestrator.getActiveAgent();
      expect(agent).toBe(mockSdkAgent);
    });

    it('returns openRouterAgent when OpenRouter is selected and available', () => {
      mockIsOpenRouterSelected = true;
      mockIsOpenRouterAvailable = true;
      mockIsGeminiSelected = false;
      mockIsGeminiAvailable = false;

      const orchestrator = createOrchestrator();
      const agent = orchestrator.getActiveAgent();
      expect(agent).toBe(mockOpenRouterAgent);
    });

    it('returns geminiAgent when Gemini is selected and available', () => {
      mockIsOpenRouterSelected = false;
      mockIsOpenRouterAvailable = false;
      mockIsGeminiSelected = true;
      mockIsGeminiAvailable = true;

      const orchestrator = createOrchestrator();
      const agent = orchestrator.getActiveAgent();
      expect(agent).toBe(mockGeminiAgent);
    });

    it('returns sdkAgent when OpenRouter is selected but not available', () => {
      mockIsOpenRouterSelected = true;
      mockIsOpenRouterAvailable = false;
      mockIsGeminiSelected = false;
      mockIsGeminiAvailable = false;

      const orchestrator = createOrchestrator();
      const agent = orchestrator.getActiveAgent();
      expect(agent).toBe(mockSdkAgent);
    });

    it('prefers OpenRouter over Gemini when both are selected and available', () => {
      mockIsOpenRouterSelected = true;
      mockIsOpenRouterAvailable = true;
      mockIsGeminiSelected = true;
      mockIsGeminiAvailable = true;

      const orchestrator = createOrchestrator();
      const agent = orchestrator.getActiveAgent();
      expect(agent).toBe(mockOpenRouterAgent);
    });
  });
});
