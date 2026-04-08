

# Add Azure GPT-4.1 Mini to All Text Generation Selectors

## Overview

Add `azure-gpt41-mini` as a new text model by extending the existing Azure shared caller to support multiple deployments (different endpoints + deployment names), then wire it into all 10+ edge functions and the frontend registry — identical to how `azure-gpt4o-mini` was added.

## Key Design Decision

The current `azure-openai.ts` hardcodes one deployment name and one endpoint. Since `gpt-4.1-mini` uses a **different Azure endpoint** (`https://truejobs.openai.azure.com` vs the existing `https://socia-mnprfwf7-eastus2.cognitiveservices.azure.com`), the shared caller needs a minor refactor: accept an optional `deploymentName` and `endpoint` override parameter. This keeps one shared module, no duplication.

## Changes

### 1. New secrets (2 new env vars via add_secret)

- `AZURE_OPENAI_GPT41_MINI_DEPLOYMENT` = `gpt-4.1-mini`
- `AZURE_OPENAI_API_VERSION` = `2024-12-01-preview`

The endpoint `https://truejobs.openai.azure.com` will be passed from the caller code (or stored as a second env var). Since the user wants `AZURE_OPENAI_ENDPOINT` reused but the actual endpoint differs, we'll need a second endpoint env var or hardcode it per-deployment in a registry inside the shared caller.

**Approach**: Add a `AZURE_DEPLOYMENTS` registry map inside `azure-openai.ts` that maps model keys to `{ endpoint, deploymentName }`. The `gpt-4o-mini` entry uses `AZURE_OPENAI_ENDPOINT` (existing); `gpt-4.1-mini` uses a new env var like `AZURE_OPENAI_ENDPOINT_TRUEJOBS` or we store it in the registry since the user provided it as a fixed URL.

**Simplest safe approach**: Add an optional `deploymentName` and `endpointOverride` to the caller options. Edge functions pass the correct values per model. The `gpt-4.1-mini` deployment details are defined as constants in the shared module alongside the existing `gpt-4o-mini` constants.

### 2. `supabase/functions/_shared/azure-openai.ts` (~20 lines changed)

Refactor to support multiple deployments:

```typescript
// Deployment registry
const AZURE_DEPLOYMENTS: Record<string, { envEndpoint: string; deploymentName: string }> = {
  'azure-gpt4o-mini': {
    envEndpoint: 'AZURE_OPENAI_ENDPOINT',
    deploymentName: 'gpt-4o-mini',
  },
  'azure-gpt41-mini': {
    envEndpoint: 'AZURE_OPENAI_ENDPOINT_TRUEJOBS',
    deploymentName: 'gpt-4.1-mini',
  },
};
```

Add a new exported function `callAzureOpenAIModel(modelKey, prompt, options)` that looks up the deployment config, or extend `callAzureOpenAI` with an optional `modelKey` parameter. Existing callers remain unchanged (default = `azure-gpt4o-mini`).

**Actually even simpler**: Since both use the same API key env var (`AZURE_OPENAI_API_KEY`) and the same API version, just add an optional `deploymentName` and `endpoint` to `AzureOpenAIOptions`. Then each edge function's `azure-gpt41-mini` case passes them explicitly. Zero breaking changes to existing `azure-gpt4o-mini` calls.

### 3. New secret needed

- `AZURE_OPENAI_ENDPOINT_TRUEJOBS` = `https://truejobs.openai.azure.com` (or we can reuse `AZURE_OPENAI_ENDPOINT` if the user wants — but the endpoints are different resources, so a separate env var is safer)

Wait — re-reading the user's instructions: they say to use `AZURE_OPENAI_ENDPOINT` as the env var. But the existing `azure-gpt4o-mini` already uses `AZURE_OPENAI_ENDPOINT` pointing to `https://socia-mnprfwf7-eastus2.cognitiveservices.azure.com/`. Overwriting it would break `gpt-4o-mini`.

**Resolution**: The user also specifies `AZURE_OPENAI_GPT41_MINI_DEPLOYMENT` as a separate env var. The cleanest approach: hardcode the TrueJobs endpoint in the deployment registry inside the shared caller (since it's a fixed Azure resource URL, not a secret), OR add a second endpoint env var. I'll use a deployment registry pattern inside the shared module.

### Updated Plan for `azure-openai.ts`

Add `AzureOpenAIOptions.deploymentName` and `AzureOpenAIOptions.endpoint` optional fields. The `callAzureOpenAI` function defaults to existing behavior. A new convenience export `callAzureGPT41Mini(prompt, options)` wraps `callAzureOpenAI` with the correct deployment/endpoint for `gpt-4.1-mini`.

### 4. `src/lib/aiModels.ts` (~15 lines)

Add to `AI_MODELS` array after `azure-gpt4o-mini`:
```typescript
{
  value: 'azure-gpt41-mini',
  label: 'Azure GPT-4.1 Mini (From API)',
  desc: 'Your API · Strong article writing · ~15s/page',
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

Add `'azure-gpt41-mini'` to `SEO_FIX_MODEL_VALUES`.

### 5. Shared runtime configs

**`supabase/functions/_shared/seo-fix-runtime.ts`**: Add `'azure-gpt41-mini'` policy (same as `azure-gpt4o-mini`).

**`supabase/functions/_shared/word-count-enforcement.ts`**: Add `'azure-gpt41-mini'` alongside `azure-gpt4o-mini` in token ceiling logic and supported models set.

**`src/lib/seoFixRuntimeConfig.ts`**: Add `'azure-gpt41-mini'` config entry.

### 6. Edge function routing — add `case 'azure-gpt41-mini':` in all 10 functions

Each mirrors the `azure-gpt4o-mini` pattern but passes the `gpt-4.1-mini` deployment name and TrueJobs endpoint:

| Edge Function | Pattern |
|---|---|
| `generate-blog-article/index.ts` | Add to provider info + callAI switch |
| `seo-audit-fix/index.ts` | Add to `resolveProvider()` |
| `generate-custom-page/index.ts` | Add case |
| `rss-ai-process/index.ts` | Add to model map + dispatch |
| `improve-blog-content/index.ts` | Add to SUPPORTED_MODELS + dispatch |
| `generate-blog-faq/index.ts` | Add case |
| `enrich-authority-pages/index.ts` | Add to model info + dispatch |
| `generate-resource-content/index.ts` | Add case |
| `intake-ai-classify/index.ts` | Add to AZURE_OPENAI_MODELS set |
| `azure-emp-news-ai-clean-drafts/index.ts` | Add to AZURE_OPENAI_MODELS set |

### 7. Secrets to add

- `AZURE_OPENAI_GPT41_MINI_DEPLOYMENT` = `gpt-4.1-mini` (optional, can hardcode)
- `AZURE_OPENAI_API_VERSION` = `2024-12-01-preview` (optional, already hardcoded)

Since both deployments may use different API keys (different Azure resources), we may need a second API key. But the user said to use `AZURE_OPENAI_API_KEY` — I'll proceed with that assumption and let the shared caller use a single API key env var.

**For the different endpoint**: The simplest approach is to add the TrueJobs endpoint as a constant in the deployment config inside `azure-openai.ts`, since the user explicitly provided it and it's not a secret (it's a public URL).

## Summary

| File | Change |
|---|---|
| `supabase/functions/_shared/azure-openai.ts` | Add deployment/endpoint overrides to support multiple Azure models (~15 lines) |
| `src/lib/aiModels.ts` | Add `azure-gpt41-mini` model def + SEO allowlist (~15 lines) |
| `src/lib/seoFixRuntimeConfig.ts` | Add runtime config entry (~6 lines) |
| `supabase/functions/_shared/seo-fix-runtime.ts` | Add model policy (~6 lines) |
| `supabase/functions/_shared/word-count-enforcement.ts` | Add to token ceiling + supported set (~3 lines) |
| 10 edge functions | Add `case 'azure-gpt41-mini':` routing (~2-3 lines each) |

**No new secrets needed** if we hardcode the TrueJobs endpoint URL in the shared module (it's a public URL, not a secret). The same `AZURE_OPENAI_API_KEY` is reused.

**How to test**: Admin → Blog → New Article → select "Azure GPT-4.1 Mini (From API)" → generate with any keyword.

**Admin areas where model appears**: Blog article generator, SEO audit/fix, custom page generator, RSS AI processing, content improvement, FAQ generation, authority page enrichment, resource content generation, intake classification, employment news drafts — all surfaces using `AiModelSelector` with text capability.

