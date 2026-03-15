/**
 * generate-vertex-image — Image generation via Imagen (Vertex AI) or Gemini 2.5 Flash Image (Lovable AI Gateway).
 * Routes based on `body.model`:
 *   - "gemini-flash-image" → Lovable AI Gateway (google/gemini-2.5-flash-image)
 *   - anything else (default) → Imagen via Vertex AI
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
const GEMINI_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
const IMAGEN_TIMEOUT_MS = 60_000;

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
// IMAGE PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════

function buildImagePrompt(body: any): string {
  if (body.prompt) return body.prompt;

  const title = body.title || body.topic || 'Government Jobs in India';
  const category = body.category || 'Government Jobs';
  const tags = Array.isArray(body.tags) ? body.tags.join(', ') : '';
  const style = body.visualStyle || 'modern flat illustration';
  const brand = body.brandGuidelines || '';

  return `Create a clean, professional ${style} for a blog article titled "${title}" about ${category}.${tags ? ` Related topics: ${tags}.` : ''}${brand ? ` Brand guidelines: ${brand}.` : ''} Style: suitable for an Indian government jobs and exam preparation portal. Use warm, professional colors. Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols. The image should be abstract, editorial, and visually appealing.${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 200)}` : ''}`;
}

// ═══════════════════════════════════════════════════════════════
// GEMINI FLASH IMAGE — via Lovable AI Gateway
// ═══════════════════════════════════════════════════════════════

async function generateViaGeminiFlashImage(
  body: any,
  slug: string,
  imagePrompt: string,
  adminClient: any,
  startMs: number,
): Promise<Response> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'LOVABLE_API_KEY not configured — required for Gemini Flash Image',
      model: GEMINI_IMAGE_MODEL,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[gemini-flash-image] slug=${slug} model=${GEMINI_IMAGE_MODEL}`);

  const gatewayResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      messages: [{ role: 'user', content: imagePrompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!gatewayResponse.ok) {
    const errText = await gatewayResponse.text();
    console.error(`[gemini-flash-image] Gateway error [${gatewayResponse.status}]: ${errText.substring(0, 300)}`);
    if (gatewayResponse.status === 429) {
      return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later.', model: GEMINI_IMAGE_MODEL }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (gatewayResponse.status === 402) {
      return new Response(JSON.stringify({ success: false, error: 'Payment required, please add funds to your workspace.', model: GEMINI_IMAGE_MODEL }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: false, error: `AI gateway error: ${errText.substring(0, 200)}`, model: GEMINI_IMAGE_MODEL }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const rawText = await gatewayResponse.text();
  if (!rawText || rawText.trim().length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'AI gateway returned empty response', model: GEMINI_IMAGE_MODEL }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error('[gemini-flash-image] Invalid JSON from gateway:', rawText.substring(0, 500));
    return new Response(JSON.stringify({ success: false, error: 'AI gateway returned invalid JSON', model: GEMINI_IMAGE_MODEL }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const choice = data.choices?.[0]?.message;
  console.log('[gemini-flash-image] Response shape:', JSON.stringify({
    hasImages: !!choice?.images?.length,
    imageCount: choice?.images?.length || 0,
    hasContent: !!choice?.content,
  }));

  // Extract image base64
  let imageBase64 = '';
  let mimeType = 'image/png';

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

  if (!imageBase64) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No image data returned from Gemini Flash Image. The prompt may have been filtered.',
      model: GEMINI_IMAGE_MODEL,
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Extract alt text from text content
  let altText = body.title || body.topic || `Blog image for ${slug}`;
  if (choice?.content) {
    const text = typeof choice.content === 'string' ? choice.content.trim() : '';
    if (text.length > 10 && text.length < 200) altText = text;
  }

  // Upload to storage
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const filePath = `covers/${slug}-gemini-flash.${ext}`;
  const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
  const blob = new Blob([imageBytes], { type: mimeType });

  const { error: uploadError } = await adminClient.storage
    .from('blog-assets')
    .upload(filePath, blob, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error('[gemini-flash-image] Upload error:', uploadError);
    return new Response(JSON.stringify({ success: false, error: 'Failed to upload generated image', model: GEMINI_IMAGE_MODEL }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);
  const elapsed = Date.now() - startMs;
  console.log(`[gemini-flash-image] completed in ${elapsed}ms`);

  return new Response(JSON.stringify({
    success: true,
    data: {
      images: [{
        url: urlData.publicUrl,
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
    elapsedMs: elapsed,
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
  console.log(`[vertex-imagen] slug=${slug} count=${imageCount} ratio=${aspectRatio} model=${IMAGEN_MODEL}`);

  const accessToken = await getVertexAccessToken();
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID secret is required');

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${IMAGEN_MODEL}:predict`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGEN_TIMEOUT_MS);

  let predictions: any[];
  try {
    const resp = await fetch(url, {
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
          safetySetting: 'block_some',
          addWatermark: false,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Imagen API error (${resp.status}): ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    predictions = data.predictions || [];
  } finally {
    clearTimeout(timer);
  }

  if (!predictions.length) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No images generated. The prompt may have been filtered by safety settings.',
      model: IMAGEN_MODEL,
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const images: Array<{ url: string; path: string; altText: string; mimeType: string; width: number; height: number }> = [];

  for (let i = 0; i < predictions.length; i++) {
    const prediction = predictions[i];
    const base64Data = prediction.bytesBase64Encoded;
    const mimeType = prediction.mimeType || 'image/png';

    if (!base64Data) {
      console.warn(`[vertex-imagen] prediction ${i} has no image data`);
      continue;
    }

    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const suffix = predictions.length > 1 ? `-${i + 1}` : '';
    const filePath = `covers/${slug}-vertex${suffix}.${ext}`;

    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
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
      width: aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 1024 : 1200,
      height: aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 1024 : 900,
    });
  }

  if (!images.length) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Images generated but all uploads failed',
      model: IMAGEN_MODEL,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const elapsed = Date.now() - startMs;
  console.log(`[vertex-imagen] completed in ${elapsed}ms, ${images.length} images uploaded`);

  return new Response(JSON.stringify({
    success: true,
    data: { images, promptUsed: imagePrompt },
    model: IMAGEN_MODEL,
    action: 'generate-image',
    elapsedMs: elapsed,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ═══════════════════════════════════════════════════════════════
// HANDLER — routes based on body.model
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
    const selectedModel = body.model || 'vertex-imagen';
    const imageCount = Math.min(Math.max(body.imageCount || 1, 1), 4);
    const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';

    console.log(`[generate-vertex-image] Routing: model=${selectedModel}, slug=${slug}`);

    const imagePrompt = buildImagePrompt(body);

    // Route to correct provider
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
