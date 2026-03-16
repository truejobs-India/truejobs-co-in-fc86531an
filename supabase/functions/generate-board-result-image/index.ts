/**
 * generate-board-result-image — Premium image generation for board result pages.
 * Uses Gemini image models via Lovable AI Gateway exclusively.
 * 
 * Supported models:
 *   - gemini-flash-image → google/gemini-2.5-flash-image (Nano Banana)
 *   - gemini-pro-image   → google/gemini-3-pro-image-preview (Pro quality)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// MODEL ROUTING — Strict mapping, no fallthrough
// ═══════════════════════════════════════════════════════════════

const MODEL_MAP: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-pro-image':   'google/gemini-3-pro-image-preview',
};

function resolveModel(input: string): { gatewayModel: string; displayName: string } {
  const gatewayModel = MODEL_MAP[input];
  if (!gatewayModel) {
    throw new Error(`Invalid image model: "${input}". Allowed: ${Object.keys(MODEL_MAP).join(', ')}`);
  }
  return { gatewayModel, displayName: input };
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDERS — Page-type aware, premium quality
// ═══════════════════════════════════════════════════════════════

function buildImagePrompt(pageType: string, context: {
  state_ut?: string;
  board_name?: string;
  variant?: string;
}): string {
  const base = `Photorealistic, premium editorial photograph. Young Indian students (male and female, ages 16-22), attractive, well-groomed, wearing clean modern Indian casual/academic clothing. Natural lighting, sharp focus, realistic proportions and skin tones. No text, no watermarks, no logos, no certificates, no cartoonish elements, no AI artifacts.`;

  switch (pageType) {
    case 'state':
      return `${base} Scene: A group of confident Indian college students in a modern educational setting in ${context.state_ut || 'India'}. They are checking exam results together, looking hopeful and focused. Background suggests an Indian educational institution. Warm, aspirational, trustworthy mood. Wide composition suitable for a hero banner.`;

    case 'board':
      return `${base} Scene: Two or three Indian students in casual academic wear, sitting together with a laptop, eagerly anticipating ${context.board_name || 'board exam'} results. One student has a phone, showing anticipation. Setting is a clean study space or home environment. Warm natural lighting, editorial quality. Medium-wide composition.`;

    case 'result-landing':
      return `${base} Scene: A single Indian student (young woman or young man, around 18 years old) checking ${context.board_name || 'board exam'} ${context.variant === 'class-10' ? 'Class 10' : context.variant === 'class-12' ? 'Class 12' : ''} results on a laptop in a calm, modern Indian home setting. Expression is focused and hopeful. Clean, uncluttered background. Photojournalistic editorial style. Medium close-up composition suitable for a result page hero.`;

    case 'board-logo':
      return `Clean, professional, minimal logo design for the ${context.board_name || 'Board of Education'} (${context.state_ut || 'India'}). Official government education board emblem style. Simple geometric shapes, clean lines, professional colors (navy blue, gold, dark green). Centered composition on a solid white background. No photographic elements, no text, no watermarks. Suitable as a small icon or badge on a website.`;

    default:
      return `${base} Scene: Indian students in a modern educational setting checking exam results online. Aspirational, clean, trustworthy. Editorial photography style.`;
  }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE GENERATION via Lovable AI Gateway
// ═══════════════════════════════════════════════════════════════

async function generateImage(prompt: string, gatewayModel: string): Promise<{ base64: string; mimeType: string }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  console.log(`[board-result-image] Calling gateway with model: ${gatewayModel}`);
  console.log(`[board-result-image] Prompt (first 200): ${prompt.substring(0, 200)}`);

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    console.error(`[board-result-image] Gateway error ${resp.status}: ${errText.substring(0, 500)}`);
    throw new Error(`Image generation failed (${resp.status}): ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  const imageData = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageData) {
    console.error('[board-result-image] No image in response:', JSON.stringify(data).substring(0, 500));
    throw new Error('No image returned from AI gateway');
  }

  // Parse data URL
  const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data format');

  return { base64: match[2], mimeType: match[1] };
}

// ═══════════════════════════════════════════════════════════════
// STORAGE UPLOAD
// ═══════════════════════════════════════════════════════════════

async function uploadToStorage(adminClient: any, base64: string, mimeType: string, slug: string, purpose: string): Promise<string> {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filePath = `board-results/${slug}/${purpose}-${Date.now()}.${ext}`;
  const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([imageBytes], { type: mimeType });

  const { error: uploadError } = await adminClient.storage
    .from('blog-assets')
    .upload(filePath, blob, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error(`[board-result-image] Upload error:`, uploadError);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = adminClient.storage.from('blog-assets').getPublicUrl(filePath);
  return urlData.publicUrl;
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Missing auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await adminClient.auth.getUser(token);
  if (error || !user) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roles) {
    return new Response(JSON.stringify({ success: false, error: 'Admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId: user.id, adminClient };
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const body = await req.json();
    const {
      imageModel,     // 'gemini-flash-image' or 'gemini-pro-image'
      pageType,       // 'state', 'board', 'result-landing'
      slug,           // page slug for storage path
      state_ut,
      board_name,
      variant,
      customPrompt,   // optional override
    } = body;

    if (!imageModel) {
      return new Response(JSON.stringify({ success: false, error: 'imageModel is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Strict model resolution — throws on invalid model
    const { gatewayModel, displayName } = resolveModel(imageModel);
    console.log(`[board-result-image] Model selected: ${displayName} → ${gatewayModel}`);
    console.log(`[board-result-image] Page type: ${pageType}, Slug: ${slug}`);

    // Build or use custom prompt
    const prompt = customPrompt || buildImagePrompt(pageType || 'result-landing', {
      state_ut, board_name, variant,
    });

    // Generate image
    const { base64, mimeType } = await generateImage(prompt, gatewayModel);

    // Upload to storage
    const publicUrl = await uploadToStorage(
      authResult.adminClient, base64, mimeType,
      slug || 'default', pageType || 'hero',
    );

    const elapsedMs = Date.now() - startTime;
    console.log(`[board-result-image] Success: ${publicUrl} (${elapsedMs}ms, model: ${displayName})`);

    return new Response(JSON.stringify({
      success: true,
      imageUrl: publicUrl,
      model: displayName,
      gatewayModel,
      pageType,
      slug,
      elapsedMs,
      promptUsed: prompt.substring(0, 200) + '…',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[board-result-image] Error (${elapsedMs}ms):`, e.message);
    return new Response(JSON.stringify({
      success: false,
      error: e.message,
      elapsedMs,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
