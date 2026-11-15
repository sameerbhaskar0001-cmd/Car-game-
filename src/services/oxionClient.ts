import OpenAI from 'openai';

export const OXION_DEFAULT_BASE_URL = 'https://www.oxionai.com/v1';
export const OXION_ALT_BASE_URL = 'https://api.oxion.ai/v1';
export const OXION_DEFAULT_MODEL = 'claude-opus-5.5';

/**
 * Creates an OpenAI SDK client configured for Oxion AI
 */
export function createOxionClient(options: {
  apiKey?: string;
  baseURL?: string;
} = {}) {
  const apiKey =
    options.apiKey ||
    (typeof process !== 'undefined' ? process.env?.OXION_API_KEY : undefined) ||
    '';

  const baseURL =
    options.baseURL ||
    (typeof process !== 'undefined' ? process.env?.OXION_BASE_URL : undefined) ||
    OXION_DEFAULT_BASE_URL;

  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true, // Allows client usage if needed in browser dev
  });
}

/**
 * Sends a chat completion to Oxion AI with automatic fallback
 * Default model: claude-opus-5.5
 */
export async function sendOxionChatCompletion(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  apiKey?: string;
  baseURL?: string;
}) {
  const apiKey =
    params.apiKey ||
    (typeof process !== 'undefined' ? process.env?.OXION_API_KEY : undefined) ||
    '';

  const targetModel = params.model || OXION_DEFAULT_MODEL;

  // Try configured / default base URL first, then try alternate URL if connection/auth differs
  const baseUrlsToTry = [
    params.baseURL || (typeof process !== 'undefined' ? process.env?.OXION_BASE_URL : undefined) || OXION_DEFAULT_BASE_URL,
    OXION_ALT_BASE_URL,
  ];

  // Remove duplicates
  const uniqueUrls = Array.from(new Set(baseUrlsToTry));

  let lastError: unknown = null;

  for (const url of uniqueUrls) {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: url,
        dangerouslyAllowBrowser: true,
      });

      const response = await client.chat.completions.create({
        model: targetModel,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        ...(params.max_tokens ? { max_tokens: params.max_tokens } : {}),
      });

      return {
        success: true,
        endpoint: url,
        model: targetModel,
        response,
        content: response.choices[0]?.message?.content || '',
      };
    } catch (err: any) {
      lastError = err;
      // If error occurred, attempt next endpoint
      continue;
    }
  }

  throw lastError || new Error('Failed to communicate with Oxion AI API');
}

/**
 * Simple helper to generate text with Oxion AI claude-opus-5.5
 */
export async function generateOxionText(prompt: string, systemPrompt?: string) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const result = await sendOxionChatCompletion({
    messages,
    model: OXION_DEFAULT_MODEL,
  });

  return result.content;
}
