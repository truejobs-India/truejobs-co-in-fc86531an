

# Vertex AI Migration — Execution Plan (21 Functions)

This plan covers the exact code changes for all 21 edge functions. Once approved, implementation proceeds in 4 batches with verification after each.

---

## Batch 1: Category A Functions 1-6

### 1. `gemini-generate/index.ts`
- **Remove**: Lines 9-10 (`GEMINI_MODEL`, `GEMINI_URL` constants), lines 18-24 (`GEMINI_API_KEY` check), lines 49-55 (inline fetch to `generativelanguage`)
- **Add**: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts');` then `const text = await callVertexGemini('gemini-2.5-flash', fullPrompt, 60_000);`
- **Preserve**: Response shape `{ text, model }` — set `model` to `'gemini-2.5-flash'`

### 2. `job-search-ai/index.ts`
- **Remove**: Lines 45-48 (`GEMINI_API_KEY` check), lines 112-113 (`GEMINI_MODEL`/`GEMINI_URL`), lines 115-125 (inline fetch)
- **Add**: `callVertexGemini('gemini-2.5-flash', fullPrompt, 60_000, { maxOutputTokens: 1024, temperature: 0.7 })`
- **Preserve**: Response shape `{ response: aiResponse }`

### 3. `resume-ai/index.ts`
- **Remove**: Lines 14-15 (`GEMINI_MODEL`/`GEMINI_URL`), lines 170-207 (`callGeminiAI` function)
- **Replace** call at line 703: `await callVertexGemini('gemini-2.5-flash', fullPrompt, 60_000, { maxOutputTokens: 900, temperature: 0.3 })`
- **Keep**: Bedrock fallback path untouched

### 4. `company-research/index.ts`
- **Remove**: `GEMINI_API_KEY` check (lines 167-170), `GEMINI_MODEL`/`GEMINI_URL` constants (lines 168-169), inline fetch (lines 173-195)
- **Add**: `callVertexGemini('gemini-2.5-flash', fullPrompt, 60_000, { maxOutputTokens: 3000, temperature: 0.3 })`
- **Also remove**: The `GROQ_API_KEY` check at lines 91-96 (no longer relevant as primary gate)

### 5. `linkedin-import/index.ts`
- **Remove**: `GEMINI_API_KEY` check and inline fetch
- **Add**: `callVertexGemini('gemini-2.5-flash', parsePrompt, 60_000, { maxOutputTokens: 2048, temperature: 0.3 })`

### 6. `suggest-blog-internal-links/index.ts`
- **Remove**: Lines 98-99 (`GEMINI_MODEL`/`GEMINI_URL`), lines 108-111 (`GEMINI_API_KEY` check), lines 152-160 (inline fetch)
- **Add**: `callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 2000, temperature: 0.3 })`

---

## Batch 2: Category A Functions 7-12

### 7. `enrich-blog-articles/index.ts`
- **Remove**: Lines 9-10 (`GEMINI_MODEL`/`GEMINI_URL`), lines 12-28 (`callGeminiAI` function), lines 34/38-42 (`GEMINI_API_KEY` check)
- **Replace** call at line 96: `callVertexGemini('gemini-2.5-flash', prompt, 90_000)`
- **Note**: No `maxOutputTokens` was set — use default 8192

### 8. `generate-blog-seo/index.ts`
- **Remove**: Lines 29-30 (`GEMINI_MODEL`/`GEMINI_URL`), lines 32-47 (`callGemini` function), lines 56-58 (`GEMINI_API_KEY` check)
- **Replace** calls at lines 76, 104: `callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 500, temperature: 0.3 })`

### 9. `fix-seo-metadata/index.ts` — **SPECIAL CASE**
- **Remove**: Lines 30-31 (`GEMINI_MODEL`/`GEMINI_URL`), lines 83-86 (`GEMINI_API_KEY` check)
- **Primary call** (line 132): `callVertexGemini('gemini-2.5-pro', prompt, 60_000, { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: 'application/json' })`
- **Retry call** (line 192): `callVertexGemini('gemini-2.5-pro', retryPrompt, 60_000, { maxOutputTokens: 1500, temperature: 0.2 })` — without `responseMimeType`
- **Preserve**: Entire JSON parse + retry-without-mime-type logic intact

### 10. `analyze-blog-compliance-fixes/index.ts`
- **Remove**: Lines 29-30 (`GEMINI_MODEL`/`GEMINI_URL`), lines 99-102 (`GEMINI_API_KEY` check)
- **Replace** fetch at line 178: `callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 4000, temperature: 0.3 })`

### 11. `extract-employment-news/index.ts`
- **Remove**: Lines 12-51 (`callGemini` function with inline AI Studio fetch)
- **Replace** call at line 170: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); const rawText = await callVertexGemini('gemini-2.5-flash', systemPrompt + '\n\n' + text, 90_000, { responseMimeType: 'application/json', temperature: 0.1 }); const parsed = JSON.parse(rawText);`
- **Adapter**: Old `callGemini` returned parsed JSON directly. New helper returns text — add `JSON.parse()`.

### 12. `generate-guide-content/index.ts`
- **Remove**: Lines 406-428 (`callGemini` function), line 515-516 (`GEMINI_API_KEY` check)
- **Replace** call at line 557: `callVertexGemini('gemini-2.5-flash', systemPrompt, 90_000, { maxOutputTokens: 8192, temperature: 0.7 })`

---

## Batch 3: Category B Functions 13-17

### 13. `improve-blog-content/index.ts`
- **Remove**: Lines 110-148 (`callGemini` function with AI Studio path)
- **Update** dispatcher lines 296-301:
  - `gemini`/`gemini-flash`: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); const text = await callVertexGemini('gemini-2.5-flash', prompt, 90_000, { maxOutputTokens: maxTokens }); resultJson = JSON.stringify({ __raw: text, __finishReason: 'stop' }); actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-flash';`
  - `gemini-pro`: Same but with `'gemini-2.5-pro'`, `120_000` timeout
- **Adapter**: Wraps text in `JSON.stringify({ __raw, __finishReason })` — matches existing vertex-flash/vertex-pro pattern already in the file

### 14. `generate-blog-article/index.ts`
- **Remove**: Lines 241-266 (`callGemini` function with `systemInstruction`)
- **Update** dispatcher lines 538-539:
  - `gemini`/`gemini-flash`: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-flash', GEMINI_SYSTEM_PROMPT + '\n\n' + prompt, 60_000, { maxOutputTokens: mt, temperature: 0.65 });`
  - `gemini-pro`: Same with `'gemini-2.5-pro'`, `0.5` temperature
- **System prompt**: Concatenated into user prompt (same as other providers do)
- **Update** `resolveProviderInfo` lines 517-518: `'google-ai-studio'` → `'vertex-ai'`

### 15. `generate-resource-content/index.ts`
- **Remove**: Lines 16-36 (`callGemini` function)
- **Update** dispatcher lines 114-116: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 8192, temperature: 0.65 });`

### 16. `generate-custom-page/index.ts`
- **Remove**: Lines 17-37 (`callGemini` function)
- **Also check**: Lines 100-127 for `callGeminiPro` — this uses Lovable Gateway, NOT AI Studio. Keep it as-is.
- **Update** dispatcher line 163: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: maxTokens, temperature: 0.6 });`

### 17. `enrich-authority-pages/index.ts`
- **Remove**: Lines 414-463 (`fetchGemini` function)
- **Update** dispatcher lines 722-728: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); rawText = await callVertexGemini('gemini-2.5-flash', prompt, timeout, { maxOutputTokens: maxTokens || 16384, responseMimeType: 'application/json', temperature: 0.5, topP: 0.8 });`
  - `gemini-pro`: Same with `'gemini-2.5-pro'`
- **Update** `resolveProviderInfo` lines 695-696: `'google-ai-studio'` → `'vertex-ai'`

---

## Batch 4: Category B Functions 18-21

### 18. `classify-blog-articles/index.ts`
- **Remove**: Lines 125-158 (`callGeminiClassifier` function)
- **Update** dispatcher lines 331-336:
  - `gemini`/`gemini-flash`: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); const fullPrompt = systemPrompt + '\n\n' + userPrompt; rawText = await callVertexGemini('gemini-2.5-flash', fullPrompt, 90_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }); actualProvider = 'vertex-ai';`
  - `gemini-pro`: Same with `'gemini-2.5-pro'`

### 19. `rss-ai-process/index.ts`
- **Update** `callTextAI` lines 51-67: Replace inline AI Studio block with `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-flash', prompt, 90_000, { maxOutputTokens: maxTokens || 8192, temperature: 0.5 });`
- **Remove** the `GEMINI_API_KEY` lookup at line 52
- **Update** `resolveProviderInfo` lines 34-35: `'google-ai-studio'` → `'vertex-ai'`
- **Also update**: `GATEWAY_MODELS` map at lines 18-25 — remove `'gemini-flash'` and `'gemini-pro'` from gateway models (they're no longer gateway-routed)

### 20. `enrich-employment-news/index.ts`
- **Remove**: Lines 371-431 (`fetchGemini` function)
- **Update** dispatcher lines 648-661: `const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); const text = await callVertexGemini('gemini-2.5-flash', prompt, 90_000, { responseMimeType: 'application/json', temperature: 0.5 }); try { return tryParseJSON(text); } catch { ... }`
- **Update** `resolveProviderInfo` lines 570-571: `'google-ai-studio'` → `'vertex-ai'`

### 21. `generate-blog-faq/index.ts`
- **Remove**: Lines 32-46 (`callGemini` function)
- **Update** dispatcher line 180: `case 'gemini': case 'gemini-flash': { const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 4000, temperature: 0.4 }); }`

---

## Post-Migration Verification

After all 4 batches:
1. Search entire `supabase/functions/` for `GEMINI_API_KEY` — confirm zero references in migrated functions
2. Search for `generativelanguage.googleapis.com` — confirm zero references
3. Search for `google-ai-studio` in `resolveProviderInfo` — confirm zero references
4. Verify every migrated function imports `callVertexGemini` from `../_shared/vertex-ai.ts`
5. Confirm non-Gemini providers (Claude, Groq, Mistral, Nova, OpenAI, Lovable Gateway, Imagen) untouched

## What Is NOT Changed
- Non-Gemini providers (Claude, Groq, Mistral, Nova, OpenAI, Lovable Gateway, Imagen, Bedrock)
- Already-correct Vertex cases (`vertex-flash`, `vertex-pro` switch branches)
- `generate-seo-helper` (has its own inline Vertex helper — optional future cleanup)
- Category C functions (`generate-vertex-image`, `generate-resource-image`)
- No frontend changes needed

## Secrets Impact
- **Required** (already configured): `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY`, `GCP_PROJECT_ID`, `GCP_LOCATION`
- **Becomes unused**: `GEMINI_API_KEY`

