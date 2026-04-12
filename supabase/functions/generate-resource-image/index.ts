/**
 * generate-resource-image — AI cover image generation for PDF resources.
 * 
 * Strict routing: selected model → exact provider. No silent fallbacks.
 * Every response follows the structured contract with requestId.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiDirectImage } from '../_shared/gemini-direct.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// Model registry — exhaustive, no catch-all
// ═══════════════════════════════════════════════════════════════
interface ModelRoute {
  provider: 'gemini-direct' | 'lovable-gateway';
  apiModel: string;
  label: string;
}

const MODEL_REGISTRY: Record<string, ModelRoute> = {
  'vertex-pro':           { provider: 'gemini-direct',    apiModel: 'gemini-2.5-flash-preview-image-generation', label: 'Gemini Flash Image (Direct API)' },
  'vertex-flash-image':   { provider: 'gemini-direct',    apiModel: 'gemini-2.5-flash-preview-image-generation', label: 'Gemini Flash Image (Direct API)' },
  'gemini-flash-image':   { provider: 'lovable-gateway',  apiModel: 'google/gemini-2.5-flash-image', label: 'Gemini Flash Image (Gateway)' },
  'gemini-pro-image':     { provider: 'lovable-gateway',  apiModel: 'google/gemini-3-pro-image-preview', label: 'Gemini Pro Image (Gateway)' },
  'gemini-flash-image-2': { provider: 'lovable-gateway',  apiModel: 'google/gemini-3.1-flash-image-preview', label: 'Gemini Flash Image 2 (Gateway)' },
};

function generateRequestId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(resp: Response): number | null {
  const retryAfter = resp.headers.get('retry-after');
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(retryAfter);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(dateMs - Date.now(), 0);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

// ── Structured response builders ──────────────────────────────

function makeSuccessResponse(
  requestId: string, route: ModelRoute, selectedModelId: string,
  imageUrl: string, storagePath: string, mimeType: string, warnings: string[],
): Response {
  return new Response(JSON.stringify({
    ok: true, requestId, selectedModelId,
    selectedModelLabel: route.label,
    actualProviderUsed: route.provider,
    actualModelUsed: route.apiModel,
    routeKey: selectedModelId,
    imageUrl, storagePath, mimeType, warnings,
    // Legacy compat fields
    success: true, altText: '', provider: route.provider, model: route.apiModel, path: storagePath,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function makeErrorResponse(
  requestId: string, code: string, message: string, status: number,
  selectedModelId: string, route: ModelRoute | null, details: Record<string, unknown> = {},
): Response {
  return new Response(JSON.stringify({
    ok: false, requestId, code, message, error: message,
    selectedModelId,
    selectedModelLabel: route?.label || 'unknown',
    actualProviderUsed: route?.provider || 'unknown',
    actualModelUsed: route?.apiModel || 'unknown',
    routeKey: selectedModelId,
    details,
  }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ═══════════════════════════════════════════════════════════════
// Image generation via Vertex AI (Gemini multimodal)
// ═══════════════════════════════════════════════════════════════
async function generateImageVertexGemini(
  prompt: string, vertexModel: string, requestId: string,
): Promise<{ base64: string; mimeType: string }> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('ENV_MISSING:GCP_PROJECT_ID');

  let accessToken: string;
  try {
    accessToken = await getVertexAccessToken();
  } catch (e) {
    throw new Error(`VERTEX_AUTH_FAILED:${e instanceof Error ? e.message : 'unknown'}`);
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}:generateContent`;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150_000);

    try {
      console.log(`[${requestId}] Vertex Gemini attempt ${attempt + 1}/${maxRetries + 1}`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseModalities: ['IMAGE', 'TEXT'] },
        }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const retryAfterMs = getRetryAfterMs(resp);
        await resp.text(); // consume body
        if (attempt < maxRetries) {
          const waitMs = retryAfterMs ?? Math.min(5000 * Math.pow(2, attempt), 45_000);
          console.warn(`[${requestId}] Vertex rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error('VERTEX_RATE_LIMITED');
      }

      if (!resp.ok) {
        const errText = await resp.text();
        if (resp.status === 403) throw new Error(`VERTEX_ACCESS_DENIED:${errText.substring(0, 200)}`);
        if (resp.status >= 500 && attempt < maxRetries) {
          const waitMs = Math.min(4000 * Math.pow(2, attempt), 30_000);
          console.warn(`[${requestId}] Vertex ${resp.status}, retry ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(`VERTEX_API_ERROR:${resp.status}:${errText.substring(0, 200)}`);
      }

      let data: any;
      try {
        data = await resp.json();
      } catch {
        throw new Error('VERTEX_INVALID_JSON');
      }

      // Defensive Gemini response parsing
      const candidates = data?.candidates;
      if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) throw new Error(`GEMINI_BLOCKED:${blockReason}`);
        throw new Error('GEMINI_NO_CANDIDATES');
      }

      const parts = candidates[0]?.content?.parts;
      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        const finishReason = candidates[0]?.finishReason;
        throw new Error(`GEMINI_NO_PARTS:finishReason=${finishReason || 'unknown'}`);
      }

      for (const part of parts) {
        if (part?.inlineData && typeof part.inlineData === 'object' && part.inlineData.data) {
          const mime = part.inlineData.mimeType;
          if (!mime || typeof mime !== 'string') {
            console.warn(`[${requestId}] inlineData missing mimeType, defaulting to image/png`);
          }
          return { base64: part.inlineData.data, mimeType: mime || 'image/png' };
        }
      }

      // Model returned text but no image
      throw new Error('MODEL_RETURNED_NO_IMAGE');
    } catch (err) {
      if (isAbortError(err)) {
        if (attempt < maxRetries) {
          const waitMs = Math.min(6000 * (attempt + 1), 20_000);
          console.warn(`[${requestId}] Vertex timed out, retry ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error('VERTEX_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('VERTEX_EXHAUSTED_RETRIES');
}

// ═══════════════════════════════════════════════════════════════
// Image generation via Vertex AI Imagen
// ═══════════════════════════════════════════════════════════════
async function generateImageVertexImagen(
  prompt: string, requestId: string,
): Promise<{ base64: string; mimeType: string }> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('ENV_MISSING:GCP_PROJECT_ID');

  let accessToken: string;
  try {
    accessToken = await getVertexAccessToken();
  } catch (e) {
    throw new Error(`VERTEX_AUTH_FAILED:${e instanceof Error ? e.message : 'unknown'}`);
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    try {
      console.log(`[${requestId}] Vertex Imagen attempt ${attempt + 1}/${maxRetries + 1}`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'allow_adult' },
        }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        await resp.text();
        if (attempt < maxRetries) {
          const retryAfterMs = getRetryAfterMs(resp);
          const waitMs = retryAfterMs ?? Math.min(6000 * Math.pow(2, attempt), 45_000);
          console.warn(`[${requestId}] Imagen rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error('VERTEX_RATE_LIMITED');
      }

      if (!resp.ok) {
        const errText = await resp.text();
        if (resp.status >= 500 && attempt < maxRetries) {
          const waitMs = Math.min(5000 * Math.pow(2, attempt), 30_000);
          console.warn(`[${requestId}] Imagen ${resp.status}, retry ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(`IMAGEN_API_ERROR:${resp.status}:${errText.substring(0, 200)}`);
      }

      let data: any;
      try {
        data = await resp.json();
      } catch {
        throw new Error('IMAGEN_INVALID_JSON');
      }

      const predictions = data?.predictions;
      if (!predictions || !Array.isArray(predictions) || predictions.length === 0 || !predictions[0]?.bytesBase64Encoded) {
        throw new Error('MODEL_RETURNED_NO_IMAGE');
      }

      return { base64: predictions[0].bytesBase64Encoded, mimeType: predictions[0].mimeType || 'image/png' };
    } catch (err) {
      if (isAbortError(err)) {
        if (attempt < maxRetries) {
          const waitMs = Math.min(7000 * (attempt + 1), 20_000);
          console.warn(`[${requestId}] Imagen timed out, retry ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error('VERTEX_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('VERTEX_EXHAUSTED_RETRIES');
}

// ═══════════════════════════════════════════════════════════════
// Image generation via Lovable AI Gateway
// ═══════════════════════════════════════════════════════════════
async function generateImageLovableGateway(
  prompt: string, gatewayModel: string, requestId: string,
): Promise<{ base64: string; mimeType: string }> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) throw new Error('ENV_MISSING:LOVABLE_API_KEY');

  console.log(`[${requestId}] Gateway call start, model=${gatewayModel}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429) throw new Error('GATEWAY_RATE_LIMITED');
      if (resp.status === 402) throw new Error('GATEWAY_PAYMENT_REQUIRED');
      throw new Error(`GATEWAY_API_ERROR:${resp.status}:${errText.substring(0, 200)}`);
    }

    const rawText = await resp.text();
    if (!rawText || rawText.trim().length === 0) throw new Error('GATEWAY_EMPTY_RESPONSE');

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error('GATEWAY_INVALID_JSON');
    }

    const choice = data?.choices?.[0]?.message;
    if (!choice) throw new Error('GATEWAY_NO_CHOICE');

    // Try images array first
    if (choice.images && Array.isArray(choice.images) && choice.images.length > 0) {
      for (const img of choice.images) {
        if (!img) continue;
        const imgUrl = img?.image_url?.url || img?.url || '';
        if (imgUrl.startsWith('data:')) {
          const match = imgUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/s);
          if (match) return { base64: match[2], mimeType: match[1] };
        } else if (imgUrl.startsWith('http')) {
          console.log(`[${requestId}] Downloading external image URL`);
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) {
            const arrBuf = await imgResp.arrayBuffer();
            const bytes = new Uint8Array(arrBuf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            return { base64: btoa(binary), mimeType: imgResp.headers.get('content-type') || 'image/png' };
          }
          console.warn(`[${requestId}] External image download failed: ${imgResp.status}`);
        }
      }
    }

    throw new Error('MODEL_RETURNED_NO_IMAGE');
  } catch (err) {
    if (isAbortError(err)) throw new Error('GATEWAY_TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════
// Validate env vars for a specific provider
// ═══════════════════════════════════════════════════════════════
function validateProviderEnv(provider: string): string | null {
  if (provider === 'vertex-ai') {
    if (!Deno.env.get('GCP_PROJECT_ID')) return 'GCP_PROJECT_ID not configured';
    if (!Deno.env.get('GCP_CLIENT_EMAIL')) return 'GCP_CLIENT_EMAIL not configured';
    if (!Deno.env.get('GCP_PRIVATE_KEY')) return 'GCP_PRIVATE_KEY not configured';
    return null;
  }
  if (provider === 'lovable-gateway') {
    if (!Deno.env.get('LOVABLE_API_KEY')) return 'LOVABLE_API_KEY not configured';
    return null;
  }
  return `Unknown provider: ${provider}`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER — fully wrapped, every path returns structured JSON
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const requestId = generateRequestId();
  let selectedModelId = 'unknown';
  let route: ModelRoute | null = null;

  try {
    console.log(`[${requestId}] Request received`);

    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return makeErrorResponse(requestId, 'UNAUTHORIZED', 'Missing or invalid Authorization header', 401, selectedModelId, null);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return makeErrorResponse(requestId, 'ENV_MISSING', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured', 500, selectedModelId, null);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');

    let userId: string;
    try {
      const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
      if (authErr || !user) {
        return makeErrorResponse(requestId, 'INVALID_TOKEN', 'Authentication failed', 401, selectedModelId, null);
      }
      userId = user.id;
    } catch (authEx) {
      return makeErrorResponse(requestId, 'AUTH_ERROR', 'Authentication service error', 500, selectedModelId, null);
    }

    const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return makeErrorResponse(requestId, 'FORBIDDEN', 'Admin access required', 403, selectedModelId, null);
    }

    // ── Parse request body ──
    let body: any;
    try {
      body = await req.json();
    } catch {
      return makeErrorResponse(requestId, 'INVALID_BODY', 'Request body is not valid JSON', 400, selectedModelId, null);
    }

    console.log(`[${requestId}] Body parsed`);

    const { slug, title, category, subject, resourceType, imageModel } = body || {};
    if (!slug || typeof slug !== 'string') {
      return makeErrorResponse(requestId, 'MISSING_SLUG', 'slug is required', 400, selectedModelId, null);
    }
    if (!title || typeof title !== 'string') {
      return makeErrorResponse(requestId, 'MISSING_TITLE', 'title is required', 400, selectedModelId, null);
    }

    // ── Resolve model ──
    selectedModelId = imageModel || 'gemini-flash-image-2';
    route = MODEL_REGISTRY[selectedModelId] || null;

    if (!route) {
      return makeErrorResponse(requestId, 'UNSUPPORTED_MODEL', `Model "${selectedModelId}" is not supported. Valid: ${Object.keys(MODEL_REGISTRY).join(', ')}`, 400, selectedModelId, null);
    }

    console.log(`[${requestId}] Model resolved: ${selectedModelId} → ${route.provider}/${route.apiModel}`);

    // ── Validate provider env ──
    const envError = validateProviderEnv(route.provider);
    if (envError) {
      return makeErrorResponse(requestId, 'PROVIDER_NOT_CONFIGURED', envError, 500, selectedModelId, route);
    }

    console.log(`[${requestId}] Provider env validated`);

    // ── Build prompt ──
    const typeLabels: Record<string, string> = {
      sample_paper: 'Sample Paper', book: 'Study Book', previous_year_paper: 'Previous Year Paper', guide: 'Study Guide',
    };
    const typeLabel = typeLabels[resourceType] || 'Educational Resource';
    const imagePrompt = `Create a realistic, high-quality cover image for an Indian government exam ${typeLabel} titled "${title}".${category ? ` Category: ${category}.` : ''}${subject ? ` Subject: ${subject}.` : ''} The image should show fair-skinned young Indian men and women (age 20-25) in a study/exam preparation setting — studying together at a desk, looking focused and confident. Include relevant visual elements like books, notebooks, pens, and a subtle Indian educational context. Professional photography style, warm natural lighting, clean composition. Landscape format 1200x630 pixels. Do NOT include any text overlays, official logos, emblems, or seals.`;

    // ── Call provider (strict routing, no fallback) ──
    console.log(`[${requestId}] Provider call start: ${route.provider}`);
    let imageBase64: string;
    let mimeType: string;
    const warnings: string[] = [];

    try {
      if (route.provider === 'vertex-ai') {
        if (route.vertexEndpoint === 'imagen') {
          const result = await generateImageVertexImagen(imagePrompt, requestId);
          imageBase64 = result.base64;
          mimeType = result.mimeType;
        } else {
          const result = await generateImageVertexGemini(imagePrompt, route.apiModel, requestId);
          imageBase64 = result.base64;
          mimeType = result.mimeType;
        }
      } else if (route.provider === 'lovable-gateway') {
        const result = await generateImageLovableGateway(imagePrompt, route.apiModel, requestId);
        imageBase64 = result.base64;
        mimeType = result.mimeType;
      } else {
        return makeErrorResponse(requestId, 'MODEL_ROUTE_MISMATCH', `Provider "${route.provider}" has no dispatch handler`, 500, selectedModelId, route);
      }
    } catch (providerErr: any) {
      const errMsg = providerErr instanceof Error ? providerErr.message : 'Unknown provider error';
      console.error(`[${requestId}] Provider error: ${errMsg}`);

      // Map known error codes to HTTP statuses
      if (errMsg === 'VERTEX_RATE_LIMITED' || errMsg === 'GATEWAY_RATE_LIMITED') {
        return makeErrorResponse(requestId, errMsg, `${route.provider} rate limit exceeded`, 429, selectedModelId, route);
      }
      if (errMsg === 'GATEWAY_PAYMENT_REQUIRED') {
        return makeErrorResponse(requestId, 'GATEWAY_PAYMENT_REQUIRED', 'AI credits exhausted — add funds in Settings → Workspace → Usage', 402, selectedModelId, route);
      }
      if (errMsg === 'VERTEX_TIMEOUT' || errMsg === 'GATEWAY_TIMEOUT') {
        return makeErrorResponse(requestId, errMsg, 'Request timed out after retries', 504, selectedModelId, route);
      }
      if (errMsg.startsWith('VERTEX_AUTH_FAILED')) {
        return makeErrorResponse(requestId, 'VERTEX_AUTH_FAILED', 'Failed to authenticate with Vertex AI', 500, selectedModelId, route);
      }
      if (errMsg.startsWith('VERTEX_ACCESS_DENIED')) {
        return makeErrorResponse(requestId, 'VERTEX_ACCESS_DENIED', 'Vertex AI access denied — check GCP permissions', 403, selectedModelId, route);
      }
      if (errMsg.startsWith('GEMINI_BLOCKED')) {
        return makeErrorResponse(requestId, 'GEMINI_BLOCKED', `Content blocked by safety filter: ${errMsg.split(':')[1] || 'unknown'}`, 422, selectedModelId, route);
      }
      if (errMsg === 'GEMINI_NO_CANDIDATES' || errMsg.startsWith('GEMINI_NO_PARTS')) {
        return makeErrorResponse(requestId, 'GEMINI_BAD_RESPONSE', `Gemini returned no usable content: ${errMsg}`, 422, selectedModelId, route);
      }
      if (errMsg === 'MODEL_RETURNED_NO_IMAGE') {
        return makeErrorResponse(requestId, 'MODEL_RETURNED_NO_IMAGE', 'AI model returned text but no image — retry or try a different model', 422, selectedModelId, route);
      }
      if (errMsg.startsWith('ENV_MISSING')) {
        return makeErrorResponse(requestId, 'ENV_MISSING', errMsg, 500, selectedModelId, route);
      }
      // Generic provider error
      return makeErrorResponse(requestId, 'PROVIDER_ERROR', errMsg.substring(0, 300), 500, selectedModelId, route);
    }

    console.log(`[${requestId}] Image extraction success, mimeType=${mimeType}, base64Length=${imageBase64.length}`);

    // ── Decode base64 (guarded) ──
    let imageBytes: Uint8Array;
    try {
      imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    } catch (decodeErr) {
      console.error(`[${requestId}] Base64 decode failed`);
      return makeErrorResponse(requestId, 'IMAGE_DECODE_FAILED', 'Failed to decode image data from AI response', 500, selectedModelId, route);
    }

    // ── Upload to storage ──
    console.log(`[${requestId}] Storage upload start`);
    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const filePath = `resource-covers/${slug}-cover.${ext}`;
    const blob = new Blob([imageBytes], { type: mimeType });

    const { error: uploadError } = await adminClient.storage.from('blog-assets').upload(filePath, blob, { contentType: mimeType, upsert: true });
    if (uploadError) {
      console.error(`[${requestId}] Storage upload failed: ${uploadError.message}`);
      return makeErrorResponse(requestId, 'STORAGE_UPLOAD_FAILED', `Failed to upload image: ${uploadError.message}`, 500, selectedModelId, route);
    }

    const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);
    if (!urlData?.publicUrl) {
      return makeErrorResponse(requestId, 'STORAGE_URL_FAILED', 'Failed to generate public URL for uploaded image', 500, selectedModelId, route);
    }

    console.log(`[${requestId}] Complete — imageUrl=${urlData.publicUrl}`);

    return makeSuccessResponse(requestId, route, selectedModelId, urlData.publicUrl, filePath, mimeType, warnings);
  } catch (outerErr) {
    // Absolute last-resort catch — should never happen but guarantees no raw crash
    const message = outerErr instanceof Error ? outerErr.message : 'Unknown internal error';
    console.error(`[${requestId}] UNHANDLED: ${message}`);
    return makeErrorResponse(requestId, 'INTERNAL_ERROR', message.substring(0, 300), 500, selectedModelId, route);
  }
});
