

# Add Azure GPT-5 Mini to All AI Selectors

## Deployment Details (from screenshot)
- **Model/Deployment:** `gpt-5-mini`
- **Endpoint:** `https://truejobsdeepseek-resource.cognitiveservices.azure.com/`
- **API key:** `AZURE_DEEPSEEK_API_KEY` (same resource)
- **API format:** Standard Azure OpenAI chat completions (`/openai/deployments/gpt-5-mini/chat/completions?api-version=2024-12-01-preview`)
- **Rate limits:** 250,000 TPM / 250 RPM

## Technical Approach

GPT-5-mini uses the Azure OpenAI API format (same as GPT-4o-mini and GPT-4.1-mini) but lives on the DeepSeek resource. We add a convenience wrapper `callAzureGPT5Mini` to `azure-openai.ts` and route `azure-gpt5-mini` through it across all edge functions.

## Changes

### 1. Shared caller: `supabase/functions/_shared/azure-openai.ts`
Add `callAzureGPT5Mini` convenience wrapper:
- Endpoint: `https://truejobsdeepseek-resource.cognitiveservices.azure.com`
- Deployment: `gpt-5-mini`
- API key: `AZURE_DEEPSEEK_API_KEY`

### 2. Model registry: `src/lib/aiModels.ts`
- Add `azure-gpt5-mini` entry after `azure-gpt41-mini` (text + text-premium, ~15s, good reliability, 2000 max words)
- Add to `SEO_FIX_MODEL_VALUES` array

### 3. SEO runtime config: `src/lib/seoFixRuntimeConfig.ts`
- Add `azure-gpt5-mini` config (same as azure-gpt41-mini: concurrency 2, throttle 2000ms)

### 4. Backend routing — 12 edge functions
Add `azure-gpt5-mini` case alongside existing `azure-gpt41-mini` in each:

| Edge Function | Pattern |
|---|---|
| `seo-audit-fix` | Add route case + provider branch |
| `generate-blog-article` | Add resolveModel case + callAI case |
| `generate-blog-faq` | Add case |
| `improve-blog-content` | Add to SUPPORTED_MODELS + callAI switch |
| `enrich-authority-pages` | Add resolveModel case + callAI case |
| `enrich-blog-content` | Add routing case |
| `generate-resource-content` | Add case |
| `rss-ai-process` | Add resolveModel + call block |
| `intake-ai-classify` | Add to AZURE_OPENAI_MODELS set + routing |
| `azure-emp-news-ai-clean-drafts` | Add to AZURE_OPENAI_MODELS set + routing |
| `enrich-employment-news` | Add resolveModel case + call case |
| `extract-employment-news` | Add resolveModel case + call case |

Each routes through:
```typescript
case 'azure-gpt5-mini': {
  const { callAzureGPT5Mini } = await import('../_shared/azure-openai.ts');
  return callAzureGPT5Mini(prompt, { maxTokens, temperature: 0.5 });
}
```

### 5. Verification
After deployment, test via `curl_edge_functions` to confirm the model routes correctly and returns a valid response.

## Files Modified
- `supabase/functions/_shared/azure-openai.ts`
- `src/lib/aiModels.ts`
- `src/lib/seoFixRuntimeConfig.ts`
- 12 edge function `index.ts` files (routing cases only)

## No API Key Required
GPT-5-mini reuses `AZURE_DEEPSEEK_API_KEY` which is already configured.

