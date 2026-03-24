

## Plan: Azure OCR Queue — Prompt 2 of 4

### What this builds
Fully functional OCR Queue tab that submits uploaded page images to Azure Document Intelligence Layout API, polls for results, stores extracted text, and provides retry controls. Four new edge functions handle all server-side Azure communication.

### Architecture

```text
Frontend (OcrQueueTab.tsx)
  ├── Issue selector + progress summary
  ├── Pages table with status/retry/error
  └── Actions: Start OCR, Retry Page, Retry All Failed
        │
        ▼  supabase.functions.invoke()
Edge Functions (all new, isolated)
  ├── azure-emp-news-start-ocr    → marks pages processing, calls process-page for each
  ├── azure-emp-news-process-page → submits to Azure, polls, saves result
  ├── azure-emp-news-retry-page   → resets single page, calls process-page
  └── azure-emp-news-retry-failed → finds all failed pages, calls process-page for each
```

### Edge function design

**azure-emp-news-process-page** (core worker):
1. Fetch page record from `azure_emp_news_pages`
2. Get image public URL from storage bucket `employment-news-azure`
3. Download image bytes server-side
4. POST to Azure Document Intelligence Layout API (`/documentModels/prebuilt-layout:analyze`)
5. Get `Operation-Location` header → store in `azure_operation_url`
6. Poll `Operation-Location` with backoff (2s, 4s, 8s, max 10 attempts)
7. On success: save `azure_result_json`, extract text content from `analyzeResult.content`, save to `extracted_content`, set `ocr_status=completed`, set `processed_at`
8. On failure: save `error_message`, set `ocr_status=failed`, increment `retry_count`
9. After each page: update issue-level counters (`ocr_completed_pages`, `ocr_failed_pages`, `ocr_status`)

**azure-emp-news-start-ocr**:
- Takes `issue_id`
- Fetches all pages with `ocr_status=pending`
- Processes them sequentially (page-by-page) to avoid rate limits
- Updates issue `ocr_status` to `processing` at start, then `completed`/`partially_completed`/`failed` at end

**azure-emp-news-retry-page**:
- Takes `page_id`
- Resets page status to `pending`, clears error
- Calls process-page logic
- Updates issue counters

**azure-emp-news-retry-failed**:
- Takes `issue_id`
- Finds all `ocr_status=failed` pages
- Processes each sequentially
- Updates issue counters

All four functions: auth-first pattern (admin check before body parsing), CORS headers, `verify_jwt = false` in config.toml.

### New files

| File | Purpose |
|------|---------|
| `supabase/functions/azure-emp-news-start-ocr/index.ts` | Start OCR for all pending pages in an issue |
| `supabase/functions/azure-emp-news-process-page/index.ts` | Core: submit image to Azure, poll, save result |
| `supabase/functions/azure-emp-news-retry-page/index.ts` | Retry single failed page |
| `supabase/functions/azure-emp-news-retry-failed/index.ts` | Retry all failed pages in an issue |
| `src/components/admin/emp-news/azure-based-extraction/OcrQueueTab.tsx` | Full OCR Queue UI |

### Modified files

| File | Change |
|------|--------|
| `src/components/admin/emp-news/azure-based-extraction/AzureEmpNewsWorkspace.tsx` | Replace OCR placeholder with `OcrQueueTab` component |
| `supabase/config.toml` | Add `verify_jwt = false` for all 4 new functions |

### OcrQueueTab UI

- Issue selector dropdown (reuses existing issues list)
- Progress summary card: uploaded / completed / pending / failed counts
- Progress bar showing completion percentage
- Pages table: page_no, filename, ocr_status (badge), retry_count, processed_at, error_message (truncated), actions
- Action buttons: "Start OCR" (for all pending), "Retry Page" (per row, for failed), "Retry All Failed" (bulk)
- Auto-refresh via polling (every 5s while processing) to show live progress
- Toast notifications for success/failure

### Environment variables required

- `AZURE_DOCINTEL_ENDPOINT` — Azure Document Intelligence endpoint URL
- `AZURE_DOCINTEL_KEY` — Azure Document Intelligence API key

Will use `secrets--add_secret` to request these from the user.

### Design decisions

1. **Sequential processing** within edge functions to respect Azure rate limits (not parallel)
2. **Single consolidated edge function** approach considered but rejected — keeping 4 separate functions for clarity and independent retry capability
3. **Polling inside edge function** rather than client-side polling of Azure — cleaner, keeps Azure credentials server-side only
4. **Max 10 poll attempts** with exponential backoff (2s base) — ~17 minutes max wait per page which is generous for Layout API
5. **Auto-retry count**: limited to 3 automatic retries tracked via `retry_count`; manual retry always allowed
6. **Issue counter sync**: after each page completes, count completed/failed pages and update issue record

### Test checklist
- [ ] Secrets `AZURE_DOCINTEL_ENDPOINT` and `AZURE_DOCINTEL_KEY` are set
- [ ] Start OCR on an issue with uploaded pages — pages transition to processing → completed
- [ ] OCR Queue tab shows live progress summary
- [ ] Failed pages show error message and retry button
- [ ] Retry single page works and increments retry_count
- [ ] Retry All Failed processes all failed pages
- [ ] Issue-level ocr_status updates correctly
- [ ] Azure key never exposed to client
- [ ] Old Employment News system unaffected

