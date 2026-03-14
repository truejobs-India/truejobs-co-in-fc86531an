/**
 * generate-vertex-image — Imagen via Google Vertex AI
 * Generates blog-relevant featured images and uploads to Supabase Storage.
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
const IMAGEN_TIMEOUT_MS = 60_000;

const ASPECT_RATIOS: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '4:3': '4:3',
  '3:2': '3:4',  // Closest supported
  '9:16': '9:16',
};

// ═══════════════════════════════════════════════════════════════
// GOOGLE AUTH
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
// HANDLER
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
    const imageCount = Math.min(Math.max(body.imageCount || 1, 1), 4);
    const aspectRatio = ASPECT_RATIOS[body.aspectRatio || '16:9'] || '16:9';

    console.log(`[vertex-image] slug=${slug} count=${imageCount} ratio=${aspectRatio}`);

    const imagePrompt = buildImagePrompt(body);
    const accessToken = await getVertexAccessToken();

    // Call Imagen via Vertex AI
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

    // Upload each image to Supabase Storage
    const images: Array<{ url: string; path: string; altText: string; mimeType: string; width: number; height: number }> = [];

    for (let i = 0; i < predictions.length; i++) {
      const prediction = predictions[i];
      const base64Data = prediction.bytesBase64Encoded;
      const mimeType = prediction.mimeType || 'image/png';

      if (!base64Data) {
        console.warn(`[vertex-image] prediction ${i} has no image data`);
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
        console.error(`[vertex-image] upload error for ${filePath}:`, uploadError);
        continue;
      }

      const { data: urlData } = adminClient.storage
        .from('blog-assets')
        .getPublicUrl(filePath);

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
    console.log(`[vertex-image] completed in ${elapsed}ms, ${images.length} images uploaded`);

    return new Response(JSON.stringify({
      success: true,
      data: { images, promptUsed: imagePrompt },
      model: IMAGEN_MODEL,
      action: 'generate-image',
      elapsedMs: elapsed,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const elapsed = Date.now() - startMs;
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[vertex-image] error after ${elapsed}ms: ${message}`);
    return new Response(JSON.stringify({
      success: false,
      error: message,
      model: IMAGEN_MODEL,
      elapsedMs: elapsed,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
