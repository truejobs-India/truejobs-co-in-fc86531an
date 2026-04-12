/**
 * Shared Sarvam.ai chat caller.
 *
 * ── Required env var ──
 *   SARVAM_API_KEY
 */

const SARVAM_CHAT_ENDPOINT = 'https://api.sarvam.ai/v1/chat/completions';

export interface SarvamChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  reasoningEffort?: 'low' | 'medium' | 'high' | null;
}

export async function callSarvamChat(
  prompt: string,
  options: SarvamChatOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get('SARVAM_API_KEY');
  if (!apiKey) throw new Error('SARVAM_API_KEY not configured');

  const {
    model = 'sarvam-30b',
    maxTokens: rawMaxTokens = 4096,
    temperature = 0.5,
    timeoutMs = 120_000,
    reasoningEffort = null,
  } = options;

  // Sarvam starter tier caps at 4096 tokens for all models
  const maxTokens = Math.min(rawMaxTokens, 4096);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[sarvam] Calling ${model}, maxTokens=${maxTokens}, reasoning=${reasoningEffort ?? 'none'}`);

    const resp = await fetch(SARVAM_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
        reasoning_effort: reasoningEffort,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Sarvam ${model} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    const choice = data?.choices?.[0];
    const text = typeof choice?.message?.content === 'string' ? choice.message.content : '';
    const reasoningText = typeof choice?.message?.reasoning_content === 'string' ? choice.message.reasoning_content : '';
    const finishReason = choice?.finish_reason || 'unknown';

    if (!text.trim()) {
      if (reasoningText.trim()) {
        throw new Error(`Sarvam ${model} returned no final content (finish_reason=${finishReason}, reasoning_only=true)`);
      }
      throw new Error(`Sarvam ${model} returned empty response (finish_reason=${finishReason})`);
    }

    console.log(`[sarvam] ${model} success, output length=${text.length}, finishReason=${finishReason}`);
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Sarvam ${model} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
