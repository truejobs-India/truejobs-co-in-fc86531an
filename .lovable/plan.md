

# Integrate DeepSeek-V3.1 (Azure AI Foundry) — Updated Endpoint

## Endpoint Correction
The user provided the correct target URI:
```
https://truejobsdeepseek-resource.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview
```

This uses the **Azure AI Foundry Models API** path (`/models/chat/completions`), NOT the standard Azure OpenAI deployments path (`/openai/deployments/{name}/chat/completions`). This is the same pattern as GPT-4.1 Mini but with a different URL structure.

## Changes

### 1. Request the `AZURE_DEEPSEEK_API_KEY` secret
Prompt for the API key from the Azure AI Foundry deployment.

### 2. Create `supabase/functions/_shared/azure-deepseek.ts`
A dedicated caller using the correct Models API path:
```typescript
const ENDPOINT = 'https://truejobsdeepseek-resource.services.ai.azure.com';
const API_VERSION = '2024-05-01-preview';
// URL: {ENDPOINT}/models/chat/completions?api-version={API_VERSION}
// Auth header: api-key
// Body: { model: "DeepSeek-V3.1", messages, max_tokens, temperature }
```

### 3. Register in `src/lib/aiModels.ts`
Add `azure-deepseek-v3` to `AI_MODELS` array and `SEO_FIX_MODEL_VALUES`.

### 4. Add routing in all 12 edge functions
Each function that handles `azure-gpt41-mini` gets a matching `azure-deepseek-v3` case:
- `_shared/seo-fix-runtime.ts` — model policy
- `_shared/word-count-enforcement.ts` — token calc
- `azure-emp-news-ai-clean-drafts/index.ts`
- `enrich-authority-pages/index.ts`
- `generate-blog-article/index.ts`
- `generate-blog-faq/index.ts`
- `generate-custom-page/index.ts`
- `generate-resource-content/index.ts`
- `improve-blog-content/index.ts`
- `intake-ai-classify/index.ts`
- `rss-ai-process/index.ts`
- `seo-audit-fix/index.ts`

### 5. Deploy and test
Deploy all affected edge functions, then curl-test one to verify the integration works.

## Files
- **New:** `supabase/functions/_shared/azure-deepseek.ts`
- **Modified:** `src/lib/aiModels.ts` + 12 edge function files

