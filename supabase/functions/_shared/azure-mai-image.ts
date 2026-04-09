/**
 * Shared Azure MAI-Image-2 caller — server-side only.
 *
 * Uses Azure AI Foundry MAI Image API (NOT Azure OpenAI).
 *
 * ── Required env vars ──
 *   AZURE_MAI_ENDPOINT         – e.g. https://your-resource.services.ai.azure.com
 *   AZURE_MAI_API_KEY          – Azure resource API key
 *   AZURE_MAI_IMAGE_DEPLOYMENT – deployment name (e.g. MAI-Image-2)
 *
 * ── Endpoint ──
 *   POST {ENDPOINT}/mai/v1/images/generations
 *   Body: { model: "<deployment>", prompt, width, height }
 *
 * ── Size constraints ──
 *   Both dimensions ≥ 768px, total pixels ≤ 1,048,576
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export interface AzureMaiImageOptions {
  /** Image width (default: 1024, min: 768) */
  width?: number;
  /** Image height (default: 1024, min: 768) */
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

/** Validate MAI-Image-2 size constraints: both dims ≥ 768, total pixels ≤ 1,048,576 */
function validateSize(width: number, height: number): void {
  if (width < 768) throw new Error(`MAI-Image-2 width must be ≥ 768px (got ${width})`);
  if (height < 768) throw new Error(`MAI-Image-2 height must be ≥ 768px (got ${height})`);
  const totalPixels = width * height;
  if (totalPixels > 1_048_576) {
    throw new Error(`MAI-Image-2 total pixels must be ≤ 1,048,576 (got ${width}×${height} = ${totalPixels})`);
  }
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
  if (!deployment) throw new Error('AZURE_MAI_IMAGE_DEPLOYMENT not configured');

  const {
    width = 1024,
    height = 1024,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  validateSize(width, height);

  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  // Azure AI Foundry MAI endpoint — api-version required by Azure gateway
  const url = `${cleanEndpoint}/mai/v1/images/generations?api-version=2025-03-01-preview`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-mai-image] Calling ${deployment} @ ${cleanEndpoint}, ${width}x${height}`);

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

    // MAI-Image-2 may return b64_json in data array or raw binary PNG
    const contentType = resp.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await resp.json();
      const imageData = data?.data?.[0];
      if (!imageData) {
        throw new Error('Azure MAI-Image-2 returned empty response — no image data');
      }

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
    }

    // Raw binary PNG response
    const arrBuf = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrBuf);
    if (bytes.length < 100) {
      throw new Error(`Azure MAI-Image-2 returned suspiciously small response (${bytes.length} bytes)`);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    console.log(`[azure-mai-image] success (binary PNG), bytes=${bytes.length}`);
    return {
      imageBase64: btoa(binary),
      mimeType: contentType.includes('image/') ? contentType.split(';')[0] : 'image/png',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Azure MAI-Image-2 timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Map common aspect ratio strings to MAI-Image-2-compatible width/height.
 *  Constraints: both dims ≥ 768, total pixels ≤ 1,048,576 */
export function maiSizeFromAspectRatio(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '16:9': return { width: 1024, height: 768 };
    case '9:16': return { width: 768, height: 1024 };
    case '4:3':  return { width: 1024, height: 768 };
    case '3:4':  return { width: 768, height: 1024 };
    case '1:1':
    default:     return { width: 1024, height: 1024 };
  }
}
