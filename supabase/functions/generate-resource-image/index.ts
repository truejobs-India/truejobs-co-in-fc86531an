/**
 * generate-resource-image — AI cover image generation for PDF resources.
 * Supports TWO providers:
 *   1. Vertex AI (user's GCP API) — vertex-pro, vertex-imagen
 *   2. Lovable AI Gateway — gemini-flash-image, gemini-pro-image, gemini-flash-image-2
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getVertexAccessToken } from '../_shared/vertex-ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// Lovable Gateway models
// ═══════════════════════════════════════════════════════════════
const LOVABLE_MODEL_MAP: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
  'gemini-flash-image-2': 'google/gemini-3.1-flash-image-preview',
};

// ═══════════════════════════════════════════════════════════════
// Vertex AI models (user's GCP API)
// ═══════════════════════════════════════════════════════════════
const VERTEX_MODEL_MAP: Record<string, string> = {
  'vertex-pro': 'gemini-2.5-pro-preview-06-05',
  'vertex-imagen': 'imagen-3.0-generate-002',
};

function isVertexModel(model: string): boolean {
  return model in VERTEX_MODEL_MAP;
}

// ═══════════════════════════════════════════════════════════════
// Image generation via Vertex AI (Gemini multimodal)
// ═══════════════════════════════════════════════════════════════
async function generateImageVertexGemini(prompt: string, vertexModel: string): Promise<{ base64: string; mimeType: string }> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID not configured');

  const accessToken = await getVertexAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429) throw new Error('VERTEX_RATE_LIMITED');
      if (resp.status === 403) throw new Error(`Vertex AI access denied: ${errText.substring(0, 200)}`);
      throw new Error(`Vertex AI error (${resp.status}): ${errText.substring(0, 300)}`);
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
      }
    }

    throw new Error('Vertex AI returned no image data');
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════
// Image generation via Vertex AI Imagen
// ═══════════════════════════════════════════════════════════════
async function generateImageVertexImagen(prompt: string): Promise<{ base64: string; mimeType: string }> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID not configured');

  const accessToken = await getVertexAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          personGeneration: 'allow_adult',
        },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429) throw new Error('VERTEX_RATE_LIMITED');
      throw new Error(`Imagen error (${resp.status}): ${errText.substring(0, 300)}`);
    }

    const data = await resp.json();
    const predictions = data?.predictions;
    if (!predictions?.length || !predictions[0].bytesBase64Encoded) {
      throw new Error('Imagen returned no image data');
    }

    return { base64: predictions[0].bytesBase64Encoded, mimeType: predictions[0].mimeType || 'image/png' };
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════
// Image generation via Lovable AI Gateway
// ═══════════════════════════════════════════════════════════════
async function generateImageLovableGateway(prompt: string, gatewayModel: string): Promise<{ base64: string; mimeType: string }> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: gatewayModel,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) throw new Error('GATEWAY_RATE_LIMITED');
    if (resp.status === 402) throw new Error('GATEWAY_PAYMENT_REQUIRED');
    throw new Error(`AI gateway error (${resp.status}): ${errText.substring(0, 200)}`);
  }

  const rawText = await resp.text();
  if (!rawText || rawText.trim().length === 0) throw new Error('AI gateway returned empty response');

  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error('AI gateway returned invalid JSON');
  }

  const choice = data.choices?.[0]?.message;

  if (choice?.images?.length > 0) {
    for (const img of choice.images) {
      const imgUrl = img?.image_url?.url || img?.url || '';
      if (imgUrl.startsWith('data:')) {
        const match = imgUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
        if (match) return { base64: match[2], mimeType: match[1] };
      } else if (imgUrl.startsWith('http')) {
        const imgResp = await fetch(imgUrl);
        if (imgResp.ok) {
          const arrBuf = await imgResp.arrayBuffer();
          const bytes = new Uint8Array(arrBuf);
          let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return { base64: btoa(binary), mimeType: imgResp.headers.get('content-type') || 'image/png' };
        }
      }
    }
  }

  throw new Error('No image found in gateway response');
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Parse request ──
    const { slug, title, category, subject, resourceType, imageModel } = await req.json();
    if (!slug || !title) {
      return new Response(JSON.stringify({ error: 'slug and title are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const typeLabels: Record<string, string> = {
      sample_paper: 'Sample Paper', book: 'Study Book', previous_year_paper: 'Previous Year Paper',
    };
    const typeLabel = typeLabels[resourceType] || 'Educational Resource';

    const imagePrompt = `Create a realistic, high-quality cover image for an Indian government exam ${typeLabel} titled "${title}".${category ? ` Category: ${category}.` : ''}${subject ? ` Subject: ${subject}.` : ''} The image should show fair-skinned young Indian men and women (age 20-25) in a study/exam preparation setting — studying together at a desk, looking focused and confident. Include relevant visual elements like books, notebooks, pens, and a subtle Indian educational context. Professional photography style, warm natural lighting, clean composition. Landscape format 1200x630 pixels. Do NOT include any text overlays, official logos, emblems, or seals.`;

    // ── Route to the correct provider ──
    const selectedModel = imageModel || 'gemini-flash-image-2';
    let provider: string;
    let modelUsed: string;
    let imageBase64: string;
    let mimeType: string;

    if (isVertexModel(selectedModel)) {
      // ── Vertex AI (user's GCP API) ──
      provider = 'vertex-ai';
      const vertexModelId = VERTEX_MODEL_MAP[selectedModel];
      modelUsed = `vertex/${vertexModelId}`;
      console.log(`[generate-resource-image] Using Vertex AI model: ${vertexModelId} (key: ${selectedModel}) for slug: ${slug}`);

      try {
        if (selectedModel === 'vertex-imagen') {
          const result = await generateImageVertexImagen(imagePrompt);
          imageBase64 = result.base64;
          mimeType = result.mimeType;
        } else {
          const result = await generateImageVertexGemini(imagePrompt, vertexModelId);
          imageBase64 = result.base64;
          mimeType = result.mimeType;
        }
      } catch (err: any) {
        if (err.message === 'VERTEX_RATE_LIMITED') {
          return new Response(JSON.stringify({ error: 'Vertex AI rate limit exceeded', provider, model: modelUsed }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.error(`[generate-resource-image] Vertex AI error:`, err.message);
        return new Response(JSON.stringify({ error: err.message, provider, model: modelUsed }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      // ── Lovable AI Gateway ──
      provider = 'lovable-gateway';
      const gatewayModel = LOVABLE_MODEL_MAP[selectedModel] || LOVABLE_MODEL_MAP['gemini-flash-image-2'];
      modelUsed = gatewayModel;
      console.log(`[generate-resource-image] Using Lovable Gateway model: ${gatewayModel} (key: ${selectedModel}) for slug: ${slug}`);

      try {
        const result = await generateImageLovableGateway(imagePrompt, gatewayModel);
        imageBase64 = result.base64;
        mimeType = result.mimeType;
      } catch (err: any) {
        if (err.message === 'GATEWAY_RATE_LIMITED') {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded', provider, model: modelUsed }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (err.message === 'GATEWAY_PAYMENT_REQUIRED') {
          return new Response(JSON.stringify({ error: 'Lovable AI credits exhausted — add funds in Settings → Workspace → Usage', provider, model: modelUsed }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.error(`[generate-resource-image] Gateway error:`, err.message);
        return new Response(JSON.stringify({ error: err.message, provider, model: modelUsed }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Image generation failed — no image data returned', code: 'IMAGE_GEN_FAILED', provider, model: modelUsed }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Upload to storage ──
    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const filePath = `resource-covers/${slug}-cover.${ext}`;

    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([imageBytes], { type: mimeType });

    const { error: uploadError } = await adminClient.storage.from('blog-assets').upload(filePath, blob, { contentType: mimeType, upsert: true });
    if (uploadError) {
      return new Response(JSON.stringify({ error: 'Failed to upload image', detail: uploadError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);

    return new Response(JSON.stringify({
      success: true,
      imageUrl: urlData.publicUrl,
      altText: title,
      provider,
      model: modelUsed,
      path: filePath,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[generate-resource-image]', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
