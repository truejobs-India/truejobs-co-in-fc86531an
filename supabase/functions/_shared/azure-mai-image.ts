/**
 * Shared Azure MAI-Image-2 caller — server-side only.
 *
 * Uses the MAI image generation endpoint on Azure AI Foundry.
 *
 * ── Required env vars (internal aliases → Azure Foundry values) ──
 *   AZURE_MAI_ENDPOINT  → Azure Foundry resource endpoint (target URL from Foundry portal)
 *   AZURE_MAI_API_KEY   → Azure API key (from Foundry portal "Keys" section)
 *
 * ── Deployment name ──
 *   AZURE_MAI_IMAGE_DEPLOYMENT → the deployed model name shown in Foundry (e.g. "MAI-Image-2")
 *   This is an internal env-var alias; Azure does not have a setting called
 *   "AZURE_MAI_IMAGE_DEPLOYMENT" — it maps to the `model` field in the request body.
 *
 * ── Endpoint ──
 *   POST {AZURE_MAI_ENDPOINT}/mai/v1/images/generations
 *   Auth: Authorization: Bearer {AZURE_MAI_API_KEY}
 *   Body: { model: DEPLOYMENT_NAME, prompt, width, height }
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export interface AzureMaiImageOptions {
  /** Image width in pixels (default: 1024) */
  width?: number;
  /** Image height in pixels (default: 1024) */
  height?: number;
  /** Timeout in ms (default: 120s) */
  timeoutMs?: number;
}

export interface AzureMaiImageResult {
  /** Base64-encoded image data */
  imageBase64: string;
  /** MIME type */
  mimeType: string;
  /** Revised prompt if returned by API */
  revisedPrompt?: string;
}

/**
 * Generate an image via Azure MAI-Image-2.
 * Returns base64 image data ready for storage upload.
 */
export async function callAzureMaiImage(
  prompt: string,
  options: AzureMaiImageOptions = {},
): Promise<AzureMaiImageResult> {
  const endpoint = Deno.env.get('AZURE_MAI_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_MAI_API_KEY');
  const deployment = Deno.env.get('AZURE_MAI_IMAGE_DEPLOYMENT');

  if (!endpoint) throw new Error('AZURE_MAI_ENDPOINT not configured');
  if (!apiKey) throw new Error('AZURE_MAI_API_KEY not configured');
  if (!deployment) throw new Error('AZURE_MAI_IMAGE_DEPLOYMENT not configured (set to your Foundry deployment name, e.g. "MAI-Image-2")');

  const {
    width = 1024,
    height = 1024,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Clean endpoint — strip trailing slashes only. Keep full path as provided.
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/mai/v1/images/generations?api-version=2024-05-01-preview`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-mai-image] Calling ${deployment} @ ${cleanEndpoint}, ${width}x${height}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: deployment,
        prompt,
        width,
        height,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Azure MAI-Image-2 error ${resp.status}: ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    const imageData = data?.data?.[0];
    if (!imageData) {
      throw new Error('Azure MAI-Image-2 returned empty response — no image data');
    }

    // Prefer b64_json if present
    const imageBase64 = imageData.b64_json;
    if (imageBase64) {
      console.log(`[azure-mai-image] success (b64_json), base64 length=${imageBase64.length}`);
      return {
        imageBase64,
        mimeType: 'image/png',
        revisedPrompt: imageData.revised_prompt,
      };
    }

    // Fallback: URL-based response
    if (imageData.url) {
      const imgResp = await fetch(imageData.url);
      if (!imgResp.ok) throw new Error(`Failed to download MAI image from URL: ${imgResp.status}`);
      const arrBuf = await imgResp.arrayBuffer();
      const bytes = new Uint8Array(arrBuf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      console.log(`[azure-mai-image] success (url download), bytes=${bytes.length}`);
      return {
        imageBase64: btoa(binary),
        mimeType: imgResp.headers.get('content-type') || 'image/png',
        revisedPrompt: imageData.revised_prompt,
      };
    }

    throw new Error('Azure MAI-Image-2 returned no image data (no b64_json or url)');
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure MAI-Image-2 timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Map common aspect ratio strings to MAI-Image-2-compatible width/height */
export function maiSizeFromAspectRatio(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '16:9': return { width: 1792, height: 1024 };
    case '9:16': return { width: 1024, height: 1792 };
    case '4:3':  return { width: 1024, height: 768 };
    case '3:4':  return { width: 768, height: 1024 };
    case '1:1':
    default:     return { width: 1024, height: 1024 };
  }
}
