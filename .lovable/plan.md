

# Add All Text AI Models to Employment News Selectors

## Problem
The Employment News section has two AI model selectors that are missing many models:
1. **Enrichment selector** (EmploymentNewsManager.tsx line 1013) — hardcoded `<Select>` with only 6 models (Gemini Flash, Lovable Gemini, Mistral, Claude, Vertex Flash, Vertex Pro). Missing ~15 text models.
2. **Azure Draft Jobs selector** (DraftJobsTab.tsx line 20) — `AZURE_EMP_NEWS_AI_MODELS` array missing Azure OpenAI models (GPT-4o Mini, GPT-4.1 Mini), DeepSeek V3.1/R1, and Nemotron 120B.

Additionally, the backend edge functions lack routing for these newer models.

## Changes

### 1. Replace hardcoded enrichment selector with AiModelSelector
**File:** `src/components/admin/EmploymentNewsManager.tsx`
- Replace the manual `<Select>` (lines 1013-1025) with the shared `<AiModelSelector>` component (already imported)
- Update the `enrichAiModel` state initialization to use `getLastUsedModel('text', 'gemini-flash')` instead of localStorage fallback to `'gemini'`

### 2. Add missing models to DraftJobsTab allowlist
**File:** `src/components/admin/emp-news/azure-based-extraction/DraftJobsTab.tsx`
- Add to `AZURE_EMP_NEWS_AI_MODELS`: `azure-gpt4o-mini`, `azure-gpt41-mini`, `azure-deepseek-v3`, `azure-deepseek-r1`, `nemotron-120b`, `groq`, `claude-sonnet`, `gpt5`, `gpt5-mini`, `gemini-flash`, `gemini-pro`, `lovable-gemini`

### 3. Add routing cases to enrich-employment-news
**File:** `supabase/functions/enrich-employment-news/index.ts`
- Add to `resolveProviderInfo()`: azure-gpt4o-mini, azure-gpt41-mini, azure-deepseek-v3, azure-deepseek-r1, nemotron-120b, sarvam-30b, sarvam-105b
- Add to the `callAiProvider()` switch: routing cases for all 7 new models using their shared callers

### 4. Add routing cases to extract-employment-news
**File:** `supabase/functions/extract-employment-news/index.ts`
- Add to `resolveModel()`: azure-gpt4o-mini, azure-gpt41-mini, azure-deepseek-v3, azure-deepseek-r1, nemotron-120b, sarvam-30b, sarvam-105b
- Add provider-specific call logic for these models

### 5. Deploy and verify
- Deploy both edge functions
- Test `enrich-employment-news` and `extract-employment-news` with one of the newly added models (e.g., `azure-deepseek-v3`) to confirm routing works

## Files
- **Modified:** `src/components/admin/EmploymentNewsManager.tsx`
- **Modified:** `src/components/admin/emp-news/azure-based-extraction/DraftJobsTab.tsx`
- **Modified:** `supabase/functions/enrich-employment-news/index.ts`
- **Modified:** `supabase/functions/extract-employment-news/index.ts`

