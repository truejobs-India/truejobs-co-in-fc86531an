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
const DEEPSEEK_DEFAULT_MODEL = 'DeepSeek-V3.1';

export interface AzureDeepSeekOptions {
  model?: 'DeepSeek-V3.1' | 'DeepSeek-R1';
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
    model = DEEPSEEK_DEFAULT_MODEL,
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
    console.log(`[azure-deepseek] Calling ${model}, maxTokens=${maxTokens}, temp=${temperature}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure DeepSeek ${model} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';

    if (!text.trim()) {
      throw new Error(`Azure DeepSeek ${model} returned empty response`);
    }

    console.log(`[azure-deepseek] ${model} success, output length=${text.length}`);
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure DeepSeek ${model} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
