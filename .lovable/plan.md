

# Strict AI Model Routing — Deep Audit & Fix Plan

## Complete Audit Results

Here is every violation found across all text-generation edge functions and frontend callers. Each model in the registry (`src/lib/aiModels.ts`) has 30 text-capable models. The table below shows which functions support which models and where violations exist.

### TEXT MODELS IN REGISTRY (30 total)
```text
BUILT-IN (10):
  gemini-flash, gemini-pro, groq, claude-sonnet, nova-pro,
  nova-premier, mistral, gpt5, gpt5-mini, lovable-gemini

EXTERNAL-API (20):
  vertex-flash, vertex-pro, vertex-3.1-pro, vertex-3-flash,
  vertex-3.1-flash-lite, nemotron-120b, azure-gpt4o-mini,
  azure-gpt41-mini, azure-gpt5-mini, azure-deepseek-v3,
  azure-deepseek-r1, sarvam-30b, sarvam-105b
  (+ 7 image-only models, not relevant here)
```

### VIOLATION SUMMARY BY FUNCTION

| # | Function | Sarvam Support | Default Fallback | aiModel Param | Violations |
|---|----------|---------------|------------------|---------------|------------|
| 1 | `analyze-blog-compliance-fixes` | NO | `default:` -> Vertex `gemini-2.5-pro` | Yes (from UI) | Missing: sarvam-30b, sarvam-105b, groq. Default falls to Vertex. |
| 2 | `generate-blog-seo` | NO | Hardcoded Vertex Flash | NO — ignores selector | Fully hardcoded to Vertex. No aiModel param accepted. |
| 3 | `suggest-blog-internal-links` | NO | Hardcoded Vertex Flash | NO — ignores selector | Fully hardcoded to Vertex. No aiModel param accepted. |
| 4 | `generate-blog-faq` | NO | `default:` throws error (good) | Yes | Missing: sarvam-30b, sarvam-105b. |
| 5 | `improve-blog-content` | NO | `default:` throws error (good) | Yes | Missing: sarvam-30b, sarvam-105b. |
| 6 | `enrich-employment-news` | YES but wrong | `default:` uses raw model string | Yes | Collapses sarvam-30b AND sarvam-105b to `sarvam-m`. |
| 7 | `extract-employment-news` | YES but wrong | `default:` -> Vertex Flash | Yes | Collapses sarvam-30b AND sarvam-105b to `sarvam-m`. Default falls to Vertex. |
| 8 | `generate-blog-article` | YES (correct) | `default:` throws error (good) | Yes | OK — supports both sarvam models correctly. |
| 9 | `classify-blog-articles` | NO | `default:` throws error (good) | Yes | Missing: sarvam-30b, sarvam-105b, azure-* models. |
| 10 | `seo-audit-fix` | NO | `default:` -> Vertex Flash | Yes | Missing: sarvam, azure-deepseek. Default falls to Vertex. |
| 11 | `fix-seo-metadata` | NO | Hardcoded Vertex Pro | NO | Fully hardcoded to Vertex. No aiModel param. |
| 12 | `enrich-blog-articles` | NO | Hardcoded Vertex Flash | NO | Fully hardcoded to Vertex. No aiModel param. |
| 13 | `generate-blog-seo` (bulk mode) | NO | Hardcoded Vertex Flash | NO | Same as #2 — bulk path also hardcoded. |

### FRONTEND CALLER VIOLATIONS

| # | UI Component / Hook | Where aiModel is NOT sent | Impact |
|---|---------------------|--------------------------|--------|
| 1 | `BlogAITools.tsx` → `handleGenerateSEO` | `generate-blog-seo` — no `aiModel` sent | Always hits Vertex |
| 2 | `BlogAITools.tsx` → `handleGenerateFAQ` | `generate-blog-faq` — no `aiModel` sent | Falls to default |
| 3 | `BlogAITools.tsx` → `handleSuggestLinks` | `suggest-blog-internal-links` — no `aiModel` sent | Always hits Vertex |
| 4 | `BlogAITools.tsx` → `handleImproveStructure` | `improve-blog-content` — no `aiModel` sent | Falls to default |
| 5 | `BlogAITools.tsx` → `handleRewriteSection` | `improve-blog-content` — no `aiModel` sent | Falls to default |
| 6 | `BlogAITools.tsx` → `handleEnrichArticle` | `improve-blog-content` — no `aiModel` sent | Falls to default |
| 7 | `BulkPublishModal.tsx` → SEO fix | `generate-blog-seo` bulk — no `aiModel` sent | Always hits Vertex |
| 8 | `useBulkBlogWorkflow.ts` → Pass 2 | Forces `gemini-2.5-pro` for enrichment escalation | Ignores selected model |

### CORRECTLY PASSING aiModel (no changes needed)
- `BlogAITools.tsx` → `handleComplianceFixes` — sends `aiModel: blogTextModel` ✓
- `BlogAITools.tsx` → Fix All button — sends `aiModel: blogTextModel` ✓
- `useBulkAutoFix.ts` — sends `aiModel: blogTextModel` ✓
- `useBulkBlogWorkflow.ts` → compliance fixes — sends `aiModel` ✓
- `BulkEnrichByWordCount.tsx` — sends `aiModel: blogTextModel` ✓
- `PendingActionsPanel.tsx` — sends `aiModel: blogTextModel` ✓
- `BlogPostEditor.tsx` — sends `aiModel: blogTextModel` ✓

---

## Implementation Plan

### Part 1: Add Sarvam support to all blog edge functions (5 functions)

**1.1 `analyze-blog-compliance-fixes/index.ts`**
- Add cases for `sarvam-30b` and `sarvam-105b` using `callSarvamChat` from `../_shared/sarvam.ts`
- Add case for `groq` using Groq API
- Replace `default:` branch (currently routes to Vertex) with `throw new Error('Unsupported model')`

**1.2 `generate-blog-seo/index.ts`**
- Accept `aiModel` from request body
- Replace hardcoded `callVertexGemini('gemini-2.5-flash', ...)` with a dispatcher that routes to the selected model
- Support all 30 text models
- Return 400 for unsupported/missing models

**1.3 `suggest-blog-internal-links/index.ts`**
- Accept `aiModel` from request body
- Replace hardcoded `callVertexGemini('gemini-2.5-flash', ...)` with dispatcher
- Support all 30 text models
- Return 400 for unsupported/missing models

**1.4 `generate-blog-faq/index.ts`**
- Add `sarvam-30b` and `sarvam-105b` cases to existing `callAI` dispatcher

**1.5 `improve-blog-content/index.ts`**
- Add `sarvam-30b` and `sarvam-105b` cases to existing `callAI` dispatcher

### Part 2: Fix frontend callers to always pass aiModel (3 files)

**2.1 `BlogAITools.tsx`**
- Add `aiModel: blogTextModel` to ALL 6 function calls that currently omit it:
  - `handleGenerateSEO` → `generate-blog-seo`
  - `handleGenerateFAQ` → `generate-blog-faq`
  - `handleSuggestLinks` → `suggest-blog-internal-links`
  - `handleImproveStructure` → `improve-blog-content`
  - `handleRewriteSection` → `improve-blog-content`
  - `handleEnrichArticle` → `improve-blog-content`

**2.2 `BulkPublishModal.tsx`**
- Accept `blogTextModel` prop and pass `aiModel` to bulk SEO call

**2.3 `useBulkBlogWorkflow.ts`**
- Remove the Pass 2 forced escalation to `gemini-2.5-pro` (line 1110)
- Use the user's selected model for all passes

### Part 3: Fix Sarvam model collapsing (2 functions)

**3.1 `enrich-employment-news/index.ts`**
- Change `sarvam-30b` → route to `sarvam-30b` (not `sarvam-m`)
- Change `sarvam-105b` → route to `sarvam-105b` (not `sarvam-m`)
- Fix the `resolveModel` function AND the `callAI` switch for both entries
- Replace `default:` with explicit error

**3.2 `extract-employment-news/index.ts`**
- Same fixes as 3.1
- Replace `default:` → Vertex Flash with explicit error

### Part 4: Fix remaining hardcoded Vertex functions (3 functions)

**4.1 `fix-seo-metadata/index.ts`**
- Accept `aiModel` param, add dispatcher, remove hardcoded Vertex Pro

**4.2 `enrich-blog-articles/index.ts`**
- Accept `aiModel` param, add dispatcher, remove hardcoded Vertex Flash

**4.3 `seo-audit-fix/index.ts`**
- Add sarvam-30b, sarvam-105b support
- Replace `default:` → Vertex Flash with explicit error

### Part 5: Fix classifier (1 function)

**5.1 `classify-blog-articles/index.ts`**
- Add sarvam-30b, sarvam-105b, azure-gpt5-mini, azure-gpt41-mini, azure-gpt4o-mini, azure-deepseek-v3, azure-deepseek-r1 support

---

## Files to modify (16 total)

**Edge functions (11):**
1. `supabase/functions/analyze-blog-compliance-fixes/index.ts`
2. `supabase/functions/generate-blog-seo/index.ts`
3. `supabase/functions/suggest-blog-internal-links/index.ts`
4. `supabase/functions/generate-blog-faq/index.ts`
5. `supabase/functions/improve-blog-content/index.ts`
6. `supabase/functions/enrich-employment-news/index.ts`
7. `supabase/functions/extract-employment-news/index.ts`
8. `supabase/functions/fix-seo-metadata/index.ts`
9. `supabase/functions/enrich-blog-articles/index.ts`
10. `supabase/functions/seo-audit-fix/index.ts`
11. `supabase/functions/classify-blog-articles/index.ts`

**Frontend (5):**
12. `src/components/admin/blog/BlogAITools.tsx`
13. `src/components/admin/bulk-blog/BulkPublishModal.tsx`
14. `src/hooks/useBulkBlogWorkflow.ts`
15. `src/components/admin/bulk-blog/ArticleEditPanel.tsx` (if needed for prop threading)
16. `src/components/admin/BulkBlogUpload.tsx` (if needed for prop threading)

## Strict rules enforced
- No `default:` branch that routes to any AI provider
- Every unsupported model returns explicit 400 error
- No model collapsing (sarvam-105b stays sarvam-105b)
- No forced escalation passes
- Every frontend AI call includes `aiModel: blogTextModel`

