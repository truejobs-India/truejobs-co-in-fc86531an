/**
 * Shared Bedrock Converse API caller for Amazon Nova models.
 * Uses AWS SigV4 signing, same pattern as the existing Mistral Bedrock integration.
 *
 * Supports:
 *   - amazon.nova-pro-v1:0
 *   - amazon.nova-premier-v1:0
 *
 * Nova uses the Converse API with the same request/response format as Mistral.
 */

// ── AWS SigV4 Signing Helpers ──

async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  data: string,
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const ck = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', ck, enc.encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function awsSigV4Fetch(
  host: string,
  rawPath: string,
  body: string,
  region: string,
  service: string,
): Promise<Response> {
  const ak = Deno.env.get('AWS_ACCESS_KEY_ID');
  const sk = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!ak || !sk) throw new Error('AWS credentials not configured');

  const encodedUri =
    '/' +
    rawPath
      .split('/')
      .filter(Boolean)
      .map((s) => encodeURIComponent(s))
      .join('/');
  const canonicalUri =
    '/' +
    rawPath
      .split('/')
      .filter(Boolean)
      .map((s) => encodeURIComponent(encodeURIComponent(s)))
      .join('/');

  const now = new Date();
  const dateStamp = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, '')
    .slice(0, 8);
  const amzDate =
    now
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, '')
      .slice(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const enc = new TextEncoder();
  let sigKey = await hmacSha256(enc.encode(`AWS4${sk}`), dateStamp);
  sigKey = await hmacSha256(sigKey, region);
  sigKey = await hmacSha256(sigKey, service);
  sigKey = await hmacSha256(sigKey, 'aws4_request');
  const sig = Array.from(new Uint8Array(await hmacSha256(sigKey, stringToSign)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return fetch(`https://${host}${encodedUri}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
    body,
  });
}

// ── Nova Model Definitions ──

export const NOVA_MODELS: Record<string, { modelId: string; label: string }> = {
  'nova-pro': {
    modelId: 'amazon.nova-pro-v1:0',
    label: 'Amazon Nova Pro',
  },
  'nova-premier': {
    modelId: 'amazon.nova-premier-v1:0',
    label: 'Amazon Nova Premier',
  },
};

// ── Hindi font safeguard for Nova ──

/**
 * If the prompt contains Hindi content markers or the output language is Hindi,
 * prepend an explicit instruction for Nova to use Devanagari script.
 */
export function applyNovaHindiSafeguard(prompt: string): string {
  const hindiMarkers = [
    'हिंदी', 'हिन्दी', 'hindi', 'in hindi', 'hindi mein', 'hindi me',
    'hindimein', 'hindime', 'language: hindi', 'language:hindi',
    'भाषा', 'devanagari',
  ];
  const lowerPrompt = prompt.toLowerCase();
  const needsHindi = hindiMarkers.some((m) => lowerPrompt.includes(m));

  if (!needsHindi) return prompt;

  const hindiInstruction = `\n\n[IMPORTANT — Hindi Output Requirement]\nYou MUST write ALL Hindi text using the Devanagari script (हिन्दी लिपि). Do NOT use romanized/transliterated Hindi. Every Hindi word, sentence, heading, and paragraph must use proper Hindi Devanagari Unicode fonts. Example: "सरकारी नौकरी" NOT "Sarkari Naukri".\n`;
  return hindiInstruction + prompt;
}

// ── Main Converse API Caller ──

export interface NovaCallOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}

/**
 * Call an Amazon Nova model via AWS Bedrock Converse API.
 * @param modelKey - 'nova-pro' or 'nova-premier'
 * @param prompt - User prompt text
 * @param options - Optional config (maxTokens, temperature, timeout, systemPrompt)
 */
export async function callBedrockNova(
  modelKey: string,
  prompt: string,
  options: NovaCallOptions = {},
): Promise<string> {
  const modelDef = NOVA_MODELS[modelKey];
  if (!modelDef) {
    throw new Error(`Unknown Nova model key: "${modelKey}". Valid keys: ${Object.keys(NOVA_MODELS).join(', ')}`);
  }

  const {
    maxTokens = 16384,
    temperature = 0.5,
    timeoutMs = 120_000,
    systemPrompt,
  } = options;

  // Apply Hindi safeguard for Nova models
  const processedPrompt = applyNovaHindiSafeguard(prompt);

  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  const host = `bedrock-runtime.${region}.amazonaws.com`;

  const payload: Record<string, unknown> = {
    messages: [{ role: 'user', content: [{ text: processedPrompt }] }],
    inferenceConfig: { maxTokens, temperature },
  };

  if (systemPrompt) {
    payload.system = [{ text: systemPrompt }];
  }

  const body = JSON.stringify(payload);

  const resp = await Promise.race([
    awsSigV4Fetch(host, `/model/${modelDef.modelId}/converse`, body, region, 'bedrock'),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${modelDef.label} timeout after ${timeoutMs / 1000}s`)), timeoutMs),
    ),
  ]);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`${modelDef.label} Bedrock error ${resp.status}: ${errText.substring(0, 500)}`);
  }

  const data = await resp.json();
  const text = data?.output?.message?.content?.[0]?.text || '';

  if (!text.trim()) {
    throw new Error(`${modelDef.label} returned empty response`);
  }

  console.log(`[bedrock-nova] ${modelDef.label} success, output length=${text.length}`);
  return text;
}

/**
 * Get the stopReason from a Converse API response for dispatchers
 * that track finish reasons.
 */
export async function callBedrockNovaWithMeta(
  modelKey: string,
  prompt: string,
  options: NovaCallOptions = {},
): Promise<{ text: string; stopReason: string }> {
  const modelDef = NOVA_MODELS[modelKey];
  if (!modelDef) {
    throw new Error(`Unknown Nova model key: "${modelKey}"`);
  }

  const {
    maxTokens = 16384,
    temperature = 0.5,
    timeoutMs = 120_000,
    systemPrompt,
  } = options;

  const processedPrompt = applyNovaHindiSafeguard(prompt);
  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  const host = `bedrock-runtime.${region}.amazonaws.com`;

  const payload: Record<string, unknown> = {
    messages: [{ role: 'user', content: [{ text: processedPrompt }] }],
    inferenceConfig: { maxTokens, temperature },
  };
  if (systemPrompt) {
    payload.system = [{ text: systemPrompt }];
  }

  const body = JSON.stringify(payload);
  const resp = await Promise.race([
    awsSigV4Fetch(host, `/model/${modelDef.modelId}/converse`, body, region, 'bedrock'),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${modelDef.label} timeout after ${timeoutMs / 1000}s`)), timeoutMs),
    ),
  ]);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`${modelDef.label} Bedrock error ${resp.status}: ${errText.substring(0, 500)}`);
  }

  const data = await resp.json();
  const text = data?.output?.message?.content?.[0]?.text || '';
  const stopReason = data?.stopReason || 'end_turn';

  console.log(`[bedrock-nova] ${modelDef.label} success, len=${text.length}, stop=${stopReason}`);
  return { text, stopReason };
}
