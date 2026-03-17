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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const IMAGEN_MODEL = Deno.env.get('VERTEX_IMAGEN_MODEL') || 'imagen-4.0-generate-preview-06-06';
const GEMINI_IMAGE_MODEL = Deno.env.get('VERTEX_GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image';
const LOVABLE_GATEWAY_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';
const IMAGEN_TIMEOUT_MS = 45_000;
const GATEWAY_TIMEOUT_MS = 55_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000; // 2s, 4s, 8s exponential backoff

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
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildCoverImagePrompt(body: any): string {
  if (body.prompt) return body.prompt;

  const title = body.title || body.topic || 'Government Jobs in India';
  const category = body.category || 'Government Jobs';
  const tags = Array.isArray(body.tags) ? body.tags.join(', ') : '';
  const style = body.visualStyle || 'modern flat illustration';
  const brand = body.brandGuidelines || '';

  return `Create a clean, professional ${style} for a blog article titled "${title}" about ${category}.${tags ? ` Related topics: ${tags}.` : ''}${brand ? ` Brand guidelines: ${brand}.` : ''} Style: suitable for an Indian government jobs and exam preparation portal. Use warm, professional colors. Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols. The image should be abstract, editorial, and visually appealing.${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 200)}` : ''}`;
}

function buildInlineImagePrompt(body: any): string {
  const title = body.title || 'Government Jobs';
  const contextSnippet = body.contextSnippet || '';
  const nearbyHeading = body.nearbyHeading || '';
  const category = body.category || 'Government Jobs';
  const slotNumber = body.slotNumber || 1;

  const sectionContext = nearbyHeading
    ? `for a section about "${nearbyHeading}"`
    : `for section ${slotNumber} of the article`;

  return `Create a contextual editorial illustration ${sectionContext} in a blog article titled "${title}" about ${category}. ${contextSnippet ? `Nearby content context: ${contextSnippet.substring(0, 250)}.` : ''} Style: clean, professional infographic or illustration suitable for inline blog placement. Aspect ratio 4:3. Use warm, professional colors. Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols. The image should complement the article section and be visually distinct from a cover image.`;
}

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
              responseModalities: ['TEXT', 'IMAGE'],
              temperature: 1.0,
              maxOutputTokens: 8192,
            },
          }),
        });
      } catch (fetchErr: any) {
        clearTimeout(timer);
        const isTimeout = fetchErr?.name === 'AbortError';
        console.error(`[gemini-flash-image] ${isTimeout ? 'timeout' : 'fetch error'} on attempt ${attempt}: ${fetchErr.message}`);
        // On timeout or network error, fall back to gateway
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, isTimeout ? 'vertex-timeout' : 'vertex-fetch-error');
      } finally {
        clearTimeout(timer);
      }
      if (resp.status !== 429) break;
      if (attempt === MAX_RETRIES) {
        const errText = await resp.text();
        console.error(`[gemini-flash-image] 429 exhausted retries: ${errText.substring(0, 200)}`);
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, 'vertex-429');
      }
    }

    if (!resp!.ok) {
      const errText = await resp!.text();
      console.error(`[gemini-flash-image] Vertex error [${resp!.status}]: ${errText.substring(0, 300)}`);
      if (resp!.status === 429) {
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, 'vertex-429');
      }
      return new Response(JSON.stringify({ success: false, error: `Vertex AI error (${resp!.status}): ${errText.substring(0, 200)}`, model: GEMINI_IMAGE_MODEL }),
        { status: resp!.status >= 400 && resp!.status < 500 ? resp!.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp!.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];

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
      return new Response(JSON.stringify({
        success: false,
        error: 'No image data returned from Gemini. The prompt may have been filtered.',
        model: GEMINI_IMAGE_MODEL,
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
      model: GEMINI_IMAGE_MODEL,
      action: 'generate-image',
      purpose,
      elapsedMs: elapsed,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// ═══════════════════════════════════════════════════════════════
// LOVABLE GATEWAY IMAGE FALLBACK
// ═══════════════════════════════════════════════════════════════

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
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), { status: isTimeout ? 504 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } finally {
    clearTimeout(gatewayTimer);
  }

  if (!gatewayResponse.ok) {
    const errText = await gatewayResponse.text();
    console.error(`[lovable-gateway-image] error [${gatewayResponse.status}]: ${errText.substring(0, 300)}`);

    let userMessage: string;
    let statusCode: number;

    if (gatewayResponse.status === 429) {
      userMessage = 'Image generation is temporarily busy across all providers. Please try again in a few minutes.';
      statusCode = 429;
    } else if (gatewayResponse.status === 402) {
      userMessage = 'All image generation providers are temporarily unavailable (quota exceeded). Please upload an image manually or try again later.';
      statusCode = 429; // Return 429 to client so UI treats it as retryable
    } else {
      userMessage = `Image generation failed across all providers. Please upload manually.`;
      statusCode = 502;
    }

    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      model: LOVABLE_GATEWAY_IMAGE_MODEL,
      fallbackReason,
    }), {
      status: statusCode,
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
        return await generateViaLovableGatewayImage(body, slug, imagePrompt, adminClient, startMs, isTimeout ? 'imagen-timeout' : 'imagen-fetch-error');
      } finally {
        clearTimeout(timer);
      }
      if (resp.status !== 429) break;
      last429Response = resp;
      if (attempt === MAX_RETRIES) {
        const errText = await resp.text();
        console.error(`[vertex-imagen] 429 exhausted retries: ${errText.substring(0, 200)}`);
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
    // Safety-filtered: fallback to Gemini Flash Image
    console.log(`[vertex-imagen] Safety-filtered, falling back to Gemini Flash Image for slug=${slug}`);
    return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);
  }

  const elapsed = Date.now() - startMs;
  console.log(`[vertex-imagen] completed in ${elapsed}ms, ${images.length} images uploaded, purpose=${purpose}`);

  return new Response(JSON.stringify({
    success: true,
    data: { images, promptUsed: imagePrompt },
    model: IMAGEN_MODEL,
    action: 'generate-image',
    purpose,
    slotNumber,
    elapsedMs: elapsed,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    console.log(`[generate-vertex-image] Routing: purpose=${purpose || 'none'}, model=${body.model || 'none'}, slug=${slug}`);

    // ── Purpose-based routing (respects model from request body) ──
    if (purpose === 'cover') {
      const selectedCoverModel = body.model || 'gemini-flash-image';
      const imagePrompt = buildCoverImagePrompt(body);
      console.log(`[generate-vertex-image] purpose=cover → ${selectedCoverModel}`);
      if (selectedCoverModel === 'vertex-imagen') {
        const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';
        return await generateViaImagen(body, slug, imagePrompt, 1, aspectRatio, adminClient, startMs);
      }
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);
    }

    if (purpose === 'inline') {
      // Inline images: use model from request body, default to Imagen
      const selectedInlineModel = body.model || 'vertex-imagen';
      const imagePrompt = buildInlineImagePrompt(body);
      const aspectRatio = '4:3'; // Enforced for inline
      console.log(`[generate-vertex-image] ENFORCED: purpose=inline → ${selectedInlineModel}, slot=${body.slotNumber}`);
      if (selectedInlineModel === 'gemini-flash-image') {
        return await generateViaGeminiFlashImage({ ...body, purpose: 'inline' }, slug, imagePrompt, adminClient, startMs);
      }
      return await generateViaImagen(body, slug, imagePrompt, 1, aspectRatio, adminClient, startMs);
    }

    // ── Backward-compatible model-based routing (no purpose specified) ──
    const selectedModel = body.model || 'vertex-imagen';
    const imageCount = Math.min(Math.max(body.imageCount || 1, 1), 4);
    const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';
    const imagePrompt = buildCoverImagePrompt(body);

    if (selectedModel === 'gemini-flash-image') {
      return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs);
    } else {
      return await generateViaImagen(body, slug, imagePrompt, imageCount, aspectRatio, adminClient, startMs);
    }

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
