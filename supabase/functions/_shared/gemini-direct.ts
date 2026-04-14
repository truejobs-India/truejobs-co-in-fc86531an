/**
 * Shared Google Gemini Direct API helper for edge functions.
 * Uses GEMINI_API_KEY via generativelanguage.googleapis.com (no Vertex AI, no GCP service account).
 */

/** Options to customize Gemini generation beyond defaults */
export interface GeminiDirectOptions {
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
 * Call Google Gemini API directly and return raw text.
 * @param model - e.g. 'gemini-2.5-flash' or 'gemini-2.5-pro'
 * @param prompt - user prompt text
 * @param timeoutMs - request timeout (default 60s)
 * @param options - generation config overrides
 */
export async function callGeminiDirect(
  model: string,
  prompt: string,
  timeoutMs = 60_000,
  options?: GeminiDirectOptions,
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  console.log(`[gemini-direct] model=${model} timeout=${timeoutMs}ms maxTokens=${generationConfig.maxOutputTokens} mimeType=${generationConfig.responseMimeType || 'text/plain'} promptLen=${prompt.length}`);

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      });

      if (resp.status === 429 && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
        console.log(`[gemini-direct] 429 rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API error (${resp.status}): ${errText.substring(0, 500)}`);
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const text = candidate?.content?.parts?.[0]?.text || '';
      console.log(`[gemini-direct] model=${model} responseLen=${text.length} finishReason=${finishReason}`);

      if (!text && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = 3000 + Math.random() * 2000;
        console.log(`[gemini-direct] Empty response (finishReason=${finishReason}), retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!text) {
        throw new Error(`Gemini API returned empty response (finishReason=${finishReason}, blockReason=${data?.promptFeedback?.blockReason || 'none'})`);
      }

      return text;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`GEMINI_TIMEOUT: Request to ${model} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Gemini API: max retries exceeded (429)');
}

/** Same as callGeminiDirect but returns { text, finishReason } for callers that need truncation detection. */
export async function callGeminiDirectWithMeta(
  model: string,
  prompt: string,
  timeoutMs = 60_000,
  options?: GeminiDirectOptions,
): Promise<{ text: string; finishReason: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.6,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
  };
  if (options?.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;
  if (options?.topP !== undefined) generationConfig.topP = options.topP;

  console.log(`[gemini-direct-meta] model=${model} timeout=${timeoutMs}ms maxTokens=${generationConfig.maxOutputTokens} promptLen=${prompt.length}`);

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      });

      if ((resp.status === 429 || resp.status === 503) && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
        console.log(`[gemini-direct-meta] ${resp.status} ${resp.status === 503 ? 'service unavailable' : 'rate limited'}, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API error (${resp.status}): ${errText.substring(0, 500)}`);
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason || 'unknown';
      const text = candidate?.content?.parts?.[0]?.text || '';
      console.log(`[gemini-direct-meta] model=${model} responseLen=${text.length} finishReason=${finishReason}`);

      if (!text && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = 3000 + Math.random() * 2000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!text) {
        throw new Error(`Gemini API returned empty response (finishReason=${finishReason}, blockReason=${data?.promptFeedback?.blockReason || 'none'})`);
      }

      const normalizedReason = finishReason === 'MAX_TOKENS' ? 'length' : finishReason === 'STOP' ? 'stop' : finishReason.toLowerCase();
      return { text, finishReason: normalizedReason };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`GEMINI_TIMEOUT: Request to ${model} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Gemini API: max retries exceeded (429)');
}

/**
 * Call Gemini image-capable model via direct API with responseModalities: ['IMAGE', 'TEXT'].
 * Returns base64-encoded image data.
 */
export async function callGeminiDirectImage(
  model: string,
  prompt: string,
  timeoutMs = 120_000,
): Promise<{ base64: string; mimeType: string; altText?: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log(`[gemini-direct-image] model=${model} timeout=${timeoutMs}ms promptLen=${prompt.length}`);

  const maxRetries = 5;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.8,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
        signal: controller.signal,
      });

      if (resp.status === 429 && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = Math.min(5000 * Math.pow(2, attempt), 60000) + Math.random() * 2000;
        console.log(`[gemini-direct-image] 429 rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (resp.status >= 500 && attempt < maxRetries) {
        clearTimeout(timer);
        const wait = Math.min(4000 * Math.pow(2, attempt), 30000);
        console.warn(`[gemini-direct-image] ${resp.status}, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        if (resp.status === 403) throw new Error(`GEMINI_ACCESS_DENIED:${errText.substring(0, 200)}`);
        throw new Error(`GEMINI_API_ERROR:${resp.status}:${errText.substring(0, 200)}`);
      }

      const data = await resp.json();
      const candidates = data?.candidates;
      if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) throw new Error(`GEMINI_BLOCKED:${blockReason}`);
        throw new Error('GEMINI_NO_CANDIDATES');
      }

      const parts = candidates[0]?.content?.parts;
      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        const finishReason = candidates[0]?.finishReason;
        throw new Error(`GEMINI_NO_PARTS:finishReason=${finishReason || 'unknown'}`);
      }

      let altText: string | undefined;
      for (const part of parts) {
        if (part?.inlineData && typeof part.inlineData === 'object' && part.inlineData.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          // Also capture any text part as alt text
          for (const p of parts) {
            if (p.text && p.text.trim().length > 10 && p.text.trim().length < 200) {
              altText = p.text.trim();
            }
          }
          return { base64: part.inlineData.data, mimeType: mime, altText };
        }
      }

      throw new Error('MODEL_RETURNED_NO_IMAGE');
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (attempt < maxRetries) {
          const wait = Math.min(6000 * (attempt + 1), 20_000);
          console.warn(`[gemini-direct-image] timeout, retry ${attempt + 1}/${maxRetries} after ${Math.round(wait)}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error('GEMINI_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('GEMINI_EXHAUSTED_RETRIES');
}
