

## Plan: Prompt 3 — Fragment Building, Reconstruction & AI Draft Creation

### What this builds
Three new edge functions and two new UI tabs that take OCR-completed pages through deterministic fragment building, multi-page notice reconstruction, and AI-powered draft job extraction.

### Architecture

```text
Edge Functions (all new, isolated)
  ├── azure-emp-news-build-fragments     → Stage A: deterministic cleanup + fragment detection + continuation hints
  ├── azure-emp-news-reconstruct-notices → Stage B: merge fragments into reconstructed notices
  └── azure-emp-news-ai-clean-drafts    → Stage C: AI extraction via Lovable AI Gateway, notice-by-notice

UI Components (new)
  ├── ReconstructedNoticesTab.tsx  → list notices, view merged text, trigger rebuild
  └── DraftJobsTab.tsx            → list drafts, validation badges, preview JSON, trigger AI
```

### Edge Function Design

**azure-emp-news-build-fragments** (`issue_id`):
1. Guard: all pages must be `ocr_status=completed` or issue `ocr_status=completed/partially_completed` — reject if any are still `pending/processing`
2. Delete existing fragments for this issue (idempotent rebuild)
3. For each completed page, read `azure_result_json.analyzeResult`:
   - Use `paragraphs` array with `role` and `boundingRegions` from Azure Layout output
   - Remove header/footer paragraphs (role=`pageHeader`/`pageFooter`/`pageNumber`)
   - Group remaining paragraphs into fragments using heading detection, spacing gaps, and content patterns
   - Classify each fragment: `job_notice` (keywords: vacancy, recruitment, post, qualification, last date, apply), `admission`, `editorial`, `advertisement`, `unknown`
   - Detect continuation patterns in text: `contd. on page`, `continued from page`, `contd. from`, regex-based
   - Also infer continuation when a page ends mid-sentence and next page starts without a heading
   - Save `continuation_hint`, `continuation_to_page`, `continuation_from_page`
   - Save `bbox` from Azure boundingRegions
4. Insert all fragments into `azure_emp_news_fragments`
5. Save `cleaned_content` on each page (text minus headers/footers)
6. Update issue `reconstruction_status` to `pending` (ready for Stage B)

**azure-emp-news-reconstruct-notices** (`issue_id`):
1. Guard: fragments must exist (run build-fragments first)
2. Delete existing reconstructed notices for this issue (idempotent)
3. Load all fragments ordered by `page_no`, `fragment_index`
4. Merge logic:
   - Start a new notice group at each `job_notice`/`admission`/`editorial`/`advertisement` fragment that has no `continuation_from_page`
   - Follow continuation chains: if fragment has `continuation_to_page`, find matching fragment on target page
   - Also merge consecutive fragments on same page that share employer name patterns
5. For each merged group:
   - Generate `notice_key` (e.g., `issue-{page}-{index}`)
   - Set `notice_title` from first heading or employer-like line
   - Set `employer_name` from detected org name patterns
   - Set `start_page`, `end_page`
   - Set `merged_text` (concatenated cleaned text)
   - Set `merged_blocks_json` (array of fragment references with page/index)
   - Calculate `reconstruction_confidence` (1.0 for single-page, 0.7-0.9 for multi-page based on continuation evidence strength)
   - Set `ai_status` = `pending`
6. Insert into `azure_emp_news_reconstructed_notices`
7. Update issue `reconstruction_status` = `completed`

**azure-emp-news-ai-clean-drafts** (`issue_id` or `notice_id` for single):
1. Guard: reconstructed notices must exist
2. For each notice with `ai_status=pending` (or the specific one):
   - Filter: skip `editorial`/`advertisement` type notices (determined by majority fragment type)
   - Call Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with `LOVABLE_API_KEY`
   - Model: `google/gemini-2.5-flash` (good balance of speed/quality for structured extraction)
   - Use tool calling for structured output (not raw JSON in prompt)
   - System prompt instructs: clean OCR artifacts, extract structured job fields, do NOT hallucinate
   - Tool schema defines: `employer_name`, `post_names[]`, `vacancies`, `qualification`, `age_limit`, `salary`, `application_method`, `official_website`, `last_date`, `ad_reference`, `source_pages`
   - Process notice-by-notice with 1s delay between calls
3. Deterministic validation after AI response:
   - `employer_name` not empty → else `review_needed`
   - `post_names` not empty for job notices → else `review_needed`
   - Website looks like valid URL/domain if present → else flag in `validation_notes`
   - Dates parseable if present → else flag
   - If merged text was very short (<50 chars) → `review_needed`
   - If all checks pass → `passed`
4. Save to `azure_emp_news_draft_jobs`:
   - `draft_title` = employer name + first post or notice title
   - `draft_data` = raw AI tool call output
   - `ai_cleaned_data` = validated/cleaned version
   - `validation_status` and `validation_notes`
   - `publish_status` = `draft`
5. Update notice `ai_status` = `completed`/`failed`
6. Update issue `ai_status` accordingly

### New files

| File | Purpose |
|------|---------|
| `supabase/functions/azure-emp-news-build-fragments/index.ts` | Stage A: deterministic fragment building |
| `supabase/functions/azure-emp-news-reconstruct-notices/index.ts` | Stage B: merge fragments into notices |
| `supabase/functions/azure-emp-news-ai-clean-drafts/index.ts` | Stage C: AI extraction via Lovable AI Gateway |
| `src/components/admin/emp-news/azure-based-extraction/ReconstructedNoticesTab.tsx` | Notices list, merged text viewer, rebuild action |
| `src/components/admin/emp-news/azure-based-extraction/DraftJobsTab.tsx` | Draft list, validation badges, JSON preview, generate action |

### Modified files

| File | Change |
|------|--------|
| `AzureEmpNewsWorkspace.tsx` | Replace two placeholder tabs with new components |
| `supabase/config.toml` | Add `verify_jwt = false` for 3 new functions |

### No DB migration needed
All tables (`azure_emp_news_fragments`, `azure_emp_news_reconstructed_notices`, `azure_emp_news_draft_jobs`) already exist from Prompt 1.

### UI: ReconstructedNoticesTab
- Issue selector dropdown
- "Build Fragments" button (Stage A) — disabled unless OCR is completed/partially_completed
- "Reconstruct Notices" button (Stage B) — disabled unless fragments exist
- Summary: total notices, job notices, editorial, advertisement counts
- Table: notice_key, start_page, end_page, notice_title, employer_name, reconstruction_confidence (bar), ai_status badge
- Expandable row or dialog to view merged_text

### UI: DraftJobsTab
- Issue selector dropdown
- "Generate AI Drafts" button — disabled unless reconstructed notices exist with ai_status=pending
- Table: draft_title, linked notice, validation_status badge (green/red/yellow), publish_status, created_at
- Expandable row or dialog to preview `draft_data`/`ai_cleaned_data` as formatted JSON
- Validation notes shown inline
- Counts: total drafts, passed, failed, review_needed

### AI approach
Uses the Lovable AI Gateway with `LOVABLE_API_KEY` (already configured). Uses tool calling for structured output extraction — no raw JSON parsing needed. Model: `google/gemini-2.5-flash`.

### Test checklist
- [ ] Build Fragments on an issue with completed OCR — fragments created in DB
- [ ] Headers/footers stripped from fragments
- [ ] Continuation hints detected for multi-page notices
- [ ] Reconstruct Notices merges continuation chains correctly
- [ ] Non-job fragments classified as editorial/advertisement
- [ ] AI Drafts extracts structured fields from job notices
- [ ] Validation catches empty employer name → review_needed
- [ ] Draft preview shows structured data correctly
- [ ] Rate limit errors (429) shown to admin, not silent
- [ ] Cannot run fragments if OCR still pending — proper guard message
- [ ] Old Employment News system completely unaffected

### Assumptions
- Azure Layout output contains `analyzeResult.paragraphs[]` with `role`, `content`, `boundingRegions` — standard for Layout model
- `google/gemini-2.5-flash` via Lovable AI Gateway for AI cleaning (fast, structured output capable)
- Fragments are rebuilt idempotently (delete + reinsert) to allow re-running after fixes
- Editorial/advertisement notices are reconstructed but skipped during AI draft creation
- Processing is sequential (notice-by-notice) with 1s delay to respect rate limits

