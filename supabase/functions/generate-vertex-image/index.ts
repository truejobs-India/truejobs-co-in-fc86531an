/**
 * generate-vertex-image — Image generation via Imagen (Vertex AI) or Gemini 2.5 Flash Image (Lovable AI Gateway).
 * 
 * Routes based on `body.purpose` (enforced) or `body.model` (backward compat):
 *   - purpose: "cover"  → forces Gemini Flash Image (gemini-2.5-flash-image)
 *   - purpose: "inline" → forces Imagen via Vertex AI
 *   - no purpose        → routes by body.model (backward compatible)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { awsSigV4Fetch } from '../_shared/bedrock-nova.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const IMAGEN_MODEL = Deno.env.get('VERTEX_IMAGEN_MODEL') || 'imagen-4.0-generate-001';
const GEMINI_IMAGE_MODEL = Deno.env.get('VERTEX_GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image';
const LOVABLE_GATEWAY_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';

// Map UI model keys → Lovable Gateway model IDs
const GATEWAY_IMAGE_MODELS: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
  'gemini-flash-image-2': 'google/gemini-3.1-flash-image-preview',
  // vertex-3.1-flash-image intentionally excluded — routes via direct Vertex AI path
  'vertex-3-pro-image': '__vertex_direct__',
};
// Must stay aligned with image-capable models in src/lib/aiModels.ts
const KNOWN_IMAGE_MODEL_KEYS = new Set([
  ...Object.keys(GATEWAY_IMAGE_MODELS),
  'vertex-imagen',
  'vertex-3-pro-image',
  'vertex-3.1-flash-image',
  'vertex-pro', // has image capability in aiModels.ts
  'vertex-flash-image', // Gemini 2.5 Flash Image via direct Vertex AI
  'nova-canvas', // Amazon Nova Canvas via Bedrock InvokeModel
]);

const IMAGEN_TIMEOUT_MS = 120_000;
const GATEWAY_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 5000; // 5s, 10s, 20s, 40s, 80s exponential backoff

// ── Strict mode helpers ──

interface StrictMeta {
  selectedModelKey: string;
  resolvedProvider?: string;
  resolvedRuntimeModelId?: string;
}

function buildStrictErrorResponse(status: number, error: string, meta: StrictMeta): Response {
  return new Response(JSON.stringify({
    success: false,
    error,
    strict: true,
    noFallbackUsed: true,
    selectedModelKey: meta.selectedModelKey,
    resolvedProvider: meta.resolvedProvider || 'unknown',
    resolvedRuntimeModelId: meta.resolvedRuntimeModelId || 'unknown',
  }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function addStrictMetadata(responseBody: Record<string, unknown>, meta: StrictMeta & { strict: boolean }): Record<string, unknown> {
  if (!meta.strict) return responseBody;
  return {
    ...responseBody,
    selectedModelKey: meta.selectedModelKey,
    resolvedProvider: meta.resolvedProvider || 'unknown',
    resolvedRuntimeModelId: meta.resolvedRuntimeModelId || 'unknown',
    strict: true,
  };
}

const ASPECT_RATIOS: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '4:3': '4:3',
  '3:2': '3:4',
  '9:16': '9:16',
};

// ═══════════════════════════════════════════════════════════════
// GOOGLE AUTH (for Imagen / Vertex AI)
// ═══════════════════════════════════════════════════════════════

function base64url(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getVertexAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('GCP_CLIENT_EMAIL');
  const privateKeyPem = Deno.env.get('GCP_PRIVATE_KEY');
  if (!clientEmail || !privateKeyPem) throw new Error('GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY secrets are required');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const keyPem = privateKeyPem.replace(/\\n/g, '\n');
  const pemBody = keyPem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsignedToken));
  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Google OAuth failed (${tokenResp.status}): ${errText.substring(0, 300)}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

// ═══════════════════════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request): Promise<{ userId: string; adminClient: any } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = data.claims.sub as string;
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await adminClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden — admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId, adminClient };
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDERS — delegated to shared policy (single source of truth)
// ═══════════════════════════════════════════════════════════════
import { buildBlogCoverPrompt, buildBlogInlinePrompt } from '../_shared/blog-image-prompt-policy.ts';

// Local aliases so call-sites don't need renaming everywhere
const buildCoverImagePrompt = (body: any) => buildBlogCoverPrompt(body);
const buildInlineImagePrompt = (body: any) => buildBlogInlinePrompt(body);

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

function getRetryDelayFromResponse(resp: Response, attempt: number): number {
  const retryAfterHeader = resp.headers.get('retry-after');
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 30_000);
  }
  return RETRY_BASE_MS * Math.pow(2, attempt - 1);
}

function uploadGeneratedImage(params: {
  adminClient: any;
  imageBase64: string;
  mimeType: string;
  filePath: string;
}): Promise<{ publicUrl: string } | Response> {
  const { adminClient, imageBase64, mimeType, filePath } = params;

  return (async () => {
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const blob = new Blob([imageBytes], { type: mimeType });

    const { error: uploadError } = await adminClient.storage
      .from('blog-assets')
      .upload(filePath, blob, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`[image-upload] upload error for ${filePath}:`, uploadError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to upload generated image', detail: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);
    return { publicUrl: urlData.publicUrl };
  })();
}

// ═══════════════════════════════════════════════════════════════
// GEMINI FLASH IMAGE — via Vertex AI (direct)
// ═══════════════════════════════════════════════════════════════

async function generateViaGeminiFlashImage(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  strict = false,
): Promise<Response> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) {
    return new Response(JSON.stringify({ success: false, error: 'GCP_PROJECT_ID not configured', model: GEMINI_IMAGE_MODEL }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const purpose = body.purpose || 'cover';
  console.log(`[gemini-flash-image] slug=${slug} model=${GEMINI_IMAGE_MODEL} purpose=${purpose} via=vertex-ai-direct`);

  let accessToken: string;
  try {
    accessToken = await getVertexAccessToken();
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: `Auth failed: ${e.message}`, model: GEMINI_IMAGE_MODEL }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${GEMINI_IMAGE_MODEL}:generateContent`;

  {
    let resp: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = getRetryDelayFromResponse(resp!, attempt);
        console.log(`[gemini-flash-image] 429 retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGEN_TIMEOUT_MS);
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT'],
              temperature: 0.8,
              maxOutputTokens: 8192,
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          }),
        });
      } catch (fetchErr: any) {
        clearTimeout(timer);
        const isTimeout = fetchErr?.name === 'AbortError';
        console.error(`[gemini-flash-image] ${isTimeout ? 'timeout' : 'fetch error'} on attempt ${attempt}: ${fetchErr.message}`);
        if (strict) {
          return buildStrictErrorResponse(isTimeout ? 504 : 502, `Vertex AI ${isTimeout ? 'timeout' : 'fetch error'}: ${fetchErr.message}. No fallback was used.`, { selectedModelKey: 'gemini-flash-image', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: GEMINI_IMAGE_MODEL });
        }
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, isTimeout ? 'vertex-timeout' : 'vertex-fetch-error');
      } finally {
        clearTimeout(timer);
      }
      if (resp.status !== 429) break;
      if (attempt === MAX_RETRIES) {
        const errText = await resp.text();
        console.error(`[gemini-flash-image] 429 exhausted retries: ${errText.substring(0, 200)}`);
        if (strict) {
          return buildStrictErrorResponse(429, `Vertex AI rate-limited after ${MAX_RETRIES} retries. No fallback was used.`, { selectedModelKey: 'gemini-flash-image', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: GEMINI_IMAGE_MODEL });
        }
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, 'vertex-429');
      }
    }

    if (!resp!.ok) {
      const errText = await resp!.text();
      console.error(`[gemini-flash-image] Vertex error [${resp!.status}]: ${errText.substring(0, 300)}`);
      if (resp!.status === 429) {
        if (strict) {
          return buildStrictErrorResponse(429, `Vertex AI rate-limited. No fallback was used.`, { selectedModelKey: 'gemini-flash-image', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: GEMINI_IMAGE_MODEL });
        }
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, 'vertex-429');
      }
      return new Response(JSON.stringify({ success: false, error: `Vertex AI error (${resp!.status}): ${errText.substring(0, 200)}`, model: GEMINI_IMAGE_MODEL }),
        { status: resp!.status >= 400 && resp!.status < 500 ? resp!.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp!.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    const parts = candidate?.content?.parts || [];

    console.log(`[gemini-flash-image] finishReason=${finishReason} partsCount=${parts.length} slug=${slug}`);

    let imageBase64 = '';
    let mimeType = 'image/png';
    let altText = body.title || body.topic || `Blog image for ${slug}`;

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
      } else if (part.text && part.text.trim().length > 10 && part.text.trim().length < 200) {
        altText = part.text.trim();
      }
    }

    if (!imageBase64) {
      const safetyRatings = candidate?.safetyRatings || data?.promptFeedback?.safetyRatings || [];
      const blockedReason = data?.promptFeedback?.blockReason || '';
      const textPreview = parts
        .map((part: any) => (typeof part?.text === 'string' ? part.text.trim() : ''))
        .filter(Boolean)
        .join(' ')
        .slice(0, 240);
      console.error(`[gemini-flash-image] No image data. finishReason=${finishReason} blockReason=${blockedReason} textPreview=${textPreview} safetyRatings=${JSON.stringify(safetyRatings).substring(0, 300)}`);

      if (finishReason === 'STOP' && !body.__vertexImageRetry) {
        console.warn(`[gemini-flash-image] Retrying text-only STOP response with explicit image-only instruction for slug=${slug}`);
        return await generateViaGeminiFlashImage(
          { ...body, __vertexImageRetry: true },
          slug,
          `${imagePrompt}\n\nCRITICAL: Return one generated image in the response. Do not return a text-only answer.`,
          adminClient,
          startMs,
          strict,
        );
      }

      return new Response(JSON.stringify({
        success: false,
        error: finishReason === 'SAFETY'
          ? 'Image generation blocked by safety filter. Try a different topic or rephrase.'
          : finishReason === 'MAX_TOKENS'
          ? 'Image generation exceeded token limit.'
          : `No image data returned (finishReason: ${finishReason}). The model returned text but no image.`,
        model: GEMINI_IMAGE_MODEL,
        finishReason,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isInlineFallback = body.purpose === 'inline';
    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const pathPrefix = isInlineFallback ? 'inline' : 'covers';
    const slotSuffix = isInlineFallback && body.slotNumber ? `-slot${body.slotNumber}` : '';
    const filePath = `${pathPrefix}/${slug}-gemini-flash${slotSuffix}.${ext}`;

    const uploadResult = await uploadGeneratedImage({ adminClient, imageBase64, mimeType, filePath });
    if (uploadResult instanceof Response) return uploadResult;

    const elapsed = Date.now() - startMs;
    console.log(`[gemini-flash-image] completed in ${elapsed}ms via Vertex AI`);

    const successBody = addStrictMetadata({
      success: true,
      data: {
        images: [{
          url: uploadResult.publicUrl,
          path: filePath,
          altText,
          mimeType,
          width: 1024,
          height: 1024,
        }],
        promptUsed: imagePrompt,
      },
      model: GEMINI_IMAGE_MODEL,
      action: 'generate-image',
      purpose,
      elapsedMs: elapsed,
    }, { strict, selectedModelKey: 'gemini-flash-image', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: GEMINI_IMAGE_MODEL });

    return new Response(JSON.stringify(successBody), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// ═══════════════════════════════════════════════════════════════
// VERTEX DIRECT IMAGE — gemini-3-pro-image-preview via Vertex AI
// ═══════════════════════════════════════════════════════════════

async function generateViaVertexDirectImage(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  vertexModelId: string,
): Promise<Response> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) {
    return new Response(JSON.stringify({ success: false, error: 'GCP_PROJECT_ID not configured', model: vertexModelId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[vertex-direct-image] slug=${slug} model=${vertexModelId} via=vertex-ai-direct`);

  let accessToken: string;
  try {
    accessToken = await getVertexAccessToken();
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: `Auth failed: ${e.message}`, model: vertexModelId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isGemini3 = vertexModelId.startsWith('gemini-3');
  const apiVersion = isGemini3 ? 'v1beta1' : 'v1';
  const loc = isGemini3 ? 'global' : location;
  const host = isGemini3 ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/${apiVersion}/projects/${projectId}/locations/${loc}/publishers/google/models/${vertexModelId}:generateContent`;
  console.log(`[vertex-direct-image] endpoint: ${url}`);

  let resp: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelayFromResponse(resp!, attempt);
      console.log(`[vertex-direct-image] 429 retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGEN_TIMEOUT_MS);
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 1.0, maxOutputTokens: 8192 },
        }),
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      const isTimeout = fetchErr.name === 'AbortError' || fetchErr.message?.includes('aborted');
      console.error(`[vertex-direct-image] fetch error (timeout=${isTimeout}): ${fetchErr.message}`);
      if (isTimeout) {
        return new Response(JSON.stringify({ success: false, error: 'Image generation timed out. The model took too long to respond. Please try again.', model: vertexModelId, timedOut: true }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: `Vertex fetch error: ${fetchErr.message}`, model: vertexModelId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } finally {
      clearTimeout(timer);
    }
    if (resp.status !== 429) break;
    if (attempt === MAX_RETRIES) {
      return new Response(JSON.stringify({ success: false, error: 'Rate limited after retries', model: vertexModelId }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  if (!resp!.ok) {
    const errText = await resp!.text();
    return new Response(JSON.stringify({ success: false, error: `Vertex AI error (${resp!.status}): ${errText.substring(0, 200)}`, model: vertexModelId }),
      { status: resp!.status >= 400 && resp!.status < 500 ? resp!.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const data = await resp!.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let imageBase64 = '';
  let mimeType = 'image/png';
  let altText = body.title || body.topic || `Blog image for ${slug}`;

  for (const part of parts) {
    if (part.inlineData?.data) { imageBase64 = part.inlineData.data; mimeType = part.inlineData.mimeType || 'image/png'; }
    else if (part.text && part.text.trim().length > 10 && part.text.trim().length < 200) { altText = part.text.trim(); }
  }

  if (!imageBase64) {
    return new Response(JSON.stringify({ success: false, error: 'No image data returned. Prompt may have been filtered.', model: vertexModelId }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isInline = body.purpose === 'inline';
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const pathPrefix = isInline ? 'inline' : 'covers';
  const slotSuffix = isInline && body.slotNumber ? `-slot${body.slotNumber}` : '';
  const filePath = `${pathPrefix}/${slug}-vertex3pro${slotSuffix}.${ext}`;

  const uploadResult = await uploadGeneratedImage({ adminClient, imageBase64, mimeType, filePath });
  if (uploadResult instanceof Response) return uploadResult;

  const elapsed = Date.now() - startMs;
  console.log(`[vertex-direct-image] completed in ${elapsed}ms model=${vertexModelId}`);

  return new Response(JSON.stringify({
    success: true,
    data: { images: [{ url: uploadResult.publicUrl, path: filePath, altText, mimeType, width: 1024, height: 1024 }], promptUsed: imagePrompt },
    model: vertexModelId,
    action: 'generate-image',
    purpose: body.purpose || 'cover',
    elapsedMs: elapsed,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


async function generateViaLovableGatewayImage(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  fallbackReason: string,
): Promise<Response> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: `Rate limited after ${MAX_RETRIES} retries and no secondary image provider is configured.`,
      model: GEMINI_IMAGE_MODEL,
    }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[lovable-gateway-image] fallback=${fallbackReason} slug=${slug} model=${LOVABLE_GATEWAY_IMAGE_MODEL}`);

  const gatewayController = new AbortController();
  const gatewayTimer = setTimeout(() => gatewayController.abort(), GATEWAY_TIMEOUT_MS);
  let gatewayResponse: Response;
  try {
    gatewayResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: gatewayController.signal,
      body: JSON.stringify({
        model: LOVABLE_GATEWAY_IMAGE_MODEL,
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image', 'text'],
      }),
    });
  } catch (fetchErr: any) {
    clearTimeout(gatewayTimer);
    const isTimeout = fetchErr?.name === 'AbortError';
    console.error(`[lovable-gateway-image] ${isTimeout ? 'timeout' : 'fetch error'}: ${fetchErr.message}`);
    return new Response(JSON.stringify({
      success: false,
      error: isTimeout
        ? 'Image generation timed out across all providers. Please try again or upload manually.'
        : `Image generation failed: ${fetchErr.message}`,
      code: isTimeout ? 'IMAGE_GEN_TEMP_UNAVAILABLE' : 'IMAGE_GEN_PROVIDER_ERROR',
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } finally {
    clearTimeout(gatewayTimer);
  }

  if (!gatewayResponse.ok) {
    const errText = await gatewayResponse.text();
    console.error(`[lovable-gateway-image] error [${gatewayResponse.status}]: ${errText.substring(0, 300)}`);

    let userMessage: string;
    let errorCode: string;

    if (gatewayResponse.status === 429) {
      userMessage = 'Image generation is temporarily busy across all providers. Please try again in a few minutes.';
      errorCode = 'IMAGE_GEN_TEMP_UNAVAILABLE';
    } else if (gatewayResponse.status === 402) {
      userMessage = 'All image generation providers are temporarily unavailable (quota exceeded). Please upload an image manually or try again later.';
      errorCode = 'IMAGE_GEN_QUOTA_EXCEEDED';
    } else {
      userMessage = 'Image generation failed across all providers. Please upload manually.';
      errorCode = 'IMAGE_GEN_PROVIDER_ERROR';
    }

    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      code: errorCode,
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawText = await gatewayResponse.text();
  if (!rawText?.trim()) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Secondary image provider returned an empty response.',
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error('[lovable-gateway-image] invalid JSON response:', rawText.substring(0, 300));
    return new Response(JSON.stringify({
      success: false,
      error: 'Secondary image provider returned invalid data.',
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const choice = data.choices?.[0]?.message;
  let imageBase64 = '';
  let mimeType = 'image/png';
  let altText = body.title || body.topic || `Blog image for ${slug}`;

  if (choice?.images?.length > 0) {
    for (const img of choice.images) {
      const imgUrl = img?.image_url?.url || img?.url || '';
      if (imgUrl.startsWith('data:')) {
        const match = imgUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
        if (match) {
          mimeType = match[1];
          imageBase64 = match[2];
          break;
        }
      } else if (imgUrl.startsWith('http')) {
        const imgResp = await fetch(imgUrl);
        if (imgResp.ok) {
          const arrBuf = await imgResp.arrayBuffer();
          const bytes = new Uint8Array(arrBuf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          imageBase64 = btoa(binary);
          mimeType = imgResp.headers.get('content-type') || 'image/png';
          break;
        }
      }
    }
  }

  if (choice?.content) {
    const text = typeof choice.content === 'string' ? choice.content.trim() : '';
    if (text.length > 10 && text.length < 200) altText = text;
  }

  if (!imageBase64) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Secondary image provider did not return usable image data.',
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isInline = body.purpose === 'inline';
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const pathPrefix = isInline ? 'inline' : 'covers';
  const slotSuffix = isInline && body.slotNumber ? `-slot${body.slotNumber}` : '';
  const filePath = `${pathPrefix}/${slug}-gateway${slotSuffix}.${ext}`;

  const uploadResult = await uploadGeneratedImage({ adminClient, imageBase64, mimeType, filePath });
  if (uploadResult instanceof Response) return uploadResult;

  const elapsed = Date.now() - startMs;
  console.log(`[lovable-gateway-image] completed in ${elapsed}ms via fallback=${fallbackReason}`);

  return new Response(JSON.stringify({
    success: true,
    data: {
      images: [{
        url: uploadResult.publicUrl,
        path: filePath,
        altText,
        mimeType,
        width: 1024,
        height: 1024,
      }],
      promptUsed: imagePrompt,
    },
    model: LOVABLE_GATEWAY_IMAGE_MODEL,
    action: 'generate-image',
    purpose: body.purpose || 'cover',
    elapsedMs: elapsed,
    fallbackReason,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


/** Variant that lets the caller choose which Lovable Gateway model to use */
async function generateViaLovableGatewayImageWithModel(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  fallbackReason: string,
  gatewayModelId: string,
): Promise<Response> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: `LOVABLE_API_KEY not configured — cannot use ${gatewayModelId}.`,
      model: gatewayModelId,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[lovable-gateway-image] model=${gatewayModelId} reason=${fallbackReason} slug=${slug}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: gatewayModelId,
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image', 'text'],
      }),
    });
  } catch (fetchErr: any) {
    clearTimeout(timer);
    const isTimeout = fetchErr?.name === 'AbortError';
    return new Response(JSON.stringify({
      success: false,
      error: isTimeout ? 'Image generation timed out.' : `Image generation failed: ${fetchErr.message}`,
      model: gatewayModelId,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`[lovable-gateway-image] error [${resp.status}]: ${errText.substring(0, 300)}`);
    return new Response(JSON.stringify({
      success: false,
      error: `Gateway error (${resp.status}): ${errText.substring(0, 200)}`,
      model: gatewayModelId,
    }), { status: resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const data = await resp.json();
  const choice = data.choices?.[0]?.message;
  let imageBase64 = '';
  let mimeType = 'image/png';
  let altText = body.title || body.topic || `Blog image for ${slug}`;

  if (choice?.images?.length > 0) {
    for (const img of choice.images) {
      const imgUrl = img?.image_url?.url || img?.url || '';
      if (imgUrl.startsWith('data:')) {
        const match = imgUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
        if (match) { mimeType = match[1]; imageBase64 = match[2]; break; }
      } else if (imgUrl.startsWith('http')) {
        const imgResp = await fetch(imgUrl);
        if (imgResp.ok) {
          const arrBuf = await imgResp.arrayBuffer();
          const bytes = new Uint8Array(arrBuf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          imageBase64 = btoa(binary);
          mimeType = imgResp.headers.get('content-type') || 'image/png';
          break;
        }
      }
    }
  }

  if (choice?.content) {
    const text = typeof choice.content === 'string' ? choice.content.trim() : '';
    if (text.length > 10 && text.length < 200) altText = text;
  }

  if (!imageBase64) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No usable image data returned from gateway.',
      model: gatewayModelId,
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isInline = body.purpose === 'inline';
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const pathPrefix = isInline ? 'inline' : 'covers';
  const modelTag = gatewayModelId.replace(/[^a-z0-9]/gi, '-').substring(0, 20);
  const slotSuffix = isInline && body.slotNumber ? `-slot${body.slotNumber}` : '';
  const filePath = `${pathPrefix}/${slug}-${modelTag}${slotSuffix}.${ext}`;

  const uploadResult = await uploadGeneratedImage({ adminClient, imageBase64, mimeType, filePath });
  if (uploadResult instanceof Response) return uploadResult;

  const elapsed = Date.now() - startMs;
  console.log(`[lovable-gateway-image] completed in ${elapsed}ms model=${gatewayModelId}`);

  return new Response(JSON.stringify({
    success: true,
    data: {
      images: [{ url: uploadResult.publicUrl, path: filePath, altText, mimeType, width: 1024, height: 1024 }],
      promptUsed: imagePrompt,
    },
    model: gatewayModelId,
    action: 'generate-image',
    purpose: body.purpose || 'cover',
    elapsedMs: elapsed,
    fallbackReason,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


// ═══════════════════════════════════════════════════════════════
// IMAGEN — via Vertex AI
// ═══════════════════════════════════════════════════════════════

async function generateViaImagen(
  body: any,
  slug: string,
  imagePrompt: string,
  imageCount: number,
  aspectRatio: string,
  adminClient: any,
  startMs: number,
  strict = false,
): Promise<Response> {
  const purpose = body.purpose || 'unspecified';
  const slotNumber = body.slotNumber || 0;
  console.log(`[vertex-imagen] slug=${slug} count=${imageCount} ratio=${aspectRatio} model=${IMAGEN_MODEL} purpose=${purpose} slot=${slotNumber}`);

  const accessToken = await getVertexAccessToken();
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID secret is required');

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${IMAGEN_MODEL}:predict`;

  let predictions: any[];
  let last429Response: Response | null = null;
  {
    let resp: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = getRetryDelayFromResponse(last429Response ?? resp!, attempt);
        console.log(`[vertex-imagen] 429 retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGEN_TIMEOUT_MS);
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            instances: [{ prompt: imagePrompt }],
            parameters: {
              sampleCount: imageCount,
              aspectRatio,
              personGeneration: 'dont_allow',
              safetySetting: 'block_few',
              addWatermark: false,
            },
          }),
        });
      } catch (fetchErr: any) {
        clearTimeout(timer);
        const isTimeout = fetchErr?.name === 'AbortError';
        console.error(`[vertex-imagen] ${isTimeout ? 'timeout' : 'fetch error'} on attempt ${attempt}: ${fetchErr.message}`);
        if (strict) {
          return buildStrictErrorResponse(isTimeout ? 504 : 502, `Imagen ${isTimeout ? 'timeout' : 'fetch error'}: ${fetchErr.message}. No fallback was used.`, { selectedModelKey: 'vertex-imagen', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: IMAGEN_MODEL });
        }
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, isTimeout ? 'imagen-timeout' : 'imagen-fetch-error');
      } finally {
        clearTimeout(timer);
      }
      if (resp.status !== 429) break;
      last429Response = resp;
      if (attempt === MAX_RETRIES) {
        const errText = await resp.text();
        console.error(`[vertex-imagen] 429 exhausted retries: ${errText.substring(0, 200)}`);
        if (strict) {
          return buildStrictErrorResponse(429, `Imagen rate-limited after ${MAX_RETRIES} retries. No fallback was used.`, { selectedModelKey: 'vertex-imagen', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: IMAGEN_MODEL });
        }
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, 'imagen-429');
      }
    }

    if (!resp!.ok) {
      const errText = await resp!.text();
      throw new Error(`Imagen API error (${resp!.status}): ${errText.substring(0, 500)}`);
    }

    const data = await resp!.json();
    predictions = data.predictions || [];
  }

  if (!predictions.length) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No images generated. The prompt may have been filtered by safety settings.',
      model: IMAGEN_MODEL,
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const images: Array<{ url: string; path: string; altText: string; mimeType: string; width: number; height: number }> = [];

  // Determine upload path based on purpose
  const isInline = purpose === 'inline';
  const pathPrefix = isInline ? 'inline' : 'covers';

  for (let i = 0; i < predictions.length; i++) {
    const prediction = predictions[i];
    const base64Data = prediction.bytesBase64Encoded;
    const mimeType = prediction.mimeType || 'image/png';

    if (!base64Data) {
      console.warn(`[vertex-imagen] prediction ${i} has no image data (likely safety-filtered)`);
      continue;
    }

    // Decode and validate image bytes
    let imageBytes: Uint8Array;
    try {
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      if (imageBytes.length < 100) {
        console.warn(`[vertex-imagen] prediction ${i} has suspiciously small image (${imageBytes.length} bytes)`);
        continue;
      }
    } catch (decodeErr) {
      console.error(`[vertex-imagen] prediction ${i} base64 decode failed:`, decodeErr);
      continue;
    }

    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const suffix = isInline && slotNumber
      ? `-slot${slotNumber}`
      : (predictions.length > 1 ? `-${i + 1}` : '');
    const filePath = `${pathPrefix}/${slug}-vertex${suffix}.${ext}`;

    const blob = new Blob([imageBytes], { type: mimeType });

    const { error: uploadError } = await adminClient.storage
      .from('blog-assets')
      .upload(filePath, blob, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`[vertex-imagen] upload error for ${filePath}:`, uploadError);
      continue;
    }

    const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);

    images.push({
      url: urlData.publicUrl,
      path: filePath,
      altText: body.title || body.topic || `Blog image for ${slug}`,
      mimeType,
      width: aspectRatio === '16:9' ? 1280 : aspectRatio === '4:3' ? 1024 : aspectRatio === '1:1' ? 1024 : 1200,
      height: aspectRatio === '16:9' ? 720 : aspectRatio === '4:3' ? 768 : aspectRatio === '1:1' ? 1024 : 900,
    });
  }

  if (!images.length) {
    const hadImageData = predictions.some(p => p.bytesBase64Encoded);
    if (hadImageData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Images generated but all uploads to storage failed. Check storage bucket permissions.',
        model: IMAGEN_MODEL,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Safety-filtered: fallback to Gemini Flash Image (blocked in strict mode)
    if (strict) {
      return buildStrictErrorResponse(422, 'All images were safety-filtered by Imagen. No fallback was used.', { selectedModelKey: 'vertex-imagen', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: IMAGEN_MODEL });
    }
    console.log(`[vertex-imagen] Safety-filtered, falling back to Gemini Flash Image for slug=${slug}`);
    return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);
  }

  const elapsed = Date.now() - startMs;
  console.log(`[vertex-imagen] completed in ${elapsed}ms, ${images.length} images uploaded, purpose=${purpose}`);

  const successBody = addStrictMetadata({
    success: true,
    data: { images, promptUsed: imagePrompt },
    model: IMAGEN_MODEL,
    action: 'generate-image',
    purpose,
    slotNumber,
    elapsedMs: elapsed,
  }, { strict, selectedModelKey: 'vertex-imagen', resolvedProvider: 'vertex-ai-direct', resolvedRuntimeModelId: IMAGEN_MODEL });

  return new Response(JSON.stringify(successBody), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ═══════════════════════════════════════════════════════════════
// AMAZON NOVA CANVAS — via Bedrock InvokeModel API
// ═══════════════════════════════════════════════════════════════

const NOVA_CANVAS_MODEL_ID = 'amazon.nova-canvas-v1:0';

const NOVA_CANVAS_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '4:3':  { width: 1024, height: 768 },
  '3:4':  { width: 768,  height: 1024 },
  '9:16': { width: 720,  height: 1280 },
};

async function generateViaNovaCanvas(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  strict: boolean,
): Promise<Response> {
  const meta: StrictMeta = {
    selectedModelKey: 'nova-canvas',
    resolvedProvider: 'bedrock',
    resolvedRuntimeModelId: NOVA_CANVAS_MODEL_ID,
  };

  // ── Resolve aspect ratio ──
  const requestedRatio = body.aspectRatio || '16:9';
  // Map ASPECT_RATIOS value (e.g. '3:2' → '3:4') then resolve to Nova Canvas dims
  const mappedRatio = ASPECT_RATIOS[requestedRatio] || requestedRatio;
  const dims = NOVA_CANVAS_DIMENSIONS[mappedRatio];
  if (!dims) {
    return buildStrictErrorResponse(400,
      `Unsupported aspect ratio "${requestedRatio}" for Nova Canvas. Supported: ${Object.keys(NOVA_CANVAS_DIMENSIONS).join(', ')}`,
      meta);
  }

  const purpose = body.purpose || 'cover';
  const slotNumber = body.slotNumber;
  console.log(`[nova-canvas] slug=${slug} purpose=${purpose} ratio=${mappedRatio} ${dims.width}x${dims.height}`);

  // ── Truncate prompt to Nova Canvas 1024-char limit ──
  const truncatedPrompt = imagePrompt.length > 1024 ? imagePrompt.substring(0, 1024) : imagePrompt;

  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const invokePayload = JSON.stringify({
    taskType: 'TEXT_IMAGE',
    textToImageParams: { text: truncatedPrompt },
    imageGenerationConfig: {
      width: dims.width,
      height: dims.height,
      quality: 'standard',
      numberOfImages: 1,
    },
  });

  // ── Retry loop: only 429 and 5xx ──
  let resp: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = resp ? getRetryDelayFromResponse(resp, attempt) : RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.log(`[nova-canvas] retryable error, retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      resp = await Promise.race([
        awsSigV4Fetch(host, `/model/${NOVA_CANVAS_MODEL_ID}/invoke`, invokePayload, region, 'bedrock'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Nova Canvas timeout after 120s')), IMAGEN_TIMEOUT_MS),
        ),
      ]);
    } catch (fetchErr: any) {
      const isTimeout = fetchErr?.message?.includes('timeout');
      console.error(`[nova-canvas] ${isTimeout ? 'timeout' : 'fetch error'}: ${fetchErr.message}`);
      return buildStrictErrorResponse(isTimeout ? 504 : 502,
        `Nova Canvas ${isTimeout ? 'timeout' : 'network error'}: ${fetchErr.message}. No fallback was used.`, meta);
    }

    // Non-retryable errors: fail immediately
    if (resp.status === 400 || resp.status === 401 || resp.status === 403 || resp.status === 422) {
      const errText = await resp.text().catch(() => 'unknown');
      console.error(`[nova-canvas] non-retryable ${resp.status}: ${errText.substring(0, 300)}`);
      return buildStrictErrorResponse(resp.status,
        `Nova Canvas error ${resp.status}: ${errText.substring(0, 300)}. No fallback was used.`, meta);
    }

    // Retryable: 429 and 5xx
    if (resp.status === 429 || resp.status >= 500) {
      if (attempt === MAX_RETRIES) {
        const errText = await resp.text().catch(() => 'unknown');
        console.error(`[nova-canvas] exhausted ${MAX_RETRIES} retries on ${resp.status}`);
        return buildStrictErrorResponse(resp.status,
          `Nova Canvas ${resp.status} after ${MAX_RETRIES} retries: ${errText.substring(0, 200)}. No fallback was used.`, meta);
      }
      continue;
    }

    // Success or other status — break out
    break;
  }

  if (!resp || !resp.ok) {
    const errText = resp ? await resp.text().catch(() => 'unknown') : 'no response';
    return buildStrictErrorResponse(resp?.status || 500,
      `Nova Canvas error: ${errText.substring(0, 300)}. No fallback was used.`, meta);
  }

  // ── Parse response ──
  const data = await resp.json();
  if (data.error) {
    console.error(`[nova-canvas] API returned error field: ${data.error}`);
    return buildStrictErrorResponse(422, `Nova Canvas: ${data.error}. No fallback was used.`, meta);
  }

  const base64Image = data.images?.[0];
  if (!base64Image) {
    console.error('[nova-canvas] no image in response');
    return buildStrictErrorResponse(422, 'Nova Canvas returned no image. Prompt may have been safety-filtered. No fallback was used.', meta);
  }

  // ── Upload to blog-assets using existing conventions ──
  const isInline = purpose === 'inline';
  const pathPrefix = isInline ? 'inline' : 'covers';
  const slotSuffix = isInline && slotNumber ? `-slot${slotNumber}` : '';
  const filePath = `${pathPrefix}/${slug}-nova-canvas${slotSuffix}.png`;

  const uploadResult = await uploadGeneratedImage({
    adminClient,
    imageBase64: base64Image,
    mimeType: 'image/png',
    filePath,
  });

  if (uploadResult instanceof Response) return uploadResult;

  const elapsed = Date.now() - startMs;
  console.log(`[nova-canvas] completed in ${elapsed}ms, uploaded to ${filePath}`);

  const successBody = addStrictMetadata({
    success: true,
    data: {
      images: [{
        url: uploadResult.publicUrl,
        path: filePath,
        altText: body.title || body.topic || `Blog image for ${slug}`,
        mimeType: 'image/png',
        width: dims.width,
        height: dims.height,
      }],
      promptUsed: truncatedPrompt,
    },
    model: NOVA_CANVAS_MODEL_ID,
    action: 'generate-image',
    purpose,
    slotNumber,
    elapsedMs: elapsed,
  }, { strict: true, ...meta });

  return new Response(JSON.stringify(successBody), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ═══════════════════════════════════════════════════════════════
// HANDLER — routes based on body.purpose (enforced) or body.model (backward compat)
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();
  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;
    const { adminClient } = authResult;

    const body = await req.json();
    const slug = body.slug || 'untitled';
    const purpose = body.purpose; // "cover" | "inline" | undefined
    const strict = body.strict === true;

    console.log(`[generate-vertex-image] Routing: purpose=${purpose || 'none'}, model=${body.model || 'none'}, slug=${slug}, strict=${strict}`);

    // ── Strict mode: validate model key is a known image model ──
    if (strict && body.model && !KNOWN_IMAGE_MODEL_KEYS.has(body.model)) {
      return buildStrictErrorResponse(400, `Unknown image model key "${body.model}". No fallback was used.`, { selectedModelKey: body.model });
    }

    // ── Helper: check if model should use Lovable Gateway ──
    const isGatewayModel = (model: string) => model in GATEWAY_IMAGE_MODELS && GATEWAY_IMAGE_MODELS[model] !== '__vertex_direct__';
    const isVertexDirectImageModel = (model: string) => model === 'vertex-3-pro-image' || model === 'vertex-3.1-flash-image';
    const resolveVertexDirectRuntimeModel = (model: string) => {
      switch (model) {
        case 'vertex-3.1-flash-image':
          return 'gemini-3.1-flash-image-preview';
        case 'vertex-3-pro-image':
        default:
          return 'gemini-3-pro-image-preview';
      }
    };
    // vertex-pro (Gemini 2.5 Pro) has 'image' capability in registry but doesn't
    // generate images natively — route it through Imagen instead
    const isImagenAliasModel = (model: string) => model === 'vertex-pro';

    const generateViaGatewayModel = (model: string, bodyOverride: any, imagePrompt: string) => {
      const gatewayModelId = GATEWAY_IMAGE_MODELS[model] || LOVABLE_GATEWAY_IMAGE_MODEL;
      return generateViaLovableGatewayImageWithModel(bodyOverride, slug, imagePrompt, adminClient, startMs, `direct-${model}`, gatewayModelId);
    };

    // ── Purpose-based routing (respects model from request body) ──
    if (purpose === 'cover') {
      const selectedCoverModel = body.model || 'gemini-flash-image';
      const imagePrompt = buildCoverImagePrompt(body);
      console.log(`[generate-vertex-image] purpose=cover → ${selectedCoverModel}`);
      if (selectedCoverModel === 'vertex-imagen' || isImagenAliasModel(selectedCoverModel)) {
        const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';
        return await generateViaImagen(body, slug, imagePrompt, 1, aspectRatio, adminClient, startMs, strict);
      }
      if (isVertexDirectImageModel(selectedCoverModel)) {
        return await generateViaVertexDirectImage(body, slug, imagePrompt, adminClient, startMs, resolveVertexDirectRuntimeModel(selectedCoverModel));
      }
      if (isGatewayModel(selectedCoverModel) && selectedCoverModel !== 'gemini-flash-image') {
        return await generateViaGatewayModel(selectedCoverModel, body, imagePrompt);
      }
      if (selectedCoverModel === 'gemini-flash-image' || selectedCoverModel === 'vertex-flash-image') {
        return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs, strict);
      }
      // Strict mode: reject unresolved routing
      if (strict) {
        return buildStrictErrorResponse(400, `Cannot resolve cover model "${selectedCoverModel}" to a known route. No fallback was used.`, { selectedModelKey: selectedCoverModel });
      }
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);
    }

    if (purpose === 'inline') {
      const selectedInlineModel = body.model || 'vertex-imagen';
      const imagePrompt = buildInlineImagePrompt(body);
      const aspectRatio = '4:3';
      console.log(`[generate-vertex-image] ENFORCED: purpose=inline → ${selectedInlineModel}, slot=${body.slotNumber}`);
      if (selectedInlineModel === 'vertex-imagen' || isImagenAliasModel(selectedInlineModel)) {
        return await generateViaImagen(body, slug, imagePrompt, 1, aspectRatio, adminClient, startMs, strict);
      }
      if (isVertexDirectImageModel(selectedInlineModel)) {
        return await generateViaVertexDirectImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, resolveVertexDirectRuntimeModel(selectedInlineModel));
      }
      if (isGatewayModel(selectedInlineModel) && selectedInlineModel !== 'gemini-flash-image') {
        return await generateViaGatewayModel(selectedInlineModel, { ...body, purpose: 'inline' }, imagePrompt);
      }
      if (selectedInlineModel === 'gemini-flash-image' || selectedInlineModel === 'vertex-flash-image') {
        return await generateViaGeminiFlashImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, strict);
      }
      // Strict mode: reject catch-all default
      if (strict) {
        return buildStrictErrorResponse(400, `Cannot resolve inline model "${selectedInlineModel}" to a known route. No fallback was used.`, { selectedModelKey: selectedInlineModel });
      }
      return await generateViaImagen(body, slug, imagePrompt, 1, aspectRatio, adminClient, startMs);
    }

    // ── Backward-compatible model-based routing (no purpose specified) ──
    const selectedModel = body.model || 'vertex-imagen';
    const imageCount = Math.min(Math.max(body.imageCount || 1, 1), 4);
    const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';
    const imagePrompt = buildCoverImagePrompt(body);

    if (selectedModel === 'vertex-imagen' || isImagenAliasModel(selectedModel)) {
      return await generateViaImagen(body, slug, imagePrompt, imageCount, aspectRatio, adminClient, startMs, strict);
    }
    if (isVertexDirectImageModel(selectedModel)) {
      return await generateViaVertexDirectImage(body, slug, imagePrompt, adminClient, startMs, resolveVertexDirectRuntimeModel(selectedModel));
    }
    if (isGatewayModel(selectedModel) && selectedModel !== 'gemini-flash-image') {
      return await generateViaGatewayModel(selectedModel, body, imagePrompt);
    }
    if (selectedModel === 'gemini-flash-image' || selectedModel === 'vertex-flash-image') {
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs, strict);
    }
    // Strict mode: reject unresolved catch-all
    if (strict) {
      return buildStrictErrorResponse(400, `Cannot resolve model "${selectedModel}" to a known route. No fallback was used.`, { selectedModelKey: selectedModel });
    }
    return await generateViaImagen(body, slug, imagePrompt, imageCount, aspectRatio, adminClient, startMs);

  } catch (err) {
    const elapsed = Date.now() - startMs;
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[generate-vertex-image] error after ${elapsed}ms: ${message}`);
    return new Response(JSON.stringify({
      success: false,
      error: message,
      model: 'unknown',
      elapsedMs: elapsed,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
