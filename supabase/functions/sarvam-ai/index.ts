/**
 * Sarvam AI Edge Function — unified backend for all Sarvam API capabilities.
 * Supports: chat, translate, tts, stt, detect-language, transliterate.
 * Vision (Document Intelligence) is async/job-based and NOT included here.
 *
 * Auth: api-subscription-key header to https://api.sarvam.ai
 * All calls require SARVAM_API_KEY secret.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SARVAM_BASE = 'https://api.sarvam.ai';
const TIMEOUT_MS = 120_000; // 120s for long TTS/STT calls

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Auth helper ──
async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId: user.id };
}

// ── Sarvam API caller with timeout ──
async function callSarvam(
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${SARVAM_BASE}${path}`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({ raw: await res.text() }));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, status: 408, data: { error: 'Sarvam API request timed out' } };
    }
    return { ok: false, status: 500, data: { error: `Network error: ${err.message}` } };
  }
}

// ── Sarvam multipart caller (for STT) ──
async function callSarvamMultipart(
  path: string,
  formData: FormData,
  apiKey: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${SARVAM_BASE}${path}`, {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(async () => ({ raw: await res.text() }));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, status: 408, data: { error: 'Sarvam API request timed out' } };
    }
    return { ok: false, status: 500, data: { error: `Network error: ${err.message}` } };
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ════════════════════════════════════════════════════════════════
// Main handler
// ════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authResult = await verifyAdmin(req);
  if (authResult instanceof Response) return authResult;

  // API key check
  const apiKey = Deno.env.get('SARVAM_API_KEY');
  if (!apiKey) {
    console.error('[sarvam-ai] SARVAM_API_KEY not configured');
    return jsonResponse({ error: 'Sarvam API key not configured on server' }, 500);
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // ── STT requires multipart ──
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const action = formData.get('action') as string;

      if (action === 'stt') {
        const file = formData.get('file') as File;
        if (!file) return jsonResponse({ error: 'Missing audio file' }, 400);

        const model = (formData.get('model') as string) || 'saaras:v3';
        const language = formData.get('language') as string || undefined;
        const mode = (formData.get('mode') as string) || 'transcribe';

        const sttForm = new FormData();
        sttForm.append('file', file);
        sttForm.append('model', model);
        if (language) sttForm.append('language_code', language);
        sttForm.append('mode', mode);

        console.log(`[sarvam-ai] STT request: model=${model}, mode=${mode}`);
        const result = await callSarvamMultipart('/speech-to-text', sttForm, apiKey);

        if (!result.ok) {
          console.error(`[sarvam-ai] STT error [${result.status}]:`, JSON.stringify(result.data).slice(0, 300));
          return jsonResponse({ error: 'STT request failed', details: result.data }, result.status);
        }
        return jsonResponse({ success: true, capability: 'stt', data: result.data });
      }

      return jsonResponse({ error: 'Unknown multipart action' }, 400);
    }

    // ── JSON-based actions ──
    const body = await req.json();
    const { action } = body;

    if (!action) return jsonResponse({ error: 'Missing action parameter' }, 400);

    // ── Chat Completion ──
    if (action === 'chat') {
      const { messages, model = 'sarvam-30b', temperature = 0.2, max_tokens = 2000, stream = false } = body;
      if (!messages || !Array.isArray(messages)) {
        return jsonResponse({ error: 'messages array required' }, 400);
      }

      console.log(`[sarvam-ai] Chat request: model=${model}, messages=${messages.length}, max_tokens=${max_tokens}`);
      const result = await callSarvam('/v1/chat/completions', {
        model,
        messages,
        temperature,
        max_tokens,
        stream: false, // streaming not supported through this passthrough
      }, apiKey);

      if (!result.ok) {
        console.error(`[sarvam-ai] Chat error [${result.status}]:`, JSON.stringify(result.data).slice(0, 300));
        return jsonResponse({ error: 'Chat request failed', details: result.data }, result.status);
      }
      return jsonResponse({ success: true, capability: 'chat', data: result.data });
    }

    // ── Translation ──
    if (action === 'translate') {
      const {
        input, source_language_code = 'auto', target_language_code,
        model = 'sarvam-translate:v1', speaker_gender, mode = 'formal',
      } = body;
      if (!input || !target_language_code) {
        return jsonResponse({ error: 'input and target_language_code required' }, 400);
      }
      if (input.length > 2000) {
        return jsonResponse({ error: 'Input exceeds 2000 character limit' }, 400);
      }

      console.log(`[sarvam-ai] Translate: model=${model}, ${source_language_code} → ${target_language_code}, len=${input.length}`);
      const payload: Record<string, unknown> = {
        input,
        source_language_code,
        target_language_code,
        model,
        mode,
      };
      if (speaker_gender) payload.speaker_gender = speaker_gender;

      const result = await callSarvam('/translate', payload, apiKey);

      if (!result.ok) {
        console.error(`[sarvam-ai] Translate error [${result.status}]:`, JSON.stringify(result.data).slice(0, 300));
        return jsonResponse({ error: 'Translation request failed', details: result.data }, result.status);
      }
      return jsonResponse({ success: true, capability: 'translate', data: result.data });
    }

    // ── Text to Speech ──
    if (action === 'tts') {
      const {
        text, target_language_code = 'hi-IN', model = 'bulbul:v3',
        speaker = 'Shubh', pace = 1.0, temperature = 0.6,
      } = body;
      if (!text) return jsonResponse({ error: 'text required' }, 400);
      if (text.length > 2500) {
        return jsonResponse({ error: 'Text exceeds 2500 character limit for bulbul:v3' }, 400);
      }

      console.log(`[sarvam-ai] TTS: model=${model}, lang=${target_language_code}, speaker=${speaker}, len=${text.length}`);
      const payload: Record<string, unknown> = {
        text,
        target_language_code,
        model,
        speaker,
        pace,
      };
      if (model === 'bulbul:v3') payload.temperature = temperature;

      const result = await callSarvam('/text-to-speech', payload, apiKey);

      if (!result.ok) {
        console.error(`[sarvam-ai] TTS error [${result.status}]:`, JSON.stringify(result.data).slice(0, 300));
        return jsonResponse({ error: 'TTS request failed', details: result.data }, result.status);
      }
      return jsonResponse({ success: true, capability: 'tts', data: result.data });
    }

    // ── Detect Language ──
    if (action === 'detect-language') {
      const { input } = body;
      if (!input) return jsonResponse({ error: 'input required' }, 400);

      console.log(`[sarvam-ai] Detect language: len=${input.length}`);
      const result = await callSarvam('/detect-language', { input }, apiKey);

      if (!result.ok) {
        console.error(`[sarvam-ai] Detect error [${result.status}]:`, JSON.stringify(result.data).slice(0, 300));
        return jsonResponse({ error: 'Language detection failed', details: result.data }, result.status);
      }
      return jsonResponse({ success: true, capability: 'detect-language', data: result.data });
    }

    // ── Transliterate ──
    if (action === 'transliterate') {
      const { input, source_language_code, target_language_code } = body;
      if (!input || !source_language_code || !target_language_code) {
        return jsonResponse({ error: 'input, source_language_code, and target_language_code required' }, 400);
      }

      console.log(`[sarvam-ai] Transliterate: ${source_language_code} → ${target_language_code}, len=${input.length}`);
      const result = await callSarvam('/transliterate', {
        input, source_language_code, target_language_code,
      }, apiKey);

      if (!result.ok) {
        console.error(`[sarvam-ai] Transliterate error [${result.status}]:`, JSON.stringify(result.data).slice(0, 300));
        return jsonResponse({ error: 'Transliteration failed', details: result.data }, result.status);
      }
      return jsonResponse({ success: true, capability: 'transliterate', data: result.data });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('[sarvam-ai] Unhandled error:', err.message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
