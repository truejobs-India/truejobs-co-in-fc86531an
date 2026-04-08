/**
 * Shared Azure FLUX image caller — server-side only.
 *
 * Uses Azure AI Foundry Image API (OpenAI-compatible) for FLUX.1-Kontext-pro.
 *
 * ── Required env vars ──
 *   AZURE_FLUX_BASE_URL    – e.g. https://truejobsflux-resource (resource name only, or full URL)
 *   AZURE_FLUX_API_KEY     – Azure resource API key
 *
 * ── Endpoint format (BFL provider API) ──
 *   POST https://<resource>.services.ai.azure.com/openai/deployments/<deployment>/images/generations?api-version=2025-04-01-preview
 *   OR (fallback BFL native):
 *   POST https://<resource>.api.cognitive.microsoft.com/providers/blackforestlabs/v1/flux-kontext-pro?api-version=preview
 */

const DEFAULT_API_VERSION = '2025-04-01-preview';
const BFL_API_VERSION = 'preview';
const DEFAULT_TIMEOUT_MS = 120_000;

export interface AzureFluxOptions {
  /** Image size (default: 1024x1024). FLUX supports: 1024x1024, 1792x1024, 1024x1792 */
  size?: string;
  /** Number of images (default: 1) */
  n?: number;
  /** Output format: png or b64_json (default: b64_json for server-side storage) */
  outputFormat?: string;
  /** Timeout in ms (default: 120s) */
  timeoutMs?: number;
}

export interface AzureFluxResult {
  /** Base64-encoded image data */
  imageBase64: string;
  /** MIME type */
  mimeType: string;
  /** Revised prompt if returned by API */
  revisedPrompt?: string;
}

/**
 * Generate an image via Azure FLUX.1-Kontext-pro.
 * Returns base64 image data ready for storage upload.
 */
export async function callAzureFlux(
  prompt: string,
  options: AzureFluxOptions = {},
): Promise<AzureFluxResult> {
  const baseUrl = Deno.env.get('AZURE_FLUX_BASE_URL');
  const apiKey = Deno.env.get('AZURE_FLUX_API_KEY');
  const deployment = Deno.env.get('AZURE_FLUX_DEPLOYMENT');

  if (!baseUrl) throw new Error('AZURE_FLUX_BASE_URL not configured');
  if (!apiKey) throw new Error('AZURE_FLUX_API_KEY not configured');

  const {
    size = '1024x1024',
    n = 1,
    outputFormat = 'b64_json',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const resolvedSize = size;
  const cleanBase = baseUrl.replace(/\/+$/, '');

  // Extract resource name from URL for BFL endpoint
  const resourceMatch = cleanBase.match(/https?:\/\/([^.]+)/);
  const resourceName = resourceMatch?.[1] || '';

  // Build endpoint URL:
  // If AZURE_FLUX_DEPLOYMENT is set, use OpenAI Image API path
  // Otherwise, use BFL provider-specific API path (no deployment needed)
  let url: string;
  let apiVersion: string;
  if (deployment) {
    url = `${cleanBase}/openai/deployments/${deployment}/images/generations?api-version=${DEFAULT_API_VERSION}`;
    apiVersion = DEFAULT_API_VERSION;
  } else {
    // BFL provider API — uses .services.ai.azure.com base with provider path
    url = `${cleanBase}/providers/blackforestlabs/v1/flux-kontext-pro?api-version=${BFL_API_VERSION}`;
    apiVersion = BFL_API_VERSION;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-flux] Calling ${deployment || 'flux-kontext-pro (BFL API)'} @ ${cleanBase}, size=${resolvedSize}, n=${n}, apiVersion=${apiVersion}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        prompt,
        n,
        size: resolvedSize,
        response_format: outputFormat,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure FLUX ${deployment} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();

    // Response format: { data: [{ b64_json: "...", revised_prompt: "..." }] }
    const imageData = data?.data?.[0];
    if (!imageData) {
      throw new Error('Azure FLUX returned empty response — no image data');
    }

    const imageBase64 = imageData.b64_json;
    if (!imageBase64) {
      // Fallback: check for URL-based response
      if (imageData.url) {
        const imgResp = await fetch(imageData.url);
        if (!imgResp.ok) throw new Error(`Failed to download FLUX image from URL: ${imgResp.status}`);
        const arrBuf = await imgResp.arrayBuffer();
        const bytes = new Uint8Array(arrBuf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return {
          imageBase64: btoa(binary),
          mimeType: imgResp.headers.get('content-type') || 'image/png',
          revisedPrompt: imageData.revised_prompt,
        };
      }
      throw new Error('Azure FLUX returned no image data (no b64_json or url)');
    }

    console.log(`[azure-flux] ${deployment} success, base64 length=${imageBase64.length}`);

    return {
      imageBase64,
      mimeType: 'image/png',
      revisedPrompt: imageData.revised_prompt,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure FLUX ${deployment} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Map common aspect ratio strings to FLUX-compatible size strings */
export function fluxSizeFromAspectRatio(ratio: string): string {
  switch (ratio) {
    case '16:9': return '1792x1024';
    case '9:16': return '1024x1792';
    case '4:3':  return '1024x768';   // closest standard
    case '3:4':  return '768x1024';
    case '1:1':
    default:     return '1024x1024';
  }
}
