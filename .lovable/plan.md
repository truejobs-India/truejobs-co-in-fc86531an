

## Plan: Fix 2 Blockers — OCR Orchestration + Direct AI Model Routing

### Blocker 1: OCR Orchestration Timeout Fix

**Problem**: `start-ocr` processes all pages sequentially in one edge function call. Each page involves image download + Azure POST + polling (~30-45s). Any issue >5 pages will timeout.

**Fix**: Convert `start-ocr` and `retry-failed` into thin orchestrators. Move the processing loop to the frontend.

#### Changes

**`supabase/functions/azure-emp-news-start-ocr/index.ts`** — Full rewrite to thin orchestrator:
- Validate issue exists and has pending pages
- Recover stale pages stuck in `processing` for >5 minutes (reset to `pending`)
- Set issue `ocr_status` to `processing`
- Return `{ page_ids: string[] }` — the list of pending page IDs
- Does NOT process any pages itself

**`supabase/functions/azure-emp-news-retry-failed/index.ts`** — Full rewrite to thin reset:
- Reset all failed pages to `pending` (same as today)
- Set issue `ocr_status` to `processing`
- Return `{ page_ids: string[] }` — the reset page IDs
- Does NOT call `start-ocr` or process pages

**`src/components/admin/emp-news/azure-based-extraction/OcrQueueTab.tsx`** — Add client-side page-by-page loop:
- `handleStartOcr`: calls `start-ocr` to get `page_ids`, then loops calling `azure-emp-news-process-page` one at a time
- Real-time progress state: `ocrProgress: { current: number, total: number, completed: number, failed: number } | null`
- Cancel support: `cancelRef` flag checked between pages to abort the loop
- After each page call, refresh page list to show live status updates
- `handleRetryAllFailed`: calls `retry-failed` to get `page_ids`, then same page-by-page loop
- Spinner + progress bar during processing, "Cancel" button visible during run
- Individual page retry (`handleRetryPage`) unchanged — already calls `process-page` directly

### Blocker 2: Replace Lovable Gateway with Direct AI Paths Only

**Problem**: `ai-clean-drafts` hardcodes `google/gemini-2.5-flash` via Lovable AI Gateway. Must use only direct API paths and honor the admin-selected model.

**Allowed models** (direct API only — no Lovable Gateway in this workflow):

| Key | Provider | Route |
|---|---|---|
| `vertex-flash` | Vertex AI | `gemini-2.5-flash` |
| `vertex-pro` | Vertex AI | `gemini-2.5-pro` |
| `vertex-3.1-pro` | Vertex AI | `gemini-3.1-pro-preview` |
| `vertex-3-flash` | Vertex AI | `gemini-3-flash-preview` |
| `vertex-3.1-flash-lite` | Vertex AI | `gemini-3.1-flash-lite-preview` |
| `nova-pro` | Bedrock | via `callBedrockNova` |
| `nova-premier` | Bedrock | via `callBedrockNova` |
| `mistral` | Bedrock | via `awsSigV4Fetch` |
| `sarvam-30b` | Sarvam | direct `api.sarvam.ai` |
| `sarvam-105b` | Sarvam | direct `api.sarvam.ai` |

#### Changes

**`supabase/functions/azure-emp-news-ai-clean-drafts/index.ts`** — Full rewrite:
- Remove `LOVABLE_API_KEY` check and all `ai.gateway.lovable.dev` code
- Accept `aiModel` from request body (required, validated against allowed set)
- Add `callAI` dispatcher following exact `firecrawl-ai-enrich` pattern:
  - **Vertex route**: Import `callVertexGemini` from `_shared/vertex-ai.ts`. Append JSON schema to prompt. Parse JSON via `/{[\s\S]*}/` regex.
  - **Bedrock route** (nova-pro/nova-premier): Import `callBedrockNova` from `_shared/bedrock-nova.ts`. Same JSON-in-prompt. **Preserve `applyNovaHindiSafeguard`** — the existing Hindi Devanagari instruction in `bedrock-nova.ts` fires automatically since `callBedrockNova` calls it internally.
  - **Bedrock Mistral route**: Import `awsSigV4Fetch` from `_shared/bedrock-nova.ts`. Same Converse API pattern as `firecrawl-ai-enrich`.
  - **Sarvam route**: Direct `fetch` to `https://api.sarvam.ai/v1/chat/completions` with `SARVAM_API_KEY`. Same JSON-in-prompt pattern.
  - **No fallback**: If `aiModel` is missing or not in the allowed set, return 400 immediately.
- Save `ai_model_used: aiModel` in every draft's `ai_cleaned_data` for audit trail
- Log actual model + provider used per notice
- 429/rate-limit handling: break the loop, set notice back to `pending`, surface error
- Keep existing `SYSTEM_PROMPT`, `TOOL_SCHEMA.function.parameters` (used as JSON schema in prompt), `validateDraft`, `isJobRelevant` logic

**`src/components/admin/emp-news/azure-based-extraction/DraftJobsTab.tsx`**:
- Import `AiModelSelector` and `getLastUsedModel` from `@/components/admin/AiModelSelector`
- Define allowlist:
```typescript
const AZURE_EMP_NEWS_AI_MODELS = [
  'vertex-flash', 'vertex-pro', 'vertex-3.1-pro', 'vertex-3-flash', 'vertex-3.1-flash-lite',
  'nova-pro', 'nova-premier', 'mistral',
  'sarvam-30b', 'sarvam-105b',
] as const;
```
- Add `aiModel` state initialized from `getLastUsedModel('text', 'vertex-flash', AZURE_EMP_NEWS_AI_MODELS)`
- Render `AiModelSelector` next to "Generate AI Drafts" button with `allowedValues={AZURE_EMP_NEWS_AI_MODELS}` and `capability="text"`
- Pass `aiModel` in `supabase.functions.invoke('azure-emp-news-ai-clean-drafts', { body: { issue_id, aiModel } })`

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/azure-emp-news-start-ocr/index.ts` | Rewrite to thin orchestrator |
| `supabase/functions/azure-emp-news-retry-failed/index.ts` | Rewrite to thin reset + return IDs |
| `supabase/functions/azure-emp-news-ai-clean-drafts/index.ts` | Remove Gateway, add Vertex/Bedrock/Sarvam dispatcher |
| `src/components/admin/emp-news/azure-based-extraction/OcrQueueTab.tsx` | Client-side page-by-page loop with progress + cancel |
| `src/components/admin/emp-news/azure-based-extraction/DraftJobsTab.tsx` | Add AiModelSelector with direct-only allowlist |

### Files NOT Modified
- No old Emp News files
- No `process-page` function (already works correctly)
- No `retry-page` function (already works correctly)
- No database migrations
- No config.toml changes
- No new edge functions
- `_shared/bedrock-nova.ts` — unchanged; Nova Hindi safeguard (`applyNovaHindiSafeguard`) is already built into `callBedrockNova` and fires automatically

### Nova Hindi Safeguard Preservation
The `applyNovaHindiSafeguard` function in `_shared/bedrock-nova.ts` is called internally by `callBedrockNova`. When Employment News text contains Hindi markers (common in government job notices), it automatically prepends Devanagari script instructions. This is preserved without any changes since the new dispatcher calls `callBedrockNova` directly.

### Test Checklist
- [ ] Start OCR on 10+ page issue — pages process one at a time with live progress
- [ ] Cancel mid-run — remaining pages stay `pending`
- [ ] Stale page recovery — page stuck in `processing` >5min gets reset
- [ ] Retry All Failed resets and processes page by page
- [ ] Individual page retry still works
- [ ] Select `vertex-flash` → drafts route through Vertex AI
- [ ] Select `nova-pro` → drafts route through Bedrock (Hindi safeguard active)
- [ ] Select `sarvam-30b` → drafts route through Sarvam API
- [ ] `ai_model_used` saved in `ai_cleaned_data` for each draft
- [ ] No `ai.gateway.lovable.dev` URL anywhere in the edge function
- [ ] Gateway-only models (gemini-flash, gpt5, etc.) do not appear in selector
- [ ] Missing/invalid model returns 400, no silent fallback
- [ ] Old Emp News system completely unaffected

