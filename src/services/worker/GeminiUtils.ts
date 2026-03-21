/**
 * GeminiUtils: Configuration, types, and utilities for the Gemini API
 *
 * Extracted from GeminiAgent to reduce file size.
 * These are Gemini-specific utilities not shared with SDK/OpenRouter agents.
 */

import path from 'path';
import { homedir } from 'os';
import { logger } from '../../utils/logger.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { getCredential } from '../../shared/EnvManager.js';
import type { ConversationMessage } from '../worker-types.js';

// Gemini API endpoint — use v1 (stable), not v1beta.
// v1beta does not support newer models like gemini-3-flash.
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models';

// Gemini model types (available via API)
export type GeminiModel =
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-3-flash'
  | 'gemini-3-flash-preview';

// Free tier RPM limits by model (requests per minute)
const GEMINI_RPM_LIMITS: Record<GeminiModel, number> = {
  'gemini-2.5-flash-lite': 10,
  'gemini-2.5-flash': 10,
  'gemini-2.5-pro': 5,
  'gemini-2.0-flash': 15,
  'gemini-2.0-flash-lite': 30,
  'gemini-3-flash': 10,
  'gemini-3-flash-preview': 5,
};

// Track last request time for rate limiting
let lastRequestTime = 0;

/**
 * Enforce RPM rate limit for Gemini free tier.
 * Waits the required time between requests based on model's RPM limit + 100ms safety buffer.
 * Skipped entirely if rate limiting is disabled (billing users with 1000+ RPM available).
 */
export async function enforceRateLimitForModel(model: GeminiModel, rateLimitingEnabled: boolean): Promise<void> {
  // Skip rate limiting if disabled (billing users with 1000+ RPM)
  if (!rateLimitingEnabled) {
    return;
  }

  const rpm = GEMINI_RPM_LIMITS[model] || 5;
  const minimumDelayMs = Math.ceil(60000 / rpm) + 100; // (60s / RPM) + 100ms safety buffer

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < minimumDelayMs) {
    const waitTime = minimumDelayMs - timeSinceLastRequest;
    logger.debug('SDK', `Rate limiting: waiting ${waitTime}ms before Gemini request`, { model, rpm });
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Gemini content message format
 * role: "user" or "model" (Gemini uses "model" not "assistant")
 */
export interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Convert conversation history to Gemini format
 */
export function conversationToGeminiContents(history: ConversationMessage[]): GeminiContent[] {
  return history.map(msg => ({
    role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    parts: [{ text: msg.content }],
  }));
}

/**
 * Get Gemini configuration from settings
 */
export function getGeminiConfig(): { apiKey: string; model: GeminiModel; rateLimitingEnabled: boolean } {
  const settingsPath = path.join(homedir(), '.claude-mem', 'settings.json');
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

  // API key: check settings first, then centralized claude-mem .env (NOT process.env)
  // This prevents Issue #733 where random project .env files could interfere
  const apiKey = settings.CLAUDE_MEM_GEMINI_API_KEY || getCredential('GEMINI_API_KEY') || '';

  // Model: from settings or default, with validation
  const defaultModel: GeminiModel = 'gemini-2.5-flash';
  const configuredModel = settings.CLAUDE_MEM_GEMINI_MODEL || defaultModel;
  const validModels: GeminiModel[] = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-3-flash',
    'gemini-3-flash-preview',
  ];

  let model: GeminiModel;
  if (validModels.includes(configuredModel as GeminiModel)) {
    model = configuredModel as GeminiModel;
  } else {
    logger.warn('SDK', `Invalid Gemini model "${configuredModel}", falling back to ${defaultModel}`, {
      configured: configuredModel,
      validModels,
    });
    model = defaultModel;
  }

  // Rate limiting: enabled by default for free tier users
  const rateLimitingEnabled = settings.CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED !== 'false';

  return { apiKey, model, rateLimitingEnabled };
}

/**
 * Query Gemini with multi-turn conversation
 */
export async function queryGeminiMultiTurn(
  history: ConversationMessage[],
  apiKey: string,
  model: GeminiModel,
  rateLimitingEnabled: boolean,
): Promise<{ content: string; tokensUsed: number }> {
  // Enforce rate limit before making request
  await enforceRateLimitForModel(model, rateLimitingEnabled);

  // Convert conversation history to Gemini format
  const contents = conversationToGeminiContents(history);

  // Log conversation size
  const totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0);
  logger.debug('SDK', 'Querying Gemini multi-turn', {
    turns: contents.length,
    totalChars,
  });

  // Make API call
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.3,  // Lower temperature for structured extraction
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GeminiResponse;

  // Extract text content
  const content =
    data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract token usage
  const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

  return { content, tokensUsed };
}

/**
 * Check if Gemini is available (has API key configured)
 * Issue #733: Uses centralized ~/.claude-mem/.env, not random project .env files
 */
export function isGeminiAvailable(): boolean {
  const settingsPath = path.join(homedir(), '.claude-mem', 'settings.json');
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  return !!(settings.CLAUDE_MEM_GEMINI_API_KEY || getCredential('GEMINI_API_KEY'));
}

/**
 * Check if Gemini is the selected provider
 */
export function isGeminiSelected(): boolean {
  const settingsPath = path.join(homedir(), '.claude-mem', 'settings.json');
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  return settings.CLAUDE_MEM_PROVIDER === 'gemini';
}
