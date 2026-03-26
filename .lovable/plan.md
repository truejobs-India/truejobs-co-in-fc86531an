

# Phase 4: Validation, Auto-Publish, Retry Queues, and Production Hardening

## Summary

Add an auto-publish pipeline for government drafts that validates, publishes eligible jobs through the existing `employment_news_jobs` flow, and routes failures into retry/review queues. Extend both the edge function and UI with new bulk actions and status tracking.

## Database Changes

**Migration: Extend `publish_readiness` validation + add auto-publish tracking**

The existing `validate_firecrawl_draft_jobs_fields` trigger does NOT validate `publish_readiness` — it's a free-text column. No trigger changes needed for new values.

Add columns to `firecrawl_draft_jobs`:
```sql
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS auto_publish_eligible boolean DEFAULT false;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS auto_published_at timestamptz;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS publish_rejection_reasons text[];
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS promoted_job_id uuid;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS last_retry_at timestamptz;
```

Update `publish_readiness` to support additional values: `ready_to_publish`, `auto_publish_eligible`, `retry_needed`, `failed`, `published`. These are just text values — no constraint exists to update.

## Edge Function: `firecrawl-ai-enrich/index.ts`

### New Action: `govt-validate-publish`

Validates a single government draft against auto-publish gates:
1. **Title present** (length > 10)
2. **Organization present** (length > 2)
3. **Official source URL** (notification or apply link present, not aggregator)
4. **No hallucination flags** (field_confidence has no critical field at "low")
5. **No contamination** (tp_clean_status = 'cleaned')
6. **No unresolved duplicate** (dedup_status != 'duplicate')
7. **Content above minimum** (description_summary or intro_text present)
8. **SEO metadata present** (seo_title, meta_description, slug_suggestion)
9. **AI enrichment completed** (ai_govt_extract_at or ai_enrich_at present)

**Exception path**: Jobs where closing_date is null but official_notification_url is valid → allowed with warning "dates_pending".

Returns `{ eligible: boolean, errors: string[], warnings: string[], publish_readiness: string }` and updates `auto_publish_eligible`, `publish_rejection_reasons`, `publish_readiness` on the draft.

### New Action: `govt-auto-publish`

For a single draft:
1. Run `govt-validate-publish` internally
2. If eligible, execute the same publish logic as `executePublish` in the frontend:
   - Insert into `employment_news_jobs` with all mapped fields
   - Include government-specific fields (advertisement_number, how_to_apply, eligibility_summary, etc.) in description
   - Update draft status to `promoted`, set `auto_published_at`, store `promoted_job_id`
3. If draft already has `promoted_job_id` (re-discovered with better data):
   - UPDATE the existing `employment_news_jobs` row instead of inserting
   - Log as "updated_existing" in enrichment log
4. If not eligible, set `publish_readiness` to appropriate bucket and store rejection reasons

### New Action: `govt-auto-publish-batch`

Batch version:
1. Fetch all government drafts where `publish_readiness = 'ready'` AND `status != 'promoted'` AND `tp_clean_status = 'cleaned'`
2. For each: run `govt-auto-publish` sequentially with 1s delay
3. Return summary: published count, failed count, skipped count, per-row results

### New Action: `govt-retry-failed`

For drafts with `publish_readiness IN ('retry', 'retry_needed', 'incomplete')`:
1. Re-run `ai-govt-extract` with expanded context (20K chars)
2. Re-run `ai-fix-missing`
3. Recalculate `publish_readiness`
4. Increment `retry_count`, set `last_retry_at`
5. Max 3 retries per draft — after that, set `publish_readiness = 'failed'`

### Updated `handleAiRunAll` for Government Drafts

After the existing govt pipeline steps complete, automatically:
1. Run TP Cleaner (call `firecrawl-cleanup-branding` internally or mark as stale)
2. Calculate `publish_readiness`
3. Set `auto_publish_eligible` flag

### Updated `calculatePublishReadiness`

Extend the existing function to support new statuses:
- `ready_to_publish`: All gates pass including TP cleaned
- `auto_publish_eligible`: ready_to_publish + no warnings
- `review_needed`: Some fields at low confidence or missing apply link
- `retry_needed`: Critical fields failed, retry_count < 3
- `incomplete`: Title or org missing
- `failed`: retry_count >= 3, still incomplete
- `published`: Already promoted

## Frontend: `FirecrawlDraftsManager.tsx`

### Extended Filter Tabs

Add to existing `FilterTab` type:
```
'govt-auto-eligible' | 'govt-failed' | 'govt-published'
```

New tabs:
- **Auto-Eligible**: `auto_publish_eligible = true AND status != 'promoted'`
- **Failed**: `publish_readiness = 'failed'`
- **Published**: Government drafts with `status = 'promoted'`

### New Bulk Action Buttons

Add to the toolbar (visible when govt filter tabs active):
1. **"Auto Publish Eligible"** — calls `govt-auto-publish-batch`, shows progress
2. **"Retry Failed"** — calls `govt-retry-failed` for all retry_needed/incomplete drafts
3. **"Validate All"** — calls `govt-validate-publish` for all government drafts to recalculate readiness

### Publish Readiness Badge

Add a visual badge in the table rows showing `publish_readiness` status with color coding:
- `ready_to_publish` / `auto_publish_eligible`: green
- `review_needed`: yellow
- `retry_needed` / `incomplete`: orange
- `failed`: red
- `published`: blue

### Batch Report

After auto-publish batch completes, show persistent report (same pattern as TP Cleaner report):
- Total processed, published, failed, skipped
- Per-row failure reasons visible on hover

### Government Bulk Pipeline Button

A single "Full Pipeline" button that chains:
1. Discovery (all enabled govt sources)
2. Scrape & Extract
3. AI Enrich (Run All)
4. TP Clean
5. Validate & Auto-Publish

Shows progress through each phase.

## Duplicate Update Logic for Published Jobs

In `govt-auto-publish`, before inserting into `employment_news_jobs`:
1. Check if a job with matching slug or (org_name + post) already exists
2. If found and draft has `promoted_job_id` → UPDATE existing row
3. If found by slug match → UPDATE existing row, store `promoted_job_id`
4. If not found → INSERT new row

## Production Hardening

1. **Batch size limits**: All batch operations process max 50 items per invocation to stay within edge function timeout
2. **Rate limiting**: 3s delay between AI calls, 1s between publish operations
3. **Resumability**: Batch operations track progress via `retry_count` and `last_retry_at` — can be re-run safely
4. **Idempotency**: `govt-auto-publish` checks `promoted_job_id` before inserting — safe to re-run
5. **Error isolation**: Per-row try/catch — one failure doesn't stop the batch
6. **Logging**: All publish attempts logged in `ai_enrichment_log` with status, errors, and timestamps

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| DB migration | Create | Add 6 columns to `firecrawl_draft_jobs` |
| `supabase/functions/firecrawl-ai-enrich/index.ts` | Edit | Add `govt-validate-publish`, `govt-auto-publish`, `govt-auto-publish-batch`, `govt-retry-failed` actions (~250 lines), update `calculatePublishReadiness` |
| `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | Edit | Add 3 filter tabs, 3 bulk action buttons, publish readiness badge, batch report (~150 lines) |
| `src/components/admin/firecrawl/GovtSourcesManager.tsx` | Edit | Add "Full Pipeline" button that chains all phases (~40 lines) |

## Full 4-Phase Regression Checklist

### Phase 1 (Foundation)
1. Government sources section visible in Firecrawl admin
2. Bulk import working with URL validation and dedup
3. Government sources filtered out of regular sources list
4. Existing Firecrawl sources unaffected

### Phase 2 (Discovery & Extraction)
5. `discover-govt` uses map API for URL discovery
6. Page scoring prioritizes recruitment-related URLs
7. PDF links detected and staged
8. `govt-scrape-extract` creates drafts in `firecrawl_draft_jobs`
9. Existing `discover-source` and `scrape-pending` still work

### Phase 3 (AI Enrichment)
10. `ai-govt-extract` extracts 20+ fields with confidence scoring
11. `ai-govt-enrich` generates SEO content without hallucination
12. `ai-govt-retry` re-processes low-confidence fields
13. Government filter tabs show correct counts
14. Existing ai-clean/ai-enrich/ai-seo still work for non-govt drafts

### Phase 4 (Auto-Publish & Hardening)
15. `govt-validate-publish` correctly gates on all required fields
16. `govt-auto-publish` inserts into `employment_news_jobs` correctly
17. Duplicate jobs update existing rows instead of creating new ones
18. Auto-publish batch processes sequentially with progress
19. Retry logic respects max 3 retries
20. TP Cleaner gate enforced before publish
21. Published govt jobs appear on public site
22. Failed/incomplete items visible in retry queues with reasons
23. Existing manual publish flow unaffected
24. Bulk Run All still works for non-govt drafts
25. All batch operations are resumable and idempotent

### Known Limitations
- Edge function timeout (~150s) limits batch to ~50 items per invocation — larger batches must be run in multiple rounds
- AI confidence scoring is only as reliable as the AI model used
- PDF extraction quality depends on Firecrawl's PDF-to-markdown capability
- Rate limits from AI providers may slow bulk operations
- No automated scheduling yet — all runs are admin-triggered

