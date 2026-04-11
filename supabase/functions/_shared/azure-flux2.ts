/**
 * Shared Azure FLUX.2-pro image caller — server-side only.
 *
 * Uses Azure AI Foundry Black Forest Labs API for FLUX.2-pro.
 * Shares the same resource as DeepSeek (truejobsdeepseek-resource).
 *
 * ── Required env var ──
 *   AZURE_DEEPSEEK_API_KEY  – same key used for DeepSeek models
 *
 * ── Endpoint ──
 *   POST https://truejobsdeepseek-resource.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview
 *   Body: { prompt, width, height, n, model }
 *   Auth: Authorization: Bearer $API_KEY
 */

const ENDPOINT =
  'https://truejobsdeepseek-resource.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview';
const MODEL_NAME = 'FLUX.2-pro';
const DEFAULT_TIMEOUT_MS = 120_000;

export interface AzureFlux2Options {
  /** Image width (default: 1024) */
  width?: number;
  /** Image height (default: 1024) */
  height?: number;
  /** Number of images (default: 1) */
  n?: number;
  /** Timeout in ms (default: 120s) */
  timeoutMs?: number;
}

export interface AzureFlux2Result {
  /** Base64-encoded image data */
  imageBase64: string;
  /** MIME type */
  mimeType: string;
}

/**
 * Generate an image via Azure FLUX.2-pro.
 * Returns base64 image data ready for storage upload.
 */
export async function callAzureFlux2(
  prompt: string,
  options: AzureFlux2Options = {},
): Promise<AzureFlux2Result> {
  const apiKey = Deno.env.get('AZURE_DEEPSEEK_API_KEY');
  if (!apiKey) throw new Error('AZURE_DEEPSEEK_API_KEY not configured (needed for FLUX.2-pro)');

  const {
    width = 1024,
    height = 1024,
    n = 1,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-flux2] Calling ${MODEL_NAME}, ${width}x${height}, n=${n}`);

    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        n,
        model: MODEL_NAME,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure ${MODEL_NAME} error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();

    // Response format: { data: [{ b64_json: "..." }] }
    const imageData = data?.data?.[0];
    if (!imageData) {
      throw new Error(`Azure ${MODEL_NAME} returned empty response — no image data`);
    }

    const imageBase64 = imageData.b64_json;
    if (!imageBase64) {
      // Fallback: check for URL-based response
      if (imageData.url) {
        const imgResp = await fetch(imageData.url);
        if (!imgResp.ok) throw new Error(`Failed to download FLUX.2 image from URL: ${imgResp.status}`);
        const arrBuf = await imgResp.arrayBuffer();
        const bytes = new Uint8Array(arrBuf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return {
          imageBase64: btoa(binary),
          mimeType: imgResp.headers.get('content-type') || 'image/png',
        };
      }
      throw new Error(`Azure ${MODEL_NAME} returned no image data (no b64_json or url)`);
    }

    console.log(`[azure-flux2] ${MODEL_NAME} success, base64 length=${imageBase64.length}`);

    return {
      imageBase64,
      mimeType: 'image/png',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure ${MODEL_NAME} timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Map common aspect ratio strings to width/height */
export function flux2DimensionsFromAspectRatio(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '16:9':  return { width: 1792, height: 1024 };
    case '9:16':  return { width: 1024, height: 1792 };
    case '4:3':   return { width: 1024, height: 768 };
    case '3:4':   return { width: 768, height: 1024 };
    case '1:1':
    default:      return { width: 1024, height: 1024 };
  }
}
