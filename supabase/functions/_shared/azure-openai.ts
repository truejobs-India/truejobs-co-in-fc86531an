/**
 * Shared Azure OpenAI caller — supports multiple deployments.
 *
 * ── Required env vars (set as Supabase secrets) ──
 *   AZURE_OPENAI_ENDPOINT  – default endpoint (e.g. https://socia-mnprfwf7-eastus2.cognitiveservices.azure.com/)
 *   AZURE_OPENAI_API_KEY   – your Azure OpenAI resource key
 *
 * ── Deployments ──
 *   gpt-4o-mini   → uses AZURE_OPENAI_ENDPOINT (default)
 *   gpt-4.1-mini  → uses https://truejobs.openai.azure.com (hardcoded, same API key)
 *
 * ── How to add a new deployment ──
 *   1. Add optional `deploymentName` and `endpoint` overrides in caller code
 *   2. Or create a convenience wrapper like callAzureGPT41Mini below
 */

// Default deployment configuration
const DEFAULT_DEPLOYMENT_NAME = 'gpt-4o-mini';
const DEFAULT_API_VERSION = '2024-12-01-preview';

// GPT-4.1 Mini deployment on TrueJobs Azure resource
const GPT41_MINI_DEPLOYMENT = 'gpt-4.1-mini';
const GPT41_MINI_ENDPOINT = 'https://truejobsgpt41mini-resource.services.ai.azure.com';

export interface AzureOpenAIOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  /** Override deployment name (default: gpt-4o-mini) */
  deploymentName?: string;
  /** Override Azure endpoint URL (default: AZURE_OPENAI_ENDPOINT env var) */
  endpoint?: string;
  /** Override API key (default: AZURE_OPENAI_API_KEY env var) */
  apiKey?: string;
}

/**
 * Call Azure OpenAI Chat Completions API.
 * Returns the generated text string.
 */
export async function callAzureOpenAI(
  prompt: string,
  options: AzureOpenAIOptions = {},
): Promise<string> {
  const deploymentName = options.deploymentName || DEFAULT_DEPLOYMENT_NAME;
  const endpointOverride = options.endpoint;

  const endpoint = endpointOverride || Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const apiKey = options.apiKey || Deno.env.get('AZURE_OPENAI_API_KEY');

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
  const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${DEFAULT_API_VERSION}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-openai] Calling ${deploymentName} @ ${baseUrl}, maxTokens=${maxTokens}, temp=${temperature}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages,
        // GPT-5 series uses max_completion_tokens and only supports default temperature
        ...(deploymentName.startsWith('gpt-5')
          ? { max_completion_tokens: maxTokens }
          : { max_tokens: maxTokens, temperature }),
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure OpenAI ${deploymentName} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';

    if (!text.trim()) {
      throw new Error(`Azure OpenAI ${deploymentName} returned empty response`);
    }

    console.log(`[azure-openai] ${deploymentName} success, output length=${text.length}`);
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure OpenAI ${deploymentName} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convenience wrapper for GPT-4.1 Mini on TrueJobs Azure resource.
 * Uses the same API key but different endpoint and deployment.
 */
export async function callAzureGPT41Mini(
  prompt: string,
  options: Omit<AzureOpenAIOptions, 'deploymentName' | 'endpoint' | 'apiKey'> = {},
): Promise<string> {
  const gpt41ApiKey = Deno.env.get('AZURE_GPT41_MINI_API_KEY');
  if (!gpt41ApiKey) throw new Error('AZURE_GPT41_MINI_API_KEY not configured');
  return callAzureOpenAI(prompt, {
    ...options,
    deploymentName: GPT41_MINI_DEPLOYMENT,
    endpoint: GPT41_MINI_ENDPOINT,
    apiKey: gpt41ApiKey,
  });
}

// GPT-5 Mini deployment on TrueJobs DeepSeek Azure resource
const GPT5_MINI_DEPLOYMENT = 'gpt-5-mini';
const GPT5_MINI_ENDPOINT = 'https://truejobsdeepseek-resource.cognitiveservices.azure.com';

/**
 * Convenience wrapper for GPT-5 Mini on TrueJobs DeepSeek Azure resource.
 * Uses AZURE_DEEPSEEK_API_KEY but standard Azure OpenAI chat completions format.
 */
export async function callAzureGPT5Mini(
  prompt: string,
  options: Omit<AzureOpenAIOptions, 'deploymentName' | 'endpoint' | 'apiKey'> = {},
): Promise<string> {
  const gpt5ApiKey = Deno.env.get('AZURE_DEEPSEEK_API_KEY');
  if (!gpt5ApiKey) throw new Error('AZURE_DEEPSEEK_API_KEY not configured');
  return callAzureOpenAI(prompt, {
    ...options,
    deploymentName: GPT5_MINI_DEPLOYMENT,
    endpoint: GPT5_MINI_ENDPOINT,
    apiKey: gpt5ApiKey,
  });
}
