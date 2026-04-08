/**
 * Shared Azure OpenAI caller for the deployed gpt-4o-mini model.
 *
 * ── Required env vars (set as Supabase secrets) ──
 *   AZURE_OPENAI_ENDPOINT  – e.g. https://socia-mnprfwf7-eastus2.cognitiveservices.azure.com/
 *   AZURE_OPENAI_API_KEY   – your Azure OpenAI resource key
 *
 * ── Hardcoded deployment config (change here to switch model) ──
 *   Deployment name: gpt-4o-mini
 *   API version:     2024-12-01-preview
 *
 * ── How to switch deployment ──
 *   1. Change DEPLOYMENT_NAME below to your new deployment name
 *   2. Optionally update API_VERSION if required by the new model
 *   3. No other file changes needed — all edge functions route through this caller
 *
 * ── How to test ──
 *   Go to Admin → Blog → New Article → select "Azure GPT-4o Mini" → generate any article.
 */

// Azure deployment configuration — change these to switch models
const DEPLOYMENT_NAME = 'gpt-4o-mini';
const API_VERSION = '2024-12-01-preview';

export interface AzureOpenAIOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}

/**
 * Call Azure OpenAI Chat Completions API.
 * Returns the generated text string (same interface as callBedrockNova).
 */
export async function callAzureOpenAI(
  prompt: string,
  options: AzureOpenAIOptions = {},
): Promise<string> {
  const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_OPENAI_API_KEY');

  if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT not configured');
  if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY not configured');

  const {
    maxTokens = 4096,
    temperature = 0.5,
    timeoutMs = 60_000,
    systemPrompt,
  } = options;

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // Build URL: {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=${API_VERSION}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-openai] Calling ${DEPLOYMENT_NAME}, maxTokens=${maxTokens}, temp=${temperature}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure OpenAI ${DEPLOYMENT_NAME} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';

    if (!text.trim()) {
      throw new Error(`Azure OpenAI ${DEPLOYMENT_NAME} returned empty response`);
    }

    console.log(`[azure-openai] ${DEPLOYMENT_NAME} success, output length=${text.length}`);
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure OpenAI ${DEPLOYMENT_NAME} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
