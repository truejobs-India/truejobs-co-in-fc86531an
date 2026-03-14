

## Plan: Overhaul `enrich-authority-pages/index.ts` — Master Prompt, Multi-Model, Graceful Failures

### Summary

Rewrite the edge function to: (1) add the full `MASTER_AUTHORITY_PROMPT`, (2) wire up the multi-model `callAI()` dispatcher matching UI values, (3) ensure every model function fails gracefully with a clear error if its API key is missing, and (4) add 90s timeout + smart JSON recovery.

---

### Changes to `supabase/functions/enrich-authority-pages/index.ts`

**A. Add `MASTER_AUTHORITY_PROMPT` constant** (after auth section, ~line 42)
- The full prompt from the user's spec (E-E-A-T, AdSense, SEO, page-type sections, quality rules, output JSON format)
- Approximately 200 lines of template string

**B. Add multi-model AI functions** (replace old `callGemini` at lines 47-68)
- `AI_TIMEOUT_MS = 90000` (90 seconds for authority pages)
- `fetchGemini(prompt, model?)` — accepts model param for flash vs pro; temp 0.5, maxTokens 16384, 90s timeout + 429 retry. Graceful: checks `GEMINI_API_KEY`, throws `"GEMINI_API_KEY not configured — please add it to secrets"` if missing
- `callClaudeRaw(prompt)` — temp 0.6, maxTokens 16384, 90s timeout. Graceful: checks `ANTHROPIC_API_KEY`
- `callMistralRaw(prompt)` — temp 0.5, maxTokens 16384 via Bedrock. Graceful: checks `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
- `callLovableGeminiRaw(prompt)` — temp 0.5, maxTokens 16384 via gateway. Graceful: checks `LOVABLE_API_KEY`
- `callOpenAIRaw(prompt, model?)` — **placeholder** that checks `OPENAI_API_KEY` and throws `"OpenAI API key not configured — please add OPENAI_API_KEY secret"` if missing. If key exists, calls OpenAI completions API with temp 0.5, maxTokens 16384
- AWS SigV4 helpers copied from enrich-employment-news
- `tryParseJSON()` — 4-stage recovery (direct → strip fences → extract boundaries → truncate)

**C. Add `callAI(model, prompt)` dispatcher**
Maps UI model values to functions:
- `gemini-flash` / `gemini` / default → `fetchGemini(prompt, 'gemini-2.5-flash')`
- `gemini-pro` → `fetchGemini(prompt, 'gemini-2.5-pro')`
- `claude-sonnet` / `claude` → `callClaudeRaw(prompt)`
- `mistral` → `callMistralRaw(prompt)`
- `lovable-gemini` → `callLovableGeminiRaw(prompt)`
- `gpt5` → `callOpenAIRaw(prompt, 'gpt-5')`
- `gpt5-mini` → `callOpenAIRaw(prompt, 'gpt-5-mini')`

Includes JSON parse with retry (call AI again on parse failure).

**D. Modify `getPromptForType()`** (~line 229)
- Prepend `MASTER_AUTHORITY_PROMPT` before each page-type-specific prompt
- Type-specific prompts (buildNotificationPrompt, etc.) remain but are simplified to define JSON field structure only, since quality/SEO rules are in the master prompt

**E. Update main handler** (~line 430)
- Extract `aiModel` from request body: `const { slugs, pageType, currentContent, aiModel } = await req.json()`
- Remove hardcoded `GEMINI_API_KEY` check at top (now handled per-model)
- Replace `callGemini(prompt, GEMINI_API_KEY)` with `callAI(aiModel || 'gemini-flash', fullPrompt)`
- Replace `extractJson()` with `tryParseJSON()`

**F. Update quality scoring thresholds** (~line 271)
- Pass `pageType` to `computeQualityScore()`
- Type-aware minimums: notification/exam-pattern: 2000, syllabus/state: 2500, pyp: 1800

**G. Graceful failure pattern for ALL models**
Every model function follows this pattern:
```typescript
async function callOpenAIRaw(prompt: string, model = 'gpt-5'): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured — please add OPENAI_API_KEY secret');
  // ... actual API call with timeout
}
```
This ensures: no crash, clear error message surfaced to admin UI, easy to enable later by adding the secret.

---

### What stays unchanged
- `insert_enrichment_version` RPC, `insertVersion()`, `insertFailedRow()`
- Duplicate detection (`simpleHash`, `checkDuplicates`)
- Cross-link generation (`generateInternalLinks`)
- Batch processing (concurrency 3, max 8 slugs, 1s delay)
- Auth/admin checks (`verifyAdmin`)
- `ContentEnricher.tsx` (UI already sends `aiModel` correctly)

