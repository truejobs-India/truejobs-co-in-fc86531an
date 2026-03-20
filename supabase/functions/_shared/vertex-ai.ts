/**
 * Shared Vertex AI helper for edge functions.
 * Provides GCP Service Account JWT auth and Gemini API calls.
 */

function base64url(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function getVertexAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('GCP_CLIENT_EMAIL');
  const privateKeyPem = Deno.env.get('GCP_PRIVATE_KEY');
  if (!clientEmail || !privateKeyPem) throw new Error('GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail, sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
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

  const { access_token } = await tokenResp.json();
  return access_token;
}

/** Options to customize Vertex AI generation beyond defaults */
export interface VertexGeminiOptions {
  /** Max output tokens (default: 8192) */
  maxOutputTokens?: number;
  /** Temperature (default: 0.6) */
  temperature?: number;
  /** Response MIME type — set to 'application/json' to force JSON output */
  responseMimeType?: string;
  /** Top-P sampling (optional) */
  topP?: number;
}

/**
 * Call Vertex AI Gemini model and return raw text.
 * @param model - e.g. 'gemini-2.5-flash' or 'gemini-2.5-pro'
 * @param prompt - user prompt text
 * @param timeoutMs - request timeout (default 60s)
 * @param options - generation config overrides
 */
export async function callVertexGemini(
  model: string,
  prompt: string,
  timeoutMs = 60_000,
  options?: VertexGeminiOptions,
): Promise<string> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID not configured');

  const accessToken = await getVertexAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  // Note: controller & timer are created per-attempt inside the loop below

  // Build generationConfig with caller overrides
  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.6,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
  };
  if (options?.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }
  if (options?.topP !== undefined) {
    generationConfig.topP = options.topP;
  }

  console.log(`[vertex-ai] model=${model} timeout=${timeoutMs}ms maxTokens=${generationConfig.maxOutputTokens} mimeType=${generationConfig.responseMimeType || 'text/plain'} promptLen=${prompt.length}`);

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      });

      if (resp.status === 429 && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
        console.log(`[vertex-ai] 429 rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Vertex AI error (${resp.status}): ${errText.substring(0, 500)}`);
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const text = candidate?.content?.parts?.[0]?.text || '';
      console.log(`[vertex-ai] model=${model} responseLen=${text.length} finishReason=${finishReason}`);

      // Empty response with retries remaining — retry (model sometimes returns empty on overload)
      if (!text && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = 3000 + Math.random() * 2000;
        console.log(`[vertex-ai] Empty response (finishReason=${finishReason}), retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!text) {
        throw new Error(`Vertex AI returned empty response (finishReason=${finishReason}, blockReason=${data?.promptFeedback?.blockReason || 'none'})`);
      }

      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Vertex AI: max retries exceeded (429)');
}

/** Same as callVertexGemini but returns { text, finishReason } for callers that need truncation detection. */
export async function callVertexGeminiWithMeta(
  model: string,
  prompt: string,
  timeoutMs = 60_000,
  options?: VertexGeminiOptions,
): Promise<{ text: string; finishReason: string }> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID not configured');

  const accessToken = await getVertexAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.6,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
  };
  if (options?.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;
  if (options?.topP !== undefined) generationConfig.topP = options.topP;

  console.log(`[vertex-ai-meta] model=${model} timeout=${timeoutMs}ms maxTokens=${generationConfig.maxOutputTokens} promptLen=${prompt.length}`);

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      });

      if (resp.status === 429 && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
        console.log(`[vertex-ai-meta] 429 rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Vertex AI error (${resp.status}): ${errText.substring(0, 500)}`);
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason || 'unknown';
      const text = candidate?.content?.parts?.[0]?.text || '';
      console.log(`[vertex-ai-meta] model=${model} responseLen=${text.length} finishReason=${finishReason}`);

      if (!text && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = 3000 + Math.random() * 2000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!text) {
        throw new Error(`Vertex AI returned empty response (finishReason=${finishReason}, blockReason=${data?.promptFeedback?.blockReason || 'none'})`);
      }

      // Map Vertex finish reasons to normalized values
      const normalizedReason = finishReason === 'MAX_TOKENS' ? 'length' : finishReason === 'STOP' ? 'stop' : finishReason.toLowerCase();
      return { text, finishReason: normalizedReason };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Vertex AI: max retries exceeded (429)');
}
