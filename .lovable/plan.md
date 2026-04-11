

# Integrate DeepSeek-V3.1 (Azure AI Foundry) into All AI Selectors

## What This Does
Adds DeepSeek-V3.1 as a new AI model option across all admin workflows (blog generation, SEO fix, enrichment, etc.). The model is deployed on Azure AI Foundry and uses the OpenAI-compatible API format.

## Deployment Details (from screenshot)
- **Endpoint**: `https://truejobsdeepseek-resource.services.ai.azure.com`
- **Deployment name**: `DeepSeek-V3.1`
- **API path**: `/openai/v1/` (OpenAI SDK compatible, NOT the standard Azure OpenAI `/openai/deployments/` path)
- **Authentication**: API Key header
- **Rate limits**: 250 RPM, 250,000 TPM

## Changes

### 1. Store the API key as a secret
Use `add_secret` to request `AZURE_DEEPSEEK_API_KEY` from the user.

### 2. Create shared caller: `supabase/functions/_shared/azure-deepseek.ts`
A convenience wrapper similar to `azure-openai.ts` but targeting the DeepSeek endpoint. Uses the OpenAI-compatible chat completions path: `{endpoint}/openai/v1/chat/completions` with `api-key` header auth and `model: "DeepSeek-V3.1"` in the body.

### 3. Register model in `src/lib/aiModels.ts`
Add new entry with value `azure-deepseek-v3` to the `AI_MODELS` array:
- Label: "DeepSeek V3.1 (Azure) (From API)"
- Provider: "Azure AI Foundry"
- Capabilities: `['text', 'text-premium']`
- Source: `external-api`
- recommendedMaxWords: 2500, warnAboveWords: 2000
- Add to `SEO_FIX_MODEL_VALUES` array

### 4. Add routing in all 12 edge functions
Each edge function that routes `azure-gpt41-mini` needs a matching `azure-deepseek-v3` case that imports and calls `callAzureDeepSeek` from the shared module:

| File | Change |
|------|--------|
| `_shared/seo-fix-runtime.ts` | Add model policy entry |
| `_shared/word-count-enforcement.ts` | Add to token calc + supported set |
| `azure-emp-news-ai-clean-drafts/index.ts` | Add to AZURE set + routing |
| `enrich-authority-pages/index.ts` | Add model mapping + call route |
| `generate-blog-article/index.ts` | Add model mapping + call route |
| `generate-blog-faq/index.ts` | Add model mapping + call route |
| `generate-custom-page/index.ts` | Add call route |
| `generate-resource-content/index.ts` | Add call route |
| `improve-blog-content/index.ts` | Add to SUPPORTED_MODELS + call route |
| `intake-ai-classify/index.ts` | Add to AZURE set + routing |
| `rss-ai-process/index.ts` | Add model mapping + call route |
| `seo-audit-fix/index.ts` | Add route mapping + call route |

### 5. Test via edge function curl
After deployment, call `improve-blog-content` or `generate-blog-article` with `aiModel: "azure-deepseek-v3"` to verify the integration works end-to-end.

## Technical Details

**Shared caller pattern:**
```typescript
// supabase/functions/_shared/azure-deepseek.ts
const DEEPSEEK_ENDPOINT = 'https://truejobsdeepseek-resource.services.ai.azure.com';
const DEEPSEEK_MODEL = 'DeepSeek-V3.1';

export async function callAzureDeepSeek(prompt, options) {
  const apiKey = Deno.env.get('AZURE_DEEPSEEK_API_KEY');
  // POST to {endpoint}/openai/v1/chat/completions
  // Headers: api-key, Content-Type
  // Body: { model: "DeepSeek-V3.1", messages, max_tokens, temperature }
}
```

**Routing pattern (same as azure-gpt41-mini):**
```typescript
case 'azure-deepseek-v3': {
  const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
  return callAzureDeepSeek(prompt, { maxTokens, temperature: 0.5 });
}
```

