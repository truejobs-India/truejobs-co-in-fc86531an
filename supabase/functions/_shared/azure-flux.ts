/**
 * Shared Azure FLUX image caller — server-side only.
 *
 * Uses Azure AI Foundry OpenAI-compatible Image API for FLUX.1-Kontext-pro.
 *
 * ── Required env vars ──
 *   AZURE_FLUX_BASE_URL    – e.g. https://truejobsflux-resource.services.ai.azure.com
 *   AZURE_FLUX_API_KEY     – Azure resource API key
 *
 * ── Endpoint ──
 *   POST {BASE_URL}/openai/v1/images/generations
 *   Body: { model: "FLUX.1-Kontext-pro", prompt, n, size, response_format }
 */

const MODEL_NAME = 'FLUX.1-Kontext-pro';
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

  if (!baseUrl) throw new Error('AZURE_FLUX_BASE_URL not configured');
  if (!apiKey) throw new Error('AZURE_FLUX_API_KEY not configured');

  const {
    size = '1024x1024',
    n = 1,
    outputFormat = 'b64_json',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/openai/v1/images/generations`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-flux] Calling ${MODEL_NAME} @ ${cleanBase}, size=${size}, n=${n}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,
        n,
        size,
        response_format: outputFormat,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure FLUX ${MODEL_NAME} error ${resp.status}: ${errText.substring(0, 500)}`);
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

    console.log(`[azure-flux] ${MODEL_NAME} success, base64 length=${imageBase64.length}`);

    return {
      imageBase64,
      mimeType: 'image/png',
      revisedPrompt: imageData.revised_prompt,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure FLUX ${MODEL_NAME} timeout after ${timeoutMs / 1000}s`);
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
    case '4:3':  return '1024x768';
    case '3:4':  return '768x1024';
    case '1:1':
    default:     return '1024x1024';
  }
}
