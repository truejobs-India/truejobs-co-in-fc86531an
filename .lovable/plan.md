

# Integrate DeepSeek-R1 (Azure AI Foundry) into All AI Selectors

## What This Does
Adds DeepSeek-R1 as a new AI model option alongside the existing DeepSeek-V3.1. Both share the same Azure AI Foundry resource and API key (`AZURE_DEEPSEEK_API_KEY`), but R1 is a reasoning-focused model (slower, stronger on complex tasks).

## Deployment Details (from screenshot)
- **Endpoint**: Same resource — `https://truejobsdeepseek-resource.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview`
- **Model name**: `DeepSeek-R1`
- **API key**: Same `AZURE_DEEPSEEK_API_KEY` (already configured)
- **Rate limits**: 250 RPM, 250,000 TPM

## Changes

### 1. Update shared caller (`supabase/functions/_shared/azure-deepseek.ts`)
Add a `model` option to `AzureDeepSeekOptions` so the caller can select between `DeepSeek-V3.1` and `DeepSeek-R1`. Defaults to V3.1 for backward compatibility.

### 2. Register model in `src/lib/aiModels.ts`
Add `azure-deepseek-r1` entry:
- Label: "DeepSeek R1 (Azure) (From API)"
- Capabilities: `['text', 'text-premium']`
- Source: `external-api`, Provider: "Azure AI Foundry"
- recommendedMaxWords: 2500, warnAboveWords: 2000
- Speed: ~35s (reasoning model, slower than V3.1)
- Add to `SEO_FIX_MODEL_VALUES`

### 3. Add routing in all 12 edge functions
Each function that handles `azure-deepseek-v3` gets a matching `azure-deepseek-r1` case that calls `callAzureDeepSeek` with `model: 'DeepSeek-R1'`:

| File | Change |
|------|--------|
| `_shared/seo-fix-runtime.ts` | Add model policy entry |
| `_shared/word-count-enforcement.ts` | Add to token calc + supported set |
| `azure-emp-news-ai-clean-drafts/index.ts` | Add routing |
| `enrich-authority-pages/index.ts` | Add routing |
| `generate-blog-article/index.ts` | Add routing |
| `generate-blog-faq/index.ts` | Add routing |
| `generate-custom-page/index.ts` | Add routing |
| `generate-resource-content/index.ts` | Add routing |
| `improve-blog-content/index.ts` | Add routing |
| `intake-ai-classify/index.ts` | Add routing |
| `rss-ai-process/index.ts` | Add routing |
| `seo-audit-fix/index.ts` | Add routing |

### 4. Update client-side runtime config (`src/lib/seoFixRuntimeConfig.ts`)
Add `azure-deepseek-r1` entry with slightly higher throttle (reasoning model is slower).

### 5. Deploy and test
No new secret needed — reuses existing `AZURE_DEEPSEEK_API_KEY`. Test via `improve-blog-content` with `aiModel: "azure-deepseek-r1"`.

## Technical Details

**Shared caller update:**
```typescript
export interface AzureDeepSeekOptions {
  model?: 'DeepSeek-V3.1' | 'DeepSeek-R1';  // NEW
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}
// Default model stays DeepSeek-V3.1 for backward compat
```

**Routing pattern:**
```typescript
case 'azure-deepseek-r1': {
  const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
  return callAzureDeepSeek(prompt, { model: 'DeepSeek-R1', maxTokens, temperature: 0.5 });
}
```

## Files
- **Modified:** `supabase/functions/_shared/azure-deepseek.ts` (add model param)
- **Modified:** `src/lib/aiModels.ts` (register + SEO fix list)
- **Modified:** `src/lib/seoFixRuntimeConfig.ts` (runtime config)
- **Modified:** 12 edge function files (add routing case)

