

## Word-Count Enforcement — Implementation for 4 Remaining Edge Functions + Frontend

All exploration is complete. Here are the exact changes for each of the 8 files.

---

### File 1: `supabase/functions/enrich-authority-pages/index.ts`

**Add import at line 3:**
```ts
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';
```

**Add `maxTokens` parameter to `callAI` (line 692):**
```ts
async function callAI(
  model: string, prompt: string, slug: string, startedAtMs: number, maxTokens?: number,
): Promise<{ data: Record<string, unknown>; diagnostics?: Record<string, unknown> }> {
```

**Pass `maxTokens` to providers (lines 713-758):**
- Line 714: `maxOutputTokens: 16384` → `maxOutputTokens: maxTokens || 16384`
- Line 725: `maxOutputTokens: 16384` → `maxOutputTokens: maxTokens || 16384`
- Line 431 (fetchGemini): `maxOutputTokens: 16384` → accept `maxOutputTokens` param, pass `maxTokens || 16384`
- Line 445 (retry): same
- Line 484 (callGroqRaw): `max_tokens: 16384` → accept param, pass `maxTokens || 16384`
- Line 568 (callMistralRaw): `max_tokens: 16384` → accept param
- Line 602 (callLovableGeminiRaw): `max_tokens: 16384` → accept param
- Line 637 (callOpenAIRaw): `max_completion_tokens: 16384` → accept param
- Line 758: `maxTokens: 16384` → `maxTokens: maxTokens || 16384`

**Remove default fallback (lines 761-764):**
```ts
default:
  throw new Error(`Unsupported model: "${model}". No silent fallback allowed.`);
```

**Replace `countWords` (lines 963-965) to use `countWordsFromHtml` for HTML:**
```ts
function countWords(text: string): number {
  if (text.includes('<')) return countWordsFromHtml(text);
  return text.trim().split(/\s+/).filter(Boolean).length;
}
```

**Content-only word count validation (after line 1224):**

Only count visible content fields, NOT metadata like `meta_title`, `meta_description`, `internal_links`:
```ts
// Content fields that represent visible user-facing HTML/text
const CONTENT_FIELD_KEYS = new Set([
  'overview', 'eligibility', 'vacancyDetails', 'examPattern', 'salary',
  'applicationProcess', 'importantDates', 'preparationTips', 'cutoffTrends', 'importantLinks',
]);

const contentHtmlForValidation = Object.entries(enrichmentData)
  .filter(([key, value]) => {
    if (key === 'faq' && Array.isArray(value)) return true;
    return CONTENT_FIELD_KEYS.has(key) && typeof value === 'string';
  })
  .map(([key, value]) => {
    if (key === 'faq' && Array.isArray(value)) {
      return (value as any[]).map(f => `${f.question || ''} ${f.answer || ''}`).join(' ');
    }
    return value as string;
  })
  .join(' ');

const targetWordCount = getMinWordCount(pageType);
const requestedMaxTokens = computeMaxTokens(targetWordCount, selectedModel);
const wcValidation = validateWordCount(contentHtmlForValidation, targetWordCount, requestedMaxTokens);
```

**Pass maxTokens in main handler (line 1194):**
```ts
const targetWordCount = getMinWordCount(pageType);
const maxTokens = computeMaxTokens(targetWordCount, selectedModel);
const result = await callAI(selectedModel, prompt, slug, aiStartedAtMs, maxTokens);
```

**Map actualProviderUsed and actualModelUsed accurately in responses.**

Provider mapping helper (add before main handler):
```ts
function resolveProviderInfo(model: string): { provider: string; apiModel: string } {
  switch (model) {
    case 'gemini-flash': case 'gemini': return { provider: 'google-ai-studio', apiModel: 'gemini-2.5-flash' };
    case 'gemini-pro': return { provider: 'google-ai-studio', apiModel: 'gemini-2.5-pro' };
    case 'vertex-flash': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-flash' };
    case 'vertex-pro': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-pro' };
    case 'claude-sonnet': case 'claude': return { provider: 'anthropic', apiModel: 'claude-sonnet-4-6' };
    case 'groq': return { provider: 'groq', apiModel: 'llama-3.3-70b-versatile' };
    case 'mistral': return { provider: 'bedrock', apiModel: 'mistral.mistral-large-2407-v1:0' };
    case 'lovable-gemini': return { provider: 'lovable-gateway', apiModel: 'google/gemini-2.5-flash' };
    case 'gpt5': return { provider: 'lovable-gateway', apiModel: 'openai/gpt-5' };
    case 'gpt5-mini': return { provider: 'lovable-gateway', apiModel: 'openai/gpt-5-mini' };
    case 'nova-pro': return { provider: 'bedrock', apiModel: 'us.amazon.nova-pro-v1:0' };
    case 'nova-premier': return { provider: 'bedrock', apiModel: 'us.amazon.nova-premier-v1:0' };
    default: return { provider: model, apiModel: model };
  }
}
```

**Add metadata to success response (lines 1296-1307):**
```ts
const providerInfo = resolveProviderInfo(selectedModel);
return new Response(JSON.stringify({
  status: resultStatus,
  slug,
  model: selectedModel,
  totalWords: quality.totalWords,
  sectionCount: quality.sectionCount,
  version,
  diagnostics: aiDiagnostics || null,
  selectedModelId: selectedModel,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: wcValidation,
  results: [result],
}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

**Add metadata to error responses (lines 1209-1220):**
```ts
const providerInfo = resolveProviderInfo(selectedModel);
return new Response(JSON.stringify({
  status: 'failed', slug, error: reason,
  selectedModelId: selectedModel,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: null,
  diagnostics: errDiagnostics || null,
  results: [{ slug, status: 'failed', ... }],
}), ...);
```

---

### File 2: `supabase/functions/enrich-employment-news/index.ts`

**Add import at line 2:**
```ts
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';
```

**Add same `resolveProviderInfo` helper** (same function as above, scoped to this file).

**Update `callMistralRaw` (line 478):** Add `maxTokens` param:
```ts
async function callMistralRaw(prompt: string, maxTokens?: number): Promise<string> {
  // ...
  inferenceConfig: { maxTokens: maxTokens || 16384, temperature: 0.5 },
```

**Update `callClaudeRaw` (line 495):** Add `maxTokens` param:
```ts
async function callClaudeRaw(prompt: string, maxTokens?: number): Promise<string> {
  // ...
  max_tokens: maxTokens || 8192,
```

**Update `callLovableGeminiRaw` (line 531):** Add `maxTokens` param:
```ts
async function callLovableGeminiRaw(prompt: string, maxTokens?: number): Promise<string> {
  // ...
  max_tokens: maxTokens || 8192,
```

**Update `callAI` (line 567):** Add `maxTokens` param and pass through:
```ts
async function callAI(model: string, prompt: string, maxTokens?: number): Promise<any> {
  // Pass maxTokens to each provider:
  case 'mistral': rawText = await callMistralRaw(prompt, maxTokens); break;
  case 'claude-sonnet': case 'claude': rawText = await callClaudeRaw(prompt, maxTokens); break;
  case 'lovable-gemini': rawText = await callLovableGeminiRaw(prompt, maxTokens); break;
  case 'vertex-flash': rawText = await callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: maxTokens || 16384 }); break;
  case 'vertex-pro': rawText = await callVertexGemini('gemini-2.5-pro', prompt, 120_000, { maxOutputTokens: maxTokens || 16384 }); break;
  case 'nova-pro': case 'nova-premier': rawText = await callBedrockNova(model, prompt, { maxTokens: maxTokens || 16384, temperature: 0.5 }); break;
```

**Fix silent Lovable Gateway fallback in retry (line 635):**
```ts
else throw new Error(`JSON parse retry not supported for model: ${model}. Re-select and try again.`);
```

**Add word count instruction + validation in main handler (lines 764-837):**
```ts
const enrichTargetWords = 1200;
const maxTokens = computeMaxTokens(enrichTargetWords, useModel);
const wcInstruction = buildWordCountInstruction(enrichTargetWords, useModel);
const combinedPrompt = MASTER_ENRICH_PROMPT + "\n\n" + wcInstruction + "\n\n" + userDataPrompt;
const enriched = await callAI(useModel, combinedPrompt, maxTokens);
```

After successful DB update (line 837), add validation:
```ts
const wcValidation = enriched.enriched_description
  ? validateWordCount(enriched.enriched_description, enrichTargetWords, maxTokens)
  : null;
const providerInfo = resolveProviderInfo(useModel);
return {
  id: jobId, success: true,
  selectedModelId: useModel,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: wcValidation,
};
```

Error returns also get metadata:
```ts
return {
  id: jobId, success: false, error: errorMsg,
  selectedModelId: useModel,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: null,
};
```

---

### File 3: `supabase/functions/rss-ai-process/index.ts`

**Add import at line 6:**
```ts
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';
```

**Add `resolveProviderInfo` helper** (same pattern).

**Update `callTextAI` signature (line 31):** Add `maxTokens` param:
```ts
async function callTextAI(model: string, prompt: string, maxTokens?: number): Promise<string> {
```

**Pass `maxTokens` to each provider:**
- Line 42: `maxOutputTokens: 8192` → `maxOutputTokens: maxTokens || 8192`
- Line 57: `max_tokens: 8192` → `max_tokens: maxTokens || 8192`
- Line 70: `max_tokens: 8192` → `max_tokens: maxTokens || 8192`
- Line 80: `{ maxOutputTokens: 8192, ... }` → `{ maxOutputTokens: maxTokens || 8192, ... }`
- Line 85: `maxTokens: 8192` → `maxTokens: maxTokens || 8192`
- Line 95: `max_tokens: 8192` → `max_tokens: maxTokens || 8192`

**Replace catch-all gateway fallback (lines 88-104):**
Known gateway models (`lovable-gemini`, `gpt5`, `gpt5-mini`) keep their explicit branches. Unknown models throw:
```ts
throw new Error(`Unsupported AI model: "${model}". No silent fallback.`);
```

**Update `buildEnrichPrompt` (line 217):** Replace inline word count instruction with placeholder that caller appends to.

**In `handleEnrich` (lines 457-468):** Compute dynamic budget and validate:
```ts
const maxTokens = computeMaxTokens(wordLimit, model);
const wcInstruction = buildWordCountInstruction(wordLimit, model);
const prompt = buildEnrichPrompt(item, proc?.analysis_output, wordLimit) + '\n\n' + wcInstruction;
const raw = await callTextAI(model, prompt, maxTokens);
const parsed = parseJsonSafe(raw);

const articleBody = typeof parsed?.article_body === 'string' ? parsed.article_body : '';
const wcValidation = articleBody ? validateWordCount(articleBody, wordLimit, maxTokens) : null;
const providerInfo = resolveProviderInfo(model);

await client.from('rss_ai_processing').update({
  enrichment_status: 'completed',
  enrichment_output: parsed,
  enrichment_run_at: new Date().toISOString(),
  enrichment_error: null,
}).eq('id', procId);

results.push({
  itemId, status: 'completed',
  selectedModelId: model,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: wcValidation,
});
```

Error results also include metadata:
```ts
results.push({
  itemId, status: 'error', error: e.message?.substring(0, 200),
  selectedModelId: model,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: null,
});
```

---

### File 4: `supabase/functions/generate-blog-article/index.ts`

**Add import at line 1:**
```ts
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';
```

**Add `resolveProviderInfo` helper** (adapted for this file's models).

**Update provider functions to accept `maxTokens` param:**
- `callLovableGemini(prompt, maxTokens = 16000)` — line 268, use param at line 277
- `callOpenAI(prompt, maxTokens = 16000)` — line 291, use param at line 300
- `callGroq(prompt, maxTokens = 16000)` — line 310, use param at line 319
- `callMistral(prompt, systemPrompt?, maxTokens = 8192)` — line 492, use param at line 500

**Update `callAI` dispatcher (lines 515-541) to use dynamic budgets:**
```ts
async function callAI(model: string, prompt: string, wordLimit = 1500): Promise<string> {
  const mt = computeMaxTokens(wordLimit, model);
  console.log(`[generate-blog-article] model=${model} wordLimit=${wordLimit} maxTokens=${mt}`);
  switch (model) {
    case 'gemini': case 'gemini-flash': return callGemini(prompt, GEMINI_SYSTEM_PROMPT, mt, 0.65, 'gemini-2.5-flash');
    case 'gemini-pro': return callGemini(prompt, GEMINI_SYSTEM_PROMPT, mt, 0.5, 'gemini-2.5-pro');
    case 'lovable-gemini': return callLovableGemini(prompt, mt);
    case 'openai': case 'gpt5': case 'gpt5-mini': return callOpenAI(prompt, mt);
    case 'groq': return callGroq(prompt, mt);
    case 'claude-sonnet': case 'claude': return callClaude(prompt, wordLimit);
    case 'mistral': return callMistral(prompt, MISTRAL_SYSTEM_PROMPT, mt);
    case 'vertex-flash': { const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: mt }); }
    case 'vertex-pro': { const { callVertexGemini } = await import('../_shared/vertex-ai.ts'); return callVertexGemini('gemini-2.5-pro', prompt, 120_000, { maxOutputTokens: mt }); }
    case 'nova-pro': case 'nova-premier': { const { callBedrockNova } = await import('../_shared/bedrock-nova.ts'); return callBedrockNova(model, prompt, { maxTokens: mt, temperature: 0.5 }); }
    default: throw new Error(`Unsupported AI model: "${model}".`);
  }
}
```

**Update Claude maxTokens (line 450):**
```ts
max_tokens: computeMaxTokens(wordLimit, 'claude-sonnet'),
```

**Append word count instruction to all prompts (before line 721):**
```ts
prompt += '\n\n' + buildWordCountInstruction(wordTarget, useModel);
```

**Add validation + metadata to success response (lines 781-793):**
```ts
const wcMaxTokens = computeMaxTokens(wordTarget, useModel);
const wcValidation = parsed.content ? validateWordCount(parsed.content, wordTarget, wcMaxTokens) : null;
const providerInfo = resolveProviderInfo(useModel);

return new Response(JSON.stringify({
  title: parsed.title, slug, content: parsed.content,
  metaTitle: parsed.metaTitle || parsed.title.substring(0, 60),
  metaDescription: parsed.metaDescription || '',
  excerpt: parsed.excerpt || '', category: normalizedCategory,
  tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  primaryKeyword: parsed.primaryKeyword || '',
  secondaryKeywords: Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords : [],
  suggestedInternalLinks: Array.isArray(parsed.suggestedInternalLinks) ? parsed.suggestedInternalLinks : [],
  selectedModelId: useModel,
  actualProviderUsed: providerInfo.provider,
  actualModelUsed: providerInfo.apiModel,
  wordCountValidation: wcValidation,
}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

**Error response (lines 794-797) also gets metadata:**
```ts
return new Response(JSON.stringify({
  error: err instanceof Error ? err.message : 'Unknown error',
  selectedModelId: useModel || 'unknown',
  actualProviderUsed: 'unknown',
  actualModelUsed: 'unknown',
  wordCountValidation: null,
}), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

---

### File 5: `src/components/admin/ContentEnricher.tsx`

**Lines 285-292 — Add non-blocking word count warning:**
After `result.status === 'success' || result.status === 'flagged'`:
```ts
succeeded++;
const wcv = data?.wordCountValidation;
let wcNote = '';
if (wcv?.status === 'fail') {
  wcNote = ` · ⚠ Word count: ${wcv.actualWordCount}/${wcv.targetWordCount} (significantly off target)`;
} else if (wcv?.status === 'warn') {
  wcNote = ` · ℹ Word count: ${wcv.actualWordCount}/${wcv.targetWordCount} (slightly outside range)`;
}
addMessage(
  result.status === 'flagged' ? 'warning' : 'success',
  `✓ ${slug}`,
  `${result.totalWords} words · ${result.sectionsAdded.length} sections · Score: W${result.qualityScore.wordScore}/S${result.qualityScore.sectionScore}${wcNote}`
);
```

Content is always saved. The status of the message stays `success` or `warning` (for flagged) — never downgraded to `error` because of word count.

---

### File 6: `src/components/admin/EmploymentNewsManager.tsx`

**Lines 404-416 — Add non-blocking word count summary to toast:**
```ts
} else {
  successTotal += data?.successCount || 0;
  failTotal += data?.failCount || 0;
  // Check for word count warnings (non-blocking — content already saved)
  const wcIssues = (data?.results || []).filter((r: any) =>
    r.wordCountValidation?.status === 'warn' || r.wordCountValidation?.status === 'fail'
  ).length;
  if (wcIssues > 0) {
    console.log(`[enrich] ${wcIssues} items had word count outside target range`);
  }
}
```

In the final toast (line 413-416), add word count info:
```ts
toast({
  title: 'Enrichment Complete',
  description: `${successTotal} enriched, ${failTotal} failed`,
});
```
This stays the same — no downgrade. Word count issues are logged for now.

---

### File 7: `src/components/admin/rss-intake/RssAiActionModal.tsx`

**Lines 93-95 — After batch results, count word count issues (non-blocking):**
```ts
const wcIssues = batchResults.filter(r =>
  (r as any).wordCountValidation?.status === 'warn' || (r as any).wordCountValidation?.status === 'fail'
).length;
if (wcIssues > 0) {
  console.log(`[rss-ai] ${wcIssues} enriched items had word count outside target range`);
}
```

No blocking, no UI downgrade. Content already saved successfully.

---

### File 8: `src/components/admin/BlogPostEditor.tsx`

**Lines 1004 and 1055 — Prefer backend word count when available:**
```ts
const wordCount = data.wordCountValidation?.actualWordCount
  || data.content.replace(/<[^>]+>/g, '').split(/\s+/).filter((w: string) => w.length > 0).length;
```

**After successful generation (after line 1002 and after line 1053) — Add non-blocking toast:**
```ts
if (data.wordCountValidation?.status === 'fail') {
  toast({ title: `⚠ Word count: ${data.wordCountValidation.actualWordCount} words (target: ${data.wordCountValidation.targetWordCount}). Significantly off target.` });
} else if (data.wordCountValidation?.status === 'warn') {
  toast({ title: `ℹ Word count: ${data.wordCountValidation.actualWordCount} words (target: ${data.wordCountValidation.targetWordCount}). Slightly outside range.` });
}
```

Article is always inserted into DB regardless. The warning is additive only.

---

### Key Design Constraints

1. **`actualProviderUsed` and `actualModelUsed`** are mapped to real provider family and API model name via `resolveProviderInfo()`, NOT just set equal to `selectedModelId`.

2. **`enrich-authority-pages` word count validation** only counts content fields (`overview`, `eligibility`, `vacancyDetails`, etc.) and FAQ items. Excludes `meta_title`, `meta_description`, `internal_links`.

3. **Frontend warnings are additive only.** No generated content is discarded. No success is downgraded to error. Admin sees warning and decides whether to keep or retry.

4. **Token budget changes:**

| Function | Model | Before | After (target 1500) |
|---|---|---|---|
| enrich-authority-pages | nova-pro (target 2000) | 16384 | 4000 |
| enrich-authority-pages | vertex-flash (target 2000) | 16384 | 4000 |
| enrich-employment-news | nova-pro (target 1200) | 16384 | 2400 |
| rss-ai-process | all models (target 800) | 8192 | 1600 |
| generate-blog-article | gemini-flash (target 1500) | 16384 | 3000 |
| generate-blog-article | gemini-pro (target 1500) | 32768 | 3000 |
| generate-blog-article | lovable-gemini (target 1500) | 16000 | 3000 |
| generate-blog-article | nova-pro (target 1500) | 8192 | 3000 |

5. **Silent fallbacks removed:** Default cases in `enrich-authority-pages` (defaulted to gemini) and `enrich-employment-news` (retry fell back to Lovable Gateway) now throw explicit errors.

