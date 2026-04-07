

# Add NVIDIA Nemotron 120B to All Text Generation Selectors

## Overview

Add the `nemotron-120b` model (NVIDIA Nemotron 3 Super 120B via AWS Bedrock Converse API) to the central model registry and wire routing in all 10 edge functions that currently support `nova-pro`/`nova-premier`. The model uses the same Converse API and SigV4 signing — we just add it to the `NOVA_MODELS` map and add `case 'nemotron-120b':` alongside existing Nova cases.

## Changes

### 1. `supabase/functions/_shared/bedrock-nova.ts` (~4 lines)

Add to `NOVA_MODELS` registry:
```typescript
'nemotron-120b': {
  modelId: 'nvidia.nemotron-super-3-120b-a12b',
  label: 'NVIDIA Nemotron 120B',
},
```

This makes `callBedrockNova('nemotron-120b', ...)` and `callBedrockNovaWithMeta('nemotron-120b', ...)` work immediately.

### 2. `src/lib/aiModels.ts` (~17 lines)

**A.** Add model definition to `AI_MODELS` array (after `nova-canvas`):
```typescript
{
  value: 'nemotron-120b',
  label: 'NVIDIA Nemotron 120B (From API)',
  desc: 'Your API · Agentic/reasoning · ~35s/page',
  speed: 35,
  source: 'external-api',
  provider: 'Amazon',
  capabilities: ['text', 'text-premium'],
  recommendedMaxWords: 2000,
  warnAboveWords: 1500,
  longFormReliability: 'good',
  supportsContinuationPass: true,
}
```

**B.** Add `'nemotron-120b'` to `SEO_FIX_MODEL_VALUES` array.

### 3. `supabase/functions/_shared/seo-fix-runtime.ts` (~6 lines)

Add `'nemotron-120b'` policy entry to `MODEL_POLICIES`.

### 4. `supabase/functions/_shared/word-count-enforcement.ts` (~2 lines)

Add `'nemotron-120b'` to the supported models set and any Nova-specific token ceiling logic.

### 5. Edge function routing — add `case 'nemotron-120b':` in 9 functions

Each is a 1-line case addition reusing existing `callBedrockNova('nemotron-120b', ...)`:

| Edge Function | Pattern |
|---|---|
| `generate-blog-article/index.ts` | Add to model info map + `case 'nemotron-120b':` alongside `nova-pro`/`nova-premier` |
| `seo-audit-fix/index.ts` | Add `case 'nemotron-120b':` to `resolveProvider()` |
| `generate-custom-page/index.ts` | Add `case 'nemotron-120b':` alongside Nova cases |
| `rss-ai-process/index.ts` | Add to model map + dispatch condition |
| `improve-blog-content/index.ts` | Add to `SUPPORTED_MODELS` + `case 'nemotron-120b':` |
| `generate-blog-faq/index.ts` | Add `case 'nemotron-120b':` |
| `enrich-authority-pages/index.ts` | Add to model info map + routing switch |
| `generate-resource-content/index.ts` | Add `case 'nemotron-120b':` |
| `intake-ai-classify/index.ts` | Add to `BEDROCK_MODELS` set |
| `azure-emp-news-ai-clean-drafts/index.ts` | Add to `BEDROCK_MODELS` set + routing condition |

### 6. No frontend selector changes needed

The `AiModelSelector` component already dynamically reads from `AI_MODELS` and filters by capability. Adding `nemotron-120b` with `capabilities: ['text', 'text-premium']` automatically surfaces it in every text model dropdown across all admin workflows.

## What stays the same
- No new files
- No database changes
- No new secrets (reuses `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- Image edge function rejects it (not in any image routing path)

## Summary

| File | Change |
|---|---|
| `supabase/functions/_shared/bedrock-nova.ts` | Add to NOVA_MODELS (~4 lines) |
| `src/lib/aiModels.ts` | Add model def + SEO allowlist (~17 lines) |
| `supabase/functions/_shared/seo-fix-runtime.ts` | Add model policy (~6 lines) |
| `supabase/functions/_shared/word-count-enforcement.ts` | Add to supported set (~2 lines) |
| 9 edge functions | Add routing case (~1-3 lines each) |

