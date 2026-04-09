/**
 * Shared Azure MAI-Image-2 caller — server-side only.
 *
 * Uses the OpenAI-compatible endpoint on Azure AI Foundry.
 *
 * ── Required env vars ──
 *   AZURE_MAI_ENDPOINT         – e.g. https://social-5844-resource.services.ai.azure.com/api/projects/social-5844
 *   AZURE_MAI_API_KEY          – Azure resource API key
 *   AZURE_MAI_IMAGE_DEPLOYMENT – deployment name (e.g. MAI-Image-2)
 *
 * ── Endpoint ──
 *   POST {base}/openai/v1/images/generations
 *   Auth: Authorization: Bearer <key>
 *   Body: { model, prompt, size: "WxH", n: 1, response_format: "b64_json" }
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export interface AzureMaiImageOptions {
  /** Size string like "1024x1024" (default: "1024x1024") */
  size?: string;
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
  if (!deployment) throw new Error('AZURE_MAI_IMAGE_DEPLOYMENT not configured');

  const {
    size = '1024x1024',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Strip trailing slashes
  let cleanEndpoint = endpoint.replace(/\/+$/, '');
  // If user provides a project-scoped URL (e.g. .../api/projects/xxx), strip the project path.
  const projectPathIdx = cleanEndpoint.indexOf('/api/projects/');
  if (projectPathIdx > 0) {
    cleanEndpoint = cleanEndpoint.substring(0, projectPathIdx);
    console.log(`[azure-mai-image] Stripped project path, using resource base: ${cleanEndpoint}`);
  }
  const url = `${cleanEndpoint}/openai/v1/images/generations`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[azure-mai-image] Calling ${deployment} @ ${cleanEndpoint}, size=${size}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: deployment,
        prompt,
        size,
        n: 1,
        response_format: 'b64_json',
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

/** Map common aspect ratio strings to MAI-Image-2-compatible size strings */
export function maiSizeFromAspectRatio(ratio: string): string {
  switch (ratio) {
    case '16:9': return '1792x1024';
    case '9:16': return '1024x1792';
    case '4:3':  return '1024x768';
    case '3:4':  return '768x1024';
    case '1:1':
    default:     return '1024x1024';
  }
}
