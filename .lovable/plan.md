

# Fix: SEO Auto-Fix with User-Selected AI Model & Proper Routing

## Problem
1. `fixSingleArticle` never sends `aiModel` → edge function returns HTTP 400
2. Blog editor state has `content: ''` → AI gets no text to analyze
3. No model selector in the drilldown UI
4. Bulk `execute` also omits `aiModel` (line 232)

## Plan

### 1. Update `src/hooks/useSeoMetadataWorkflow.ts`
- Add `aiModel: string` as required parameter to `fixSingleArticle(post, aiModel)` — pass it in the request body
- Add `aiModel: string` parameter to `execute(onArticleComplete, aiModel)` — pass it in the batch request body (line 232)

### 2. Update `src/components/admin/blog/BlogStatsDrilldown.tsx`

**Add AI Model Selector:**
- Import `AiModelSelector` and `getLastUsedModel` from `@/components/admin/AiModelSelector`
- Add state: `const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-flash'))`
- Render `<AiModelSelector>` inside the AI Fix Action Bar, next to the "Fix All" button
- Disable "Fix All" and per-article fix buttons when no model selected

**Fetch content before fixing:**
- In `handleFixSingleSeo`: fetch `content` from DB via `supabase.from('blog_posts').select('content').eq('id', post.id).single()`, merge into post, then call `fixSingleArticle(postWithContent, aiModel)`
- In `handleBulkFix`: same content fetch per article before calling `fixSingleArticle`
- Pass `aiModel` to every `fixSingleArticle` call

**Error surfacing:**
- Track failed count in bulk fix and show it in the completion toast

### Routing
The `aiModel` value from the selector (e.g., `gemini-flash`, `gemini-pro`, `azure-gpt41-mini`, `sarvam-30b`, etc.) is passed directly to the edge function. The edge function's existing `callFixAI` switch statement (lines 89-170) already handles routing each model value to the correct API provider — no edge function changes needed.

### Files Changed
- `src/hooks/useSeoMetadataWorkflow.ts` — add `aiModel` param to `fixSingleArticle` and `execute`
- `src/components/admin/blog/BlogStatsDrilldown.tsx` — add model selector, fetch content, pass model, improve error reporting

