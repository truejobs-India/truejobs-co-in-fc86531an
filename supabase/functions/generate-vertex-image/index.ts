/**
 * generate-vertex-image — Image generation via Gemini Direct API, Lovable AI Gateway,
 * Amazon Nova Canvas, Azure FLUX, Azure MAI-Image, etc.
 * 
 * Routes based on `body.purpose` (enforced) or `body.model` (backward compat).
 * All Gemini image models now use the direct Google Gemini API (generativelanguage.googleapis.com).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { awsSigV4Fetch } from '../_shared/bedrock-nova.ts';
import { callAzureFlux, fluxSizeFromAspectRatio } from '../_shared/azure-flux.ts';
import { callAzureFlux2, flux2DimensionsFromAspectRatio } from '../_shared/azure-flux2.ts';
import { callAzureMaiImage, maiSizeFromAspectRatio } from '../_shared/azure-mai-image.ts';
import { callGeminiDirectImage } from '../_shared/gemini-direct.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-preview-image-generation';
const LOVABLE_GATEWAY_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';

// Map UI model keys → Lovable Gateway model IDs
const GATEWAY_IMAGE_MODELS: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
  'gemini-flash-image-2': 'google/gemini-3.1-flash-image-preview',
  'vertex-3-pro-image': '__gemini_direct__',
};
// Must stay aligned with image-capable models in src/lib/aiModels.ts
const KNOWN_IMAGE_MODEL_KEYS = new Set([
  ...Object.keys(GATEWAY_IMAGE_MODELS),
  'vertex-3-pro-image',
  'vertex-3.1-flash-image',
  'nova-canvas', // Amazon Nova Canvas via Bedrock InvokeModel
  'azure-flux-kontext', // Azure FLUX.1 Kontext Pro via Azure AI Foundry
  'azure-flux2-pro', // Azure FLUX.2 Pro via Azure AI Foundry
  'azure-mai-image-2', // Azure MAI-Image-2 via Azure AI Foundry
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

// (Vertex AI auth removed — all Gemini models now use direct Google Gemini API via _shared/gemini-direct.ts)

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
import { buildBlogCoverPrompt, buildBlogInlinePrompt, applyFluxRealismLayer } from '../_shared/blog-image-prompt-policy.ts';

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
  const purpose = body.purpose || 'cover';
  console.log(`[gemini-flash-image] slug=${slug} model=${GEMINI_IMAGE_MODEL} purpose=${purpose} via=gemini-direct-api`);

  try {
    const result = await callGeminiDirectImage(GEMINI_IMAGE_MODEL, imagePrompt, IMAGEN_TIMEOUT_MS);

  if (!result.base64) {
      // Text-only STOP — retry once with explicit image instruction
      if (result.finishReason === 'STOP' && !body.__geminiImageRetry) {
        console.warn(`[gemini-flash-image] Retrying text-only STOP with explicit image instruction for slug=${slug}`);
        return await generateViaGeminiFlashImage(
          { ...body, __geminiImageRetry: true },
          slug,
          `${imagePrompt}\n\nCRITICAL: Return one generated image in the response. Do not return a text-only answer.`,
          adminClient,
          startMs,
          strict,
        );
      }

      return new Response(JSON.stringify({
        success: false,
        error: result.finishReason === 'SAFETY'
          ? 'Image generation blocked by safety filter. Try a different topic or rephrase.'
          : `No image data returned (finishReason: ${result.finishReason}). The model returned text but no image.`,
        model: GEMINI_IMAGE_MODEL,
        finishReason: result.finishReason,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isInlineFallback = body.purpose === 'inline';
    const ext = result.mimeType.includes('jpeg') ? 'jpg' : 'png';
    const pathPrefix = isInlineFallback ? 'inline' : 'covers';
    const slotSuffix = isInlineFallback && body.slotNumber ? `-slot${body.slotNumber}` : '';
    const filePath = `${pathPrefix}/${slug}-gemini-flash${slotSuffix}.${ext}`;

    const uploadResult = await uploadGeneratedImage({ adminClient, imageBase64: result.base64, mimeType: result.mimeType, filePath });
    if (uploadResult instanceof Response) return uploadResult;

    const elapsed = Date.now() - startMs;
    console.log(`[gemini-flash-image] completed in ${elapsed}ms via Gemini Direct API`);

    const altText = result.altText || body.title || body.topic || `Blog image for ${slug}`;
    const successBody = addStrictMetadata({
      success: true,
      data: {
        images: [{
          url: uploadResult.publicUrl,
          path: filePath,
          altText,
          mimeType: result.mimeType,
          width: 1024,
          height: 1024,
        }],
        promptUsed: imagePrompt,
      },
      model: GEMINI_IMAGE_MODEL,
      action: 'generate-image',
      purpose,
      elapsedMs: elapsed,
    }, { strict, selectedModelKey: 'gemini-flash-image', resolvedProvider: 'gemini-direct-api', resolvedRuntimeModelId: GEMINI_IMAGE_MODEL });

    return new Response(JSON.stringify(successBody), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error(`[gemini-flash-image] error: ${err.message}`);
    const isTimeout = err.message?.includes('GEMINI_TIMEOUT');
    if (strict) {
      return buildStrictErrorResponse(isTimeout ? 504 : 502, `Gemini Direct API ${isTimeout ? 'timeout' : 'error'}: ${err.message}. No fallback was used.`, { selectedModelKey: 'gemini-flash-image', resolvedProvider: 'gemini-direct-api', resolvedRuntimeModelId: GEMINI_IMAGE_MODEL });
    }
    return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, isTimeout ? 'gemini-timeout' : 'gemini-error');
  }
}

// ═══════════════════════════════════════════════════════════════
// VERTEX DIRECT IMAGE — gemini-3-pro-image-preview via Vertex AI
// ═══════════════════════════════════════════════════════════════

async function generateViaGeminiDirectImage(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  geminiModelId: string,
): Promise<Response> {
  console.log(`[gemini-direct-image] slug=${slug} model=${geminiModelId} via=gemini-direct-api`);

  try {
    const result = await callGeminiDirectImage(geminiModelId, imagePrompt, IMAGEN_TIMEOUT_MS);

    if (!result.base64) {
      return new Response(JSON.stringify({ success: false, error: 'No image data returned. Prompt may have been filtered.', model: geminiModelId }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isInline = body.purpose === 'inline';
    const ext = result.mimeType.includes('jpeg') ? 'jpg' : 'png';
    const pathPrefix = isInline ? 'inline' : 'covers';
    const slotSuffix = isInline && body.slotNumber ? `-slot${body.slotNumber}` : '';
    const modelTag = geminiModelId.replace(/[^a-z0-9]/gi, '-').substring(0, 20);
    const filePath = `${pathPrefix}/${slug}-${modelTag}${slotSuffix}.${ext}`;

    const uploadResult = await uploadGeneratedImage({ adminClient, imageBase64: result.base64, mimeType: result.mimeType, filePath });
    if (uploadResult instanceof Response) return uploadResult;

    const elapsed = Date.now() - startMs;
    const altText = result.altText || body.title || body.topic || `Blog image for ${slug}`;
    console.log(`[gemini-direct-image] completed in ${elapsed}ms model=${geminiModelId}`);

    return new Response(JSON.stringify({
      success: true,
      data: { images: [{ url: uploadResult.publicUrl, path: filePath, altText, mimeType: result.mimeType, width: 1024, height: 1024 }], promptUsed: imagePrompt },
      model: geminiModelId,
      action: 'generate-image',
      purpose: body.purpose || 'cover',
      elapsedMs: elapsed,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error(`[gemini-direct-image] error: ${err.message}`);
    const isTimeout = err.message?.includes('GEMINI_TIMEOUT');
    return new Response(JSON.stringify({
      success: false,
      error: isTimeout ? 'Image generation timed out. Please try again.' : `Gemini Direct API error: ${err.message}`,
      model: geminiModelId,
      timedOut: isTimeout,
    }), { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
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

// Imagen removed — was Vertex-only (predict API). All Gemini image models now use generateContent via direct API.

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

// ── Build Nova Canvas-specific prompt (positive ≤1024, negative ≤1024) ──
function buildNovaCanvasPrompt(body: any): { text: string; negativeText: string } {
  const title = (body.title || '').substring(0, 120);
  const category = (body.category || 'government jobs').substring(0, 60);
  const tagsSnippet = Array.isArray(body.tags) && body.tags.length > 0
    ? `Topics: ${body.tags.slice(0, 5).join(', ')}.`
    : '';
  const excerptSnippet = body.excerpt
    ? `Context: ${body.excerpt.substring(0, 150)}.`
    : '';

  const positivePrompt = [
    `Photorealistic editorial photograph for blog article titled "${title}" about ${category}.`,
    tagsSnippet,
    excerptSnippet,
    'Style: True-to-life, cinematic, magazine-quality photo with realistic lighting,',
    'textures, depth of field, natural color grading. Warm professional colors suitable',
    'for Indian government jobs portal. Young Indian men and women with youthful, fair,',
    'polished, aspirational, premium appearance. Realistic facial detail, skin texture,',
    'clothing, posture in believable real environments. Highly relevant to the specific',
    'article topic. No text overlays or watermarks. English only if any text needed.',
  ].filter(Boolean).join(' ');

  const negativeText = [
    'vector art, flat illustration, cartoon, infographic, poster, sketch, clipart,',
    'icon, stylized artwork, diagram board, labeled panels, text-heavy composition,',
    'simplified faces, low-detail faces, Hindi text, Devanagari script, Hinglish,',
    'Indic script, watermarks, government seals, emblems, logos, generic stock photo,',
    'abstract symbolic composition',
  ].join(' ');

  // Safety: hard-cap at 1024 chars each
  return {
    text: positivePrompt.length > 1024 ? positivePrompt.substring(0, 1024) : positivePrompt,
    negativeText: negativeText.length > 1024 ? negativeText.substring(0, 1024) : negativeText,
  };
}

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

  // ── Build Nova Canvas-optimized prompt (positive + negative, each ≤1024 chars) ──
  const novaPrompt = buildNovaCanvasPrompt(body);
  console.log(`[nova-canvas] prompt: ${novaPrompt.text.length} chars, negativeText: ${novaPrompt.negativeText.length} chars`);

  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const invokePayload = JSON.stringify({
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: novaPrompt.text,
      negativeText: novaPrompt.negativeText,
    },
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
      promptUsed: novaPrompt.text,
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
// AZURE FLUX.1 KONTEXT PRO — via Azure AI Foundry Image API
// ═══════════════════════════════════════════════════════════════

async function generateViaAzureFlux(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  strict: boolean,
): Promise<Response> {
  const meta: StrictMeta = {
    selectedModelKey: 'azure-flux-kontext',
    resolvedProvider: 'azure-ai-foundry',
    resolvedRuntimeModelId: 'flux-1-kontext-pro',
  };

  const purpose = body.purpose || 'cover';
  const slotNumber = body.slotNumber;
  const requestedRatio = body.aspectRatio || '16:9';
  const fluxSize = fluxSizeFromAspectRatio(requestedRatio);

  // Apply FLUX-only strict realism layer (does not affect any other model)
  const fluxPrompt = applyFluxRealismLayer(imagePrompt, body.prompt);

  console.log(`[azure-flux] slug=${slug} purpose=${purpose} size=${fluxSize}`);

  try {
    const result = await callAzureFlux(fluxPrompt, {
      size: fluxSize,
      n: 1,
    });

    // Upload to blog-assets
    const isInline = purpose === 'inline';
    const pathPrefix = isInline ? 'inline' : 'covers';
    const slotSuffix = isInline && slotNumber ? `-slot${slotNumber}` : '';
    const filePath = `${pathPrefix}/${slug}-flux-kontext${slotSuffix}.png`;

    const uploadResult = await uploadGeneratedImage({
      adminClient,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      filePath,
    });

    if (uploadResult instanceof Response) return uploadResult;

    const elapsed = Date.now() - startMs;
    console.log(`[azure-flux] completed in ${elapsed}ms, uploaded to ${filePath}`);

    // Parse dimensions from size string
    const [w, h] = fluxSize.split('x').map(Number);

    const successBody = addStrictMetadata({
      success: true,
      data: {
        images: [{
          url: uploadResult.publicUrl,
          path: filePath,
          altText: body.title || body.topic || `Blog image for ${slug}`,
          mimeType: result.mimeType,
          width: w || 1024,
          height: h || 1024,
        }],
        promptUsed: imagePrompt,
      },
      model: 'flux-1-kontext-pro',
      action: 'generate-image',
      purpose,
      slotNumber,
      elapsedMs: elapsed,
    }, { strict: true, ...meta });

    return new Response(JSON.stringify(successBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[azure-flux] error: ${err.message}`);

    // Content-filter 400 errors (Bing/DALL·E blocklist) — fallback to Gemini Flash Image
    const isContentFilter = err.message?.includes('blocklist') || err.message?.includes('content filter') || err.message?.includes('error 400');
    if (isContentFilter && !strict) {
      console.log(`[azure-flux] content-filter rejection, falling back to gemini-flash-image for slug=${slug}`);
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs, false);
    }

    return buildStrictErrorResponse(
      err.message?.includes('timeout') ? 504 : 502,
      `Azure FLUX error: ${err.message}.${isContentFilter ? ' Content was blocked by Azure safety filters. Try rephrasing the topic or use a different image model.' : ' No fallback was used.'}`,
      meta,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// AZURE FLUX.2-pro — via Azure AI Foundry Black Forest Labs API
// ═══════════════════════════════════════════════════════════════

async function generateViaAzureFlux2(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  strict: boolean,
): Promise<Response> {
  const meta: StrictMeta = {
    selectedModelKey: 'azure-flux2-pro',
    resolvedProvider: 'azure-ai-foundry',
    resolvedRuntimeModelId: 'flux-2-pro',
  };

  const purpose = body.purpose || 'cover';
  const isManualTest = purpose === 'manual-test';
  const slotNumber = body.slotNumber;
  const requestedRatio = body.aspectRatio || '16:9';
  const dims = flux2DimensionsFromAspectRatio(requestedRatio);

  // ── FLUX.2-pro uses its own dedicated prompt policy ──
  // Manual-test is the only exception: it must use the already-guarded prompt passed in,
  // otherwise the manual test path silently rebuilds a different prompt and can hit moderation again.
  const { buildFlux2CoverPrompt, buildFlux2InlinePrompt } = await import('../_shared/flux2-prompt-policy.ts');
  const fluxPrompt = isManualTest
    ? imagePrompt
    : purpose === 'inline'
      ? buildFlux2InlinePrompt(body)
      : buildFlux2CoverPrompt(body);

  if (isManualTest) {
    console.log(`[azure-flux2] manual-test using provided guarded prompt (${fluxPrompt.length} chars)`);
  }

  console.log(`[azure-flux2] slug=${slug} purpose=${purpose} ${dims.width}x${dims.height}`);

  try {
    const result = await callAzureFlux2(fluxPrompt, {
      width: dims.width,
      height: dims.height,
      n: 1,
    });

    const isInline = purpose === 'inline';
    const pathPrefix = isInline ? 'inline' : 'covers';
    const slotSuffix = isInline && slotNumber ? `-slot${slotNumber}` : '';
    const filePath = `${pathPrefix}/${slug}-flux2-pro${slotSuffix}.png`;

    const uploadResult = await uploadGeneratedImage({
      adminClient,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      filePath,
    });

    if (uploadResult instanceof Response) return uploadResult;

    const elapsed = Date.now() - startMs;
    console.log(`[azure-flux2] completed in ${elapsed}ms, uploaded to ${filePath}`);

    const successBody = addStrictMetadata({
      success: true,
      data: {
        images: [{
          url: uploadResult.publicUrl,
          path: filePath,
          altText: body.title || body.topic || `Blog image for ${slug}`,
          mimeType: result.mimeType,
          width: dims.width,
          height: dims.height,
        }],
        promptUsed: fluxPrompt,
      },
      model: 'flux-2-pro',
      action: 'generate-image',
      purpose,
      slotNumber,
      elapsedMs: elapsed,
    }, { strict: true, ...meta });

    return new Response(JSON.stringify(successBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[azure-flux2] error: ${err.message}`);
    return buildStrictErrorResponse(
      err.message?.includes('timeout') ? 504 : 502,
      `Azure FLUX.2-pro error: ${err.message}. No fallback was used.`,
      meta,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// AZURE MAI-IMAGE-2 — via Azure AI Foundry MAI Image API
// ═══════════════════════════════════════════════════════════════

async function generateViaAzureMaiImage(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
  strict: boolean,
): Promise<Response> {
  const meta: StrictMeta = {
    selectedModelKey: 'azure-mai-image-2',
    resolvedProvider: 'azure-ai-foundry',
    resolvedRuntimeModelId: Deno.env.get('AZURE_MAI_IMAGE_DEPLOYMENT') || 'MAI-Image-2',
  };

  const purpose = body.purpose || 'cover';
  const slotNumber = body.slotNumber;
  const requestedRatio = body.aspectRatio || '16:9';
  const dims = maiSizeFromAspectRatio(requestedRatio);

  console.log(`[azure-mai-image] slug=${slug} purpose=${purpose} ${dims.width}x${dims.height}`);

  try {
    const result = await callAzureMaiImage(imagePrompt, { width: dims.width, height: dims.height });

    const isInline = purpose === 'inline';
    const pathPrefix = isInline ? 'inline' : 'covers';
    const slotSuffix = isInline && slotNumber ? `-slot${slotNumber}` : '';
    const filePath = `${pathPrefix}/${slug}-mai-image-2${slotSuffix}.png`;

    const uploadResult = await uploadGeneratedImage({
      adminClient,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      filePath,
    });

    if (uploadResult instanceof Response) return uploadResult;

    const elapsed = Date.now() - startMs;
    console.log(`[azure-mai-image] completed in ${elapsed}ms, uploaded to ${filePath}`);

    const successBody = addStrictMetadata({
      success: true,
      data: {
        images: [{
          url: uploadResult.publicUrl,
          path: filePath,
          altText: body.title || body.topic || `Blog image for ${slug}`,
          mimeType: result.mimeType,
           width: dims.width,
           height: dims.height,
        }],
        promptUsed: imagePrompt,
      },
      model: meta.resolvedRuntimeModelId,
      action: 'generate-image',
      purpose,
      slotNumber,
      elapsedMs: elapsed,
    }, { strict: true, ...meta });

    return new Response(JSON.stringify(successBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[azure-mai-image] error: ${err.message}`);
    return buildStrictErrorResponse(
      err.message?.includes('timeout') ? 504 : 502,
      `Azure MAI-Image-2 error: ${err.message}. No fallback was used.`,
      meta,
    );
  }
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

    // ═══════════════════════════════════════════════════════════════
    // PURPOSE: manual-test — Admin Manual Image Prompt Test
    // Raw user prompt is ALWAYS guarded through prompt policy.
    // ═══════════════════════════════════════════════════════════════
    if (purpose === 'manual-test') {
      const userPrompt = (body.userPrompt || '').trim();
      if (!userPrompt) {
        return new Response(JSON.stringify({ success: false, error: 'userPrompt is required for manual-test.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const selectedModel = body.model || 'gemini-flash-image';
      console.log(`[generate-vertex-image] purpose=manual-test model=${selectedModel} slug=${slug}`);

      // Import and apply prompt guard
      const { buildGuardedManualPrompt } = await import('../_shared/flux2-prompt-policy.ts');
      const guardedPrompt = buildGuardedManualPrompt(userPrompt, selectedModel);

      // Route to the correct model generator using the guarded prompt
      const testBody = { ...body, purpose: 'manual-test', title: userPrompt };
      let result: Response;

      if (selectedModel === 'azure-flux2-pro') {
        result = await generateViaAzureFlux2(testBody, slug, guardedPrompt, adminClient, startMs, true);
      } else if (selectedModel === 'azure-flux-kontext') {
        result = await generateViaAzureFlux(testBody, slug, guardedPrompt, adminClient, startMs, true);
      } else if (selectedModel === 'nova-canvas') {
        result = await generateViaNovaCanvas(testBody, slug, guardedPrompt, adminClient, startMs, true);
      } else if (selectedModel === 'azure-mai-image-2') {
        result = await generateViaAzureMaiImage(testBody, slug, guardedPrompt, adminClient, startMs, true);
      } else if (selectedModel === 'vertex-3-pro-image' || selectedModel === 'vertex-3.1-flash-image') {
        const runtimeModelId = selectedModel === 'vertex-3.1-flash-image'
          ? 'gemini-3.1-flash-image-preview'
          : 'gemini-3-pro-image-preview';
        result = await generateViaGeminiDirectImage(testBody, slug, guardedPrompt, adminClient, startMs, runtimeModelId);
      } else if (selectedModel in GATEWAY_IMAGE_MODELS && GATEWAY_IMAGE_MODELS[selectedModel] !== '__gemini_direct__') {
        const gatewayModelId = GATEWAY_IMAGE_MODELS[selectedModel] || LOVABLE_GATEWAY_IMAGE_MODEL;
        result = await generateViaLovableGatewayImageWithModel(testBody, slug, guardedPrompt, adminClient, startMs, `manual-test`, gatewayModelId);
      } else if (selectedModel === 'gemini-flash-image') {
        result = await generateViaGeminiFlashImage(testBody, slug, guardedPrompt, adminClient, startMs, true);
      } else {
        return new Response(JSON.stringify({ success: false, error: `Unknown image model "${selectedModel}" for manual test.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Inject guardedPrompt into response so UI can display it
      try {
        const resultBody = await result.json();
        resultBody.guardedPrompt = guardedPrompt;
        return new Response(JSON.stringify(resultBody), {
          status: result.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return result;
      }
    }

    // ── Strict mode: validate model key is a known image model ──
    if (strict && body.model && !KNOWN_IMAGE_MODEL_KEYS.has(body.model)) {
      return buildStrictErrorResponse(400, `Unknown image model key "${body.model}". No fallback was used.`, { selectedModelKey: body.model });
    }

    // ── Helper: check if model should use Lovable Gateway ──
    const isGatewayModel = (model: string) => model in GATEWAY_IMAGE_MODELS && GATEWAY_IMAGE_MODELS[model] !== '__gemini_direct__';
    const isGeminiDirectImageModel = (model: string) => model === 'vertex-3-pro-image' || model === 'vertex-3.1-flash-image';
    const resolveGeminiDirectRuntimeModel = (model: string) => {
      switch (model) {
        case 'vertex-3.1-flash-image':
          return 'gemini-3.1-flash-image-preview';
        case 'vertex-3-pro-image':
        default:
          return 'gemini-3-pro-image-preview';
      }
    };
    const generateViaGatewayModel = (model: string, bodyOverride: any, imagePrompt: string) => {
      const gatewayModelId = GATEWAY_IMAGE_MODELS[model] || LOVABLE_GATEWAY_IMAGE_MODEL;
      return generateViaLovableGatewayImageWithModel(bodyOverride, slug, imagePrompt, adminClient, startMs, `direct-${model}`, gatewayModelId);
    };

    // ── Purpose-based routing (respects model from request body) ──
    if (purpose === 'cover') {
      const selectedCoverModel = body.model || 'gemini-flash-image';
      const imagePrompt = buildCoverImagePrompt(body);
      console.log(`[generate-vertex-image] purpose=cover → ${selectedCoverModel}`);
      if (selectedCoverModel === 'nova-canvas') {
        return await generateViaNovaCanvas(body, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedCoverModel === 'azure-flux-kontext') {
        return await generateViaAzureFlux(body, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedCoverModel === 'azure-flux2-pro') {
        return await generateViaAzureFlux2(body, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedCoverModel === 'azure-mai-image-2') {
        return await generateViaAzureMaiImage(body, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedCoverModel === 'vertex-imagen') {
        return buildStrictErrorResponse(400, 'vertex-imagen (Imagen) has been removed. It was Vertex-only and is not available via the direct Gemini API. Please select a different image model.', { selectedModelKey: 'vertex-imagen' });
      }
      if (isGeminiDirectImageModel(selectedCoverModel)) {
        return await generateViaGeminiDirectImage(body, slug, imagePrompt, adminClient, startMs, resolveGeminiDirectRuntimeModel(selectedCoverModel));
      }
      if (isGatewayModel(selectedCoverModel) && selectedCoverModel !== 'gemini-flash-image') {
        return await generateViaGatewayModel(selectedCoverModel, body, imagePrompt);
      }
      if (selectedCoverModel === 'gemini-flash-image') {
        return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs, strict);
      }
      // Strict mode: reject unresolved routing
      if (strict) {
        return buildStrictErrorResponse(400, `Cannot resolve cover model "${selectedCoverModel}" to a known route. No fallback was used.`, { selectedModelKey: selectedCoverModel });
      }
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);
    }

    if (purpose === 'inline') {
      const selectedInlineModel = body.model || 'gemini-flash-image';
      const imagePrompt = buildInlineImagePrompt(body);
      const aspectRatio = '4:3';
      console.log(`[generate-vertex-image] ENFORCED: purpose=inline → ${selectedInlineModel}, slot=${body.slotNumber}`);
      if (selectedInlineModel === 'nova-canvas') {
        return await generateViaNovaCanvas({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedInlineModel === 'azure-flux-kontext') {
        return await generateViaAzureFlux({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedInlineModel === 'azure-flux2-pro') {
        return await generateViaAzureFlux2({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedInlineModel === 'azure-mai-image-2') {
        return await generateViaAzureMaiImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, strict);
      }
      if (selectedInlineModel === 'vertex-imagen') {
        return buildStrictErrorResponse(400, 'vertex-imagen (Imagen) has been removed. Please select a different image model.', { selectedModelKey: 'vertex-imagen' });
      }
      if (isGeminiDirectImageModel(selectedInlineModel)) {
        return await generateViaGeminiDirectImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, resolveGeminiDirectRuntimeModel(selectedInlineModel));
      }
      if (isGatewayModel(selectedInlineModel) && selectedInlineModel !== 'gemini-flash-image') {
        return await generateViaGatewayModel(selectedInlineModel, { ...body, purpose: 'inline' }, imagePrompt);
      }
      if (selectedInlineModel === 'gemini-flash-image') {
        return await generateViaGeminiFlashImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs, strict);
      }
      // Strict mode: reject catch-all default
      if (strict) {
        return buildStrictErrorResponse(400, `Cannot resolve inline model "${selectedInlineModel}" to a known route. No fallback was used.`, { selectedModelKey: selectedInlineModel });
      }
      return await generateViaGeminiFlashImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs);
    }

    // ── Backward-compatible model-based routing (no purpose specified) ──
    const selectedModel = body.model || 'gemini-flash-image';
    const imageCount = Math.min(Math.max(body.imageCount || 1, 1), 4);
    const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';
    const imagePrompt = buildCoverImagePrompt(body);

    if (selectedModel === 'nova-canvas') {
      return await generateViaNovaCanvas(body, slug, imagePrompt, adminClient, startMs, strict);
    }
    if (selectedModel === 'azure-flux-kontext') {
      return await generateViaAzureFlux(body, slug, imagePrompt, adminClient, startMs, strict);
    }
    if (selectedModel === 'azure-flux2-pro') {
      return await generateViaAzureFlux2(body, slug, imagePrompt, adminClient, startMs, strict);
    }
    if (selectedModel === 'azure-mai-image-2') {
      return await generateViaAzureMaiImage(body, slug, imagePrompt, adminClient, startMs, strict);
    }
    if (selectedModel === 'vertex-imagen') {
      return buildStrictErrorResponse(400, 'vertex-imagen (Imagen) has been removed. Please select a different image model.', { selectedModelKey: 'vertex-imagen' });
    }
    if (isGeminiDirectImageModel(selectedModel)) {
      return await generateViaGeminiDirectImage(body, slug, imagePrompt, adminClient, startMs, resolveGeminiDirectRuntimeModel(selectedModel));
    }
    if (isGatewayModel(selectedModel) && selectedModel !== 'gemini-flash-image') {
      return await generateViaGatewayModel(selectedModel, body, imagePrompt);
    }
    if (selectedModel === 'gemini-flash-image') {
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs, strict);
    }
    // Strict mode: reject unresolved catch-all
    if (strict) {
      return buildStrictErrorResponse(400, `Cannot resolve model "${selectedModel}" to a known route. No fallback was used.`, { selectedModelKey: selectedModel });
    }
    return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);

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
