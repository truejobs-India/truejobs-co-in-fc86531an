/**
 * Shared Azure AI Foundry DeepSeek V3.1 caller.
 *
 * ── Required env var ──
 *   AZURE_DEEPSEEK_API_KEY  – API key from Azure AI Foundry deployment
 *
 * ── Endpoint ──
 *   https://truejobsdeepseek-resource.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview
 */

const DEEPSEEK_ENDPOINT = 'https://truejobsdeepseek-resource.services.ai.azure.com';
const DEEPSEEK_API_VERSION = '2024-05-01-preview';
const DEEPSEEK_MODEL = 'DeepSeek-V3.1';

export interface AzureDeepSeekOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}

/**
 * Call Azure AI Foundry DeepSeek V3.1 Chat Completions API.
 * Returns the generated text string.
 */
export async function callAzureDeepSeek(
  prompt: string,
  options: AzureDeepSeekOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get('AZURE_DEEPSEEK_API_KEY');
  if (!apiKey) throw new Error('AZURE_DEEPSEEK_API_KEY not configured');

  const {
    maxTokens = 4096,
    temperature = 0.5,
    timeoutMs = 90_000,
    systemPrompt,
  } = options;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const url = `${DEEPSEEK_ENDPOINT}/models/chat/completions?api-version=${DEEPSEEK_API_VERSION}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-deepseek] Calling ${DEEPSEEK_MODEL}, maxTokens=${maxTokens}, temp=${temperature}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure DeepSeek ${DEEPSEEK_MODEL} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';

    if (!text.trim()) {
      throw new Error(`Azure DeepSeek ${DEEPSEEK_MODEL} returned empty response`);
    }

    console.log(`[azure-deepseek] ${DEEPSEEK_MODEL} success, output length=${text.length}`);
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure DeepSeek ${DEEPSEEK_MODEL} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
