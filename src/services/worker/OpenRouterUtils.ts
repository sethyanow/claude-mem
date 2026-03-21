/**
 * OpenRouterUtils: Configuration, types, and utilities for the OpenRouter API
 *
 * Extracted from OpenRouterAgent to reduce file size.
 * These are OpenRouter-specific utilities not shared with SDK/Gemini agents.
 */

import { getCredential } from '../../shared/EnvManager.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../../shared/paths.js';
import { logger } from '../../utils/logger.js';
import type { ConversationMessage } from '../worker-types.js';

// OpenRouter API endpoint
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Context window management constants (defaults, overridable via settings)
const DEFAULT_MAX_CONTEXT_MESSAGES = 20;  // Maximum messages to keep in conversation history
const DEFAULT_MAX_ESTIMATED_TOKENS = 100000;  // ~100k tokens max context (safety limit)
const CHARS_PER_TOKEN_ESTIMATE = 4;  // Conservative estimate: 1 token = 4 chars

// OpenAI-compatible message format
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: string;
  };
}

/**
 * Estimate token count from text (conservative estimate)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Convert shared ConversationMessage array to OpenAI-compatible message format
 */
function conversationToOpenAIMessages(history: ConversationMessage[]): OpenAIMessage[] {
  return history.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: msg.content
  }));
}

/**
 * Truncate conversation history to prevent runaway context costs
 * Keeps most recent messages within token budget
 */
function truncateHistory(history: ConversationMessage[]): ConversationMessage[] {
  const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);

  const MAX_CONTEXT_MESSAGES = parseInt(settings.CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES) || DEFAULT_MAX_CONTEXT_MESSAGES;
  const MAX_ESTIMATED_TOKENS = parseInt(settings.CLAUDE_MEM_OPENROUTER_MAX_TOKENS) || DEFAULT_MAX_ESTIMATED_TOKENS;

  if (history.length <= MAX_CONTEXT_MESSAGES) {
    // Check token count even if message count is ok
    const totalTokens = history.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    if (totalTokens <= MAX_ESTIMATED_TOKENS) {
      return history;
    }
  }

  // Sliding window: keep most recent messages within limits
  const truncated: ConversationMessage[] = [];
  let tokenCount = 0;

  // Process messages in reverse (most recent first)
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = estimateTokens(msg.content);

    if (truncated.length >= MAX_CONTEXT_MESSAGES || tokenCount + msgTokens > MAX_ESTIMATED_TOKENS) {
      logger.warn('SDK', 'Context window truncated to prevent runaway costs', {
        originalMessages: history.length,
        keptMessages: truncated.length,
        droppedMessages: i + 1,
        estimatedTokens: tokenCount,
        tokenLimit: MAX_ESTIMATED_TOKENS
      });
      break;
    }

    truncated.unshift(msg);  // Add to beginning
    tokenCount += msgTokens;
  }

  return truncated;
}

/**
 * Query OpenRouter via REST API with full conversation history (multi-turn)
 * Sends the entire conversation context for coherent responses
 */
export async function queryOpenRouterMultiTurn(
  history: ConversationMessage[],
  apiKey: string,
  model: string,
  siteUrl?: string,
  appName?: string
): Promise<{ content: string; tokensUsed?: number }> {
  // Truncate history to prevent runaway costs
  const truncatedHistory = truncateHistory(history);
  const messages = conversationToOpenAIMessages(truncatedHistory);
  const totalChars = truncatedHistory.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTkns = estimateTokens(truncatedHistory.map(m => m.content).join(''));

  logger.debug('SDK', `Querying OpenRouter multi-turn (${model})`, {
    turns: truncatedHistory.length,
    totalChars,
    estimatedTokens: estimatedTkns
  });

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': siteUrl || 'https://github.com/thedotmack/claude-mem',
      'X-Title': appName || 'claude-mem',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,  // Lower temperature for structured extraction
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as OpenRouterResponse;

  // Check for API error in response body
  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.code} - ${data.error.message}`);
  }

  if (!data.choices?.[0]?.message?.content) {
    logger.error('SDK', 'Empty response from OpenRouter');
    return { content: '' };
  }

  const content = data.choices[0].message.content;
  const tokensUsed = data.usage?.total_tokens;

  // Log actual token usage for cost tracking
  if (tokensUsed) {
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    // Token usage (cost varies by model - many OpenRouter models are free)
    const estimatedCost = (inputTokens / 1000000 * 3) + (outputTokens / 1000000 * 15);

    logger.info('SDK', 'OpenRouter API usage', {
      model,
      inputTokens,
      outputTokens,
      totalTokens: tokensUsed,
      estimatedCostUSD: estimatedCost.toFixed(4),
      messagesInContext: truncatedHistory.length
    });

    // Warn if costs are getting high
    if (tokensUsed > 50000) {
      logger.warn('SDK', 'High token usage detected - consider reducing context', {
        totalTokens: tokensUsed,
        estimatedCost: estimatedCost.toFixed(4)
      });
    }
  }

  return { content, tokensUsed };
}

/**
 * Get OpenRouter configuration from settings or environment
 * Issue #733: Uses centralized ~/.claude-mem/.env for credentials, not random project .env files
 */
export function getOpenRouterConfig(): { apiKey: string; model: string; siteUrl?: string; appName?: string } {
  const settingsPath = USER_SETTINGS_PATH;
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

  // API key: check settings first, then centralized claude-mem .env (NOT process.env)
  const apiKey = settings.CLAUDE_MEM_OPENROUTER_API_KEY || getCredential('OPENROUTER_API_KEY') || '';

  // Model: from settings or default
  const model = settings.CLAUDE_MEM_OPENROUTER_MODEL || 'xiaomi/mimo-v2-flash:free';

  // Optional analytics headers
  const siteUrl = settings.CLAUDE_MEM_OPENROUTER_SITE_URL || '';
  const appName = settings.CLAUDE_MEM_OPENROUTER_APP_NAME || 'claude-mem';

  return { apiKey, model, siteUrl, appName };
}

/**
 * Check if OpenRouter is available (has API key configured)
 * Issue #733: Uses centralized ~/.claude-mem/.env, not random project .env files
 */
export function isOpenRouterAvailable(): boolean {
  const settingsPath = USER_SETTINGS_PATH;
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  return !!(settings.CLAUDE_MEM_OPENROUTER_API_KEY || getCredential('OPENROUTER_API_KEY'));
}

/**
 * Check if OpenRouter is the selected provider
 */
export function isOpenRouterSelected(): boolean {
  const settingsPath = USER_SETTINGS_PATH;
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  return settings.CLAUDE_MEM_PROVIDER === 'openrouter';
}
