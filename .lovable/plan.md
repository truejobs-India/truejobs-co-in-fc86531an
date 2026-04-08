

# Connect Azure OpenAI (gpt-4o-mini) for Text Generation

## Overview

Wire the already-deployed Azure OpenAI `gpt-4o-mini` model into the existing multi-model infrastructure. This follows the exact same pattern used for Bedrock Nova, Sarvam, and other external API models: a shared caller module, a frontend registry entry, and routing cases in all text-generation edge functions.

## Architecture

```text
Admin UI (AiModelSelector) ──► Edge Function ──► callAzureOpenAI() ──► Azure OpenAI REST API
                                                  (server-side only)
```

No new edge function needed. The model integrates into existing edge functions via a shared caller, identical to how `bedrock-nova.ts` works.

## Changes

### 1. Add secrets (2 new env vars)

**Required secrets to add via the secrets tool:**
- `AZURE_OPENAI_ENDPOINT` = `https://socia-mnprfwf7-eastus2.cognitiveservices.azure.com/`
- `AZURE_OPENAI_API_KEY` = (user provides)

The deployment name (`gpt-4o-mini`) and API version (`2024-12-01-preview`) are hardcoded in the shared module with code comments, not as separate secrets — keeps it simple.

### 2. New shared module: `supabase/functions/_shared/azure-openai.ts` (~80 lines)

A clean fetch-based caller (no SDK needed — matches codebase style):

- `callAzureOpenAI(prompt, options?)` — main caller
- Reads `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` from env
- Targets: `{endpoint}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-12-01-preview`
- Supports: `systemPrompt`, `temperature`, `maxTokens`, `timeoutMs`
- 60s timeout via AbortController
- Returns text string (same interface as `callBedrockNova`)
- Clear error messages for missing config, HTTP errors, empty responses
- Code comments explaining how to change deployment name or API version later

### 3. Frontend registry: `src/lib/aiModels.ts` (~15 lines)

Add to `AI_MODELS` array:
```typescript
{
  value: 'azure-gpt4o-mini',
  label: 'Azure GPT-4o Mini (From API)',
  desc: 'Your API · Fast & efficient · ~15s/page',
  speed: 15,
  source: 'external-api',
  provider: 'Azure OpenAI',
  capabilities: ['text', 'text-premium'],
  recommendedMaxWords: 2000,
  warnAboveWords: 1500,
  longFormReliability: 'good',
  supportsContinuationPass: true,
}
```

Add `'azure-gpt4o-mini'` to `SEO_FIX_MODEL_VALUES` array.

This automatically surfaces the model in all text-generation dropdowns — no UI changes needed.

### 4. Shared configs

**`supabase/functions/_shared/seo-fix-runtime.ts`** — Add model policy:
```typescript
'azure-gpt4o-mini': {
  retryCount: 3,
  baseRetryDelayMs: 2000,
  throttleMs: 750,
  maxOutputTokens: 4096,
}
```

**`supabase/functions/_shared/word-count-enforcement.ts`** — Add to token ceiling logic:
```typescript
case 'azure-gpt4o-mini':
  return Math.min(target * 2, 8192);
```

### 5. Edge function routing — add `case 'azure-gpt4o-mini':` in 10 functions

Each follows the same pattern — 2-3 lines importing and calling `callAzureOpenAI`:

| Edge Function | Change |
|---|---|
| `generate-blog-article/index.ts` | Add to `resolveProviderInfo()` + `callAI()` switch |
| `seo-audit-fix/index.ts` | Add to `resolveProvider()` switch |
| `generate-custom-page/index.ts` | Add case to model switch |
| `rss-ai-process/index.ts` | Add to model map + dispatch |
| `improve-blog-content/index.ts` | Add to `SUPPORTED_MODELS` + dispatch switch |
| `generate-blog-faq/index.ts` | Add case |
| `enrich-authority-pages/index.ts` | Add to model info + dispatch |
| `generate-resource-content/index.ts` | Add case |
| `intake-ai-classify/index.ts` | Add to model routing |
| `azure-emp-news-ai-clean-drafts/index.ts` | Add to model routing |

### 6. Test button

No new test page needed. After implementation, the model appears in existing admin blog article generator. Select "Azure GPT-4o Mini (From API)" from the model dropdown, enter a test prompt like "SSC CGL eligibility criteria 2025", and generate. The response confirms end-to-end connectivity.

### 7. Backend guard

The image edge function (`generate-vertex-image`) has no routing path for `azure-gpt4o-mini`, so it's automatically rejected if somehow sent there. No additional guard needed.

## What does NOT change

- No new edge function files (reuses existing ones)
- No database changes
- No frontend component changes (AiModelSelector reads from registry automatically)
- No existing model routes affected
- No build changes

## Summary

| File | Change |
|---|---|
| `supabase/functions/_shared/azure-openai.ts` | **New** — shared caller (~80 lines) |
| `src/lib/aiModels.ts` | Add model def + SEO allowlist (~15 lines) |
| `supabase/functions/_shared/seo-fix-runtime.ts` | Add model policy (~6 lines) |
| `supabase/functions/_shared/word-count-enforcement.ts` | Add token ceiling (~3 lines) |
| 10 edge functions | Add routing case (~2-3 lines each) |

**Secrets to add:** `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`

**How to test:** Go to Admin → Blog → New Article → select "Azure GPT-4o Mini (From API)" from model dropdown → enter any keyword → generate. Response confirms the Azure endpoint is live.

