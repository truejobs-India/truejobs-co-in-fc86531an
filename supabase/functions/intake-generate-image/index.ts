/**
 * intake-generate-image — V1 simplest safe per-draft image generation.
 *
 * Reads `intake_drafts.image_prompt` for the given draft, calls the selected
 * image model via the Lovable AI Gateway, post-processes the result to an
 * exact 512x512 PNG (center-cover crop) using ImageScript, uploads to the
 * `blog-assets` bucket under `chatgpt-agent-intake/<draftId>.png`, and writes
 * the public URL back to `intake_drafts.image_url`.
 *
 * Non-blocking by design: this is its own function so text enrichment can
 * succeed/fail independently. On failure we record the error in
 * `runtime_meta.image_error` and return 200 so the caller (UI loop or
 * pipeline orchestrator) can continue with the next draft.
 *
 * Auth: admin-only (validated against user_roles).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Models we can call directly via the Lovable AI Gateway from inside this
 * function (fast path — no extra edge invocation, no auth hop).
 * Everything else is delegated to `generate-vertex-image`, which already
 * implements the full provider matrix used by the blog FeaturedImageGenerator.
 */
const NATIVE_GATEWAY_MODELS: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image',
  'gemini-flash-image-2': 'google/gemini-3.1-flash-image-preview',
  'gemini-pro-image': 'google/gemini-3-pro-image-preview',
};

/** Models accepted on the wire — kept aligned with KNOWN_IMAGE_MODEL_KEYS in generate-vertex-image. */
const ALLOWED_IMAGE_MODELS = new Set<string>([
  ...Object.keys(NATIVE_GATEWAY_MODELS),
  'vertex-3-pro-image',
  'vertex-3.1-flash-image',
  'azure-flux-kontext',
  'azure-flux2-pro',
  'azure-mai-image-2',
  'nova-canvas',
]);

async function recordError(client: any, draftId: string, message: string) {
  try {
    const { data: row } = await client.from('intake_drafts').select('runtime_meta').eq('id', draftId).maybeSingle();
    const meta = (row?.runtime_meta && typeof row.runtime_meta === 'object') ? row.runtime_meta : {};
    await client.from('intake_drafts').update({
      runtime_meta: { ...meta, image_error: message, image_error_at: new Date().toISOString() } as any,
    }).eq('id', draftId);
  } catch (e) { console.error('[intake-generate-image] recordError failed:', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const client = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await client.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);
    const { data: roleData } = await client
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) return json({ error: 'Admin required' }, 403);

    const body = await req.json().catch(() => ({}));
    const draftId = body.draft_id as string;
    const imageModel = (body.imageModel as string) || 'gemini-flash-image';
    if (!draftId || typeof draftId !== 'string') return json({ error: 'Missing draft_id' }, 400);
    if (!ALLOWED_IMAGE_MODELS.has(imageModel)) {
      return json({ error: `Unknown imageModel "${imageModel}"` }, 400);
    }

    const { data: draft, error: fetchErr } = await client.from('intake_drafts').select('*').eq('id', draftId).single();
    if (fetchErr || !draft) return json({ error: 'Draft not found' }, 404);

    const prompt = ((draft as any).image_prompt as string | null)?.trim();
    if (!prompt) {
      await recordError(client, draftId, 'no image_prompt on row');
      return json({ ok: false, skipped: true, reason: 'no image_prompt' });
    }

    // ── Obtain a raw image (base64) for the requested model ──
    // Fast path: native Lovable AI Gateway for Gemini image models.
    // Slow path: delegate to generate-vertex-image (covers Vertex / Azure FLUX / FLUX2 / MAI / Nova).
    let imageBase64 = '';
    try {
      if (NATIVE_GATEWAY_MODELS[imageModel]) {
        const gatewayModel = NATIVE_GATEWAY_MODELS[imageModel];
        const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: gatewayModel,
            messages: [{ role: 'user', content: prompt }],
            modalities: ['image', 'text'],
          }),
        });
        if (!resp.ok) {
          const errText = (await resp.text()).slice(0, 300);
          const msg = `gateway ${resp.status}: ${errText}`;
          await recordError(client, draftId, msg);
          return json({ ok: false, error: msg, model: gatewayModel }, 200);
        }
        const data = await resp.json();
        const imgs = data.choices?.[0]?.message?.images || [];
        for (const img of imgs) {
          const url = img?.image_url?.url || img?.url || '';
          if (typeof url === 'string' && url.startsWith('data:')) {
            const m = url.match(/^data:(image\/\w+);base64,(.+)$/s);
            if (m) { imageBase64 = m[2]; break; }
          }
        }
      } else {
        // Delegate — same shape as blog FeaturedImageGenerator call.
        const title = (draft as any).publish_title || (draft as any).normalized_title || (draft as any).raw_title || `Draft ${draftId}`;
        const category = (draft as any).publish_category || (draft as any).category || 'General';
        const tags = Array.isArray((draft as any).tags) ? (draft as any).tags : [];
        const { data: delegated, error: delegErr } = await client.functions.invoke('generate-vertex-image', {
          body: {
            slug: draftId,
            title,
            category,
            tags,
            model: imageModel,
            imageCount: 1,
            aspectRatio: '1:1',
            purpose: 'intake',
            prompt, // generate-vertex-image treats body.prompt as additional context
          },
        });
        if (delegErr) {
          const msg = `delegate generate-vertex-image failed: ${delegErr.message || String(delegErr)}`;
          await recordError(client, draftId, msg);
          return json({ ok: false, error: msg, model: imageModel }, 200);
        }
        if (delegated?.success === false) {
          const msg = `delegate error: ${delegated.error || 'unknown'}`;
          await recordError(client, draftId, msg);
          return json({ ok: false, error: msg, model: imageModel }, 200);
        }
        const imgUrl: string | undefined = delegated?.data?.images?.[0]?.url;
        if (!imgUrl) {
          await recordError(client, draftId, 'delegate returned no image url');
          return json({ ok: false, error: 'no image url from generate-vertex-image' }, 200);
        }
        // Download the uploaded image and convert to base64 for re-cropping to 512x512.
        const imgResp = await fetch(imgUrl);
        if (!imgResp.ok) {
          await recordError(client, draftId, `download delegated image failed: ${imgResp.status}`);
          return json({ ok: false, error: `download ${imgResp.status}` }, 200);
        }
        const buf = new Uint8Array(await imgResp.arrayBuffer());
        let binary = '';
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
        imageBase64 = btoa(binary);
      }
    } catch (e) {
      const msg = `image source fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      await recordError(client, draftId, msg);
      return json({ ok: false, error: msg }, 200);
    }

    if (!imageBase64) {
      await recordError(client, draftId, 'no image returned');
      return json({ ok: false, error: 'no image returned' }, 200);
    }

    // ── Resize to exact 512x512 (center-cover) ──
    let pngBytes: Uint8Array;
    try {
      const inputBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      const img = await Image.decode(inputBytes);
      const { width, height } = img;
      const target = 512;
      const scale = Math.max(target / width, target / height);
      const resized = img.resize(Math.round(width * scale), Math.round(height * scale));
      const cropX = Math.max(0, Math.floor((resized.width - target) / 2));
      const cropY = Math.max(0, Math.floor((resized.height - target) / 2));
      const cropped = resized.crop(cropX, cropY, target, target);
      pngBytes = await cropped.encode();
    } catch (e) {
      const msg = `resize failed: ${e instanceof Error ? e.message : String(e)}`;
      await recordError(client, draftId, msg);
      return json({ ok: false, error: msg }, 200);
    }

    // ── Upload ──
    const path = `chatgpt-agent-intake/${draftId}.png`;
    const { error: upErr } = await client.storage
      .from('blog-assets')
      .upload(path, new Blob([pngBytes], { type: 'image/png' }), {
        contentType: 'image/png',
        upsert: true,
      });
    if (upErr) {
      const msg = `upload failed: ${upErr.message}`;
      await recordError(client, draftId, msg);
      return json({ ok: false, error: msg }, 200);
    }
    const { data: pub } = client.storage.from('blog-assets').getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // Clear old error and write image_url + runtime_meta
    const { data: row } = await client.from('intake_drafts').select('runtime_meta').eq('id', draftId).maybeSingle();
    const meta = (row?.runtime_meta && typeof row.runtime_meta === 'object') ? row.runtime_meta : {};
    delete (meta as any).image_error;
    delete (meta as any).image_error_at;
    (meta as any).image_model_used = imageModel;
    (meta as any).image_generated_at = new Date().toISOString();
    await client.from('intake_drafts').update({
      image_url: publicUrl,
      runtime_meta: meta as any,
    } as any).eq('id', draftId);

    return json({ ok: true, image_url: publicUrl, model: imageModel });
  } catch (e) {
    console.error('[intake-generate-image] fatal:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});