/**
 * Shared Azure MAI-Image-2 caller — server-side only.
 *
 * Uses the MAI image generation endpoint on Azure AI Foundry.
 *
 * ── Required env vars (internal aliases → Azure Foundry values) ──
 *   AZURE_MAI_ENDPOINT          → Azure Foundry resource endpoint
 *                                  (e.g. https://<name>.services.ai.azure.com
 *                                   or   https://<name>.services.ai.azure.com/api/projects/<proj>)
 *                                  Project path is stripped automatically.
 *   AZURE_MAI_API_KEY           → Azure API key (from Foundry portal "Keys and Endpoint")
 *   AZURE_MAI_IMAGE_DEPLOYMENT  → deployed model name shown in Foundry (e.g. "MAI-Image-2")
 *                                  Maps to the `model` field in the request body.
 *
 * ── Endpoint (per official Microsoft docs) ──
 *   POST https://<resource>.services.ai.azure.com/mai/v1/images/generations
 *   Auth: api-key: <key>
 *   Body: { model, prompt, width, height }
 *   Response: { data: [{ b64_json: "..." }] }
 *
 * ── Constraints ──
 *   Both width and height must be ≥ 768 px.
 *   width × height must not exceed 1,048,576 (equivalent to 1024×1024).
 */

const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_DIMENSION = 768;
const MAX_TOTAL_PIXELS = 1_048_576;

export interface AzureMaiImageOptions {
  /** Image width in pixels (default: 1024, min: 768) */
  width?: number;
  /** Image height in pixels (default: 1024, min: 768) */
  height?: number;
  /** Timeout in ms (default: 120s) */
  timeoutMs?: number;
}

export interface AzureMaiImageResult {
  /** Base64-encoded image data (PNG) */
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

  let {
    width = 1024,
    height = 1024,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Enforce minimum 768px per dimension (official constraint)
  if (width < MIN_DIMENSION) width = MIN_DIMENSION;
  if (height < MIN_DIMENSION) height = MIN_DIMENSION;

  // Enforce max total pixels
  if (width * height > MAX_TOTAL_PIXELS) {
    const scale = Math.sqrt(MAX_TOTAL_PIXELS / (width * height));
    width = Math.max(MIN_DIMENSION, Math.floor(width * scale));
    height = Math.max(MIN_DIMENSION, Math.floor(height * scale));
  }

  // Strip trailing slashes
  let cleanEndpoint = endpoint.replace(/\/+$/, '');
  // If user provides a project-scoped URL (e.g. .../api/projects/xxx), strip the project path.
  // Official docs: endpoint should be https://<resource>.services.ai.azure.com
  const projectPathIdx = cleanEndpoint.indexOf('/api/projects/');
  if (projectPathIdx > 0) {
    cleanEndpoint = cleanEndpoint.substring(0, projectPathIdx);
    console.log(`[azure-mai-image] Stripped project path, using resource base: ${cleanEndpoint}`);
  }

  // Official MAI endpoint path (NOT the OpenAI-compatible path)
  const url = `${cleanEndpoint}/mai/v1/images/generations`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-mai-image] POST ${url}, model=${deployment}, ${width}x${height}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
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

    // Standard response: b64_json
    const imageBase64 = imageData.b64_json;
    if (imageBase64) {
      console.log(`[azure-mai-image] success, base64 length=${imageBase64.length}`);
      return {
        imageBase64,
        mimeType: 'image/png',
        revisedPrompt: imageData.revised_prompt,
      };
    }

    // Fallback: URL-based response (unlikely per docs, but safe)
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

/**
 * Map common aspect ratio strings to MAI-Image-2-compatible width/height.
 * All values satisfy: w >= 768, h >= 768, w*h <= 1,048,576.
 */
export function maiSizeFromAspectRatio(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '16:9': return { width: 1024, height: 768 };   // 786,432 total pixels
    case '9:16': return { width: 768, height: 1024 };   // 786,432 total pixels
    case '4:3':  return { width: 1024, height: 768 };   // 786,432 total pixels
    case '3:4':  return { width: 768, height: 1024 };   // 786,432 total pixels
    case '1:1':
    default:     return { width: 1024, height: 1024 };   // 1,048,576 total pixels
  }
}
