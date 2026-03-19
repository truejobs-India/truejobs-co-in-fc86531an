/**
 * generate-resource-image — AI cover image generation for PDF resources.
 * Uses Lovable AI Gateway with configurable image model.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IMAGE_MODEL_MAP: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
  'gemini-flash-image-2': 'google/gemini-3.1-flash-image-preview',
};

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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const typeLabels: Record<string, string> = {
      sample_paper: 'Sample Paper', book: 'Study Book', previous_year_paper: 'Previous Year Paper',
    };
    const typeLabel = typeLabels[resourceType] || 'Educational Resource';

    const imagePrompt = `Create a realistic, high-quality cover image for an Indian government exam ${typeLabel} titled "${title}".${category ? ` Category: ${category}.` : ''}${subject ? ` Subject: ${subject}.` : ''} The image should show fair-skinned young Indian men and women (age 20-25) in a study/exam preparation setting — studying together at a desk, looking focused and confident. Include relevant visual elements like books, notebooks, pens, and a subtle Indian educational context. Professional photography style, warm natural lighting, clean composition. Landscape format 1200x630 pixels. Do NOT include any text overlays, official logos, emblems, or seals.`;

    const gatewayModel = IMAGE_MODEL_MAP[imageModel] || IMAGE_MODEL_MAP['gemini-flash-image-2'];
    const modelUsed = gatewayModel;

    console.log(`[generate-resource-image] Using model: ${modelUsed} for slug: ${slug}`);

    const gatewayResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelUsed,
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!gatewayResponse.ok) {
      const errText = await gatewayResponse.text();
      console.error(`Gateway error [${gatewayResponse.status}]: ${errText.substring(0, 300)}`);
      if (gatewayResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded', model: modelUsed }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (gatewayResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required', model: modelUsed }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: `AI gateway error: ${errText.substring(0, 200)}`, model: modelUsed }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawText = await gatewayResponse.text();
    if (!rawText || rawText.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'AI gateway returned empty response', model: modelUsed }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let data: any;
    try { data = JSON.parse(rawText); } catch {
      return new Response(JSON.stringify({ error: 'AI gateway returned invalid JSON', model: modelUsed }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const choice = data.choices?.[0]?.message;
    let imageBase64 = '';
    let mimeType = 'image/png';
    let altText = title;

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
            let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
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
      return new Response(JSON.stringify({ error: 'Image generation failed', code: 'IMAGE_GEN_FAILED', model: modelUsed }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      altText,
      model: modelUsed,
      path: filePath,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[generate-resource-image]', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
