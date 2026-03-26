

# Phase 3: AI Extraction, Enrichment, Missing Field Completion, and SEO Fixing

## Summary

Government-sourced drafts already flow into `firecrawl_draft_jobs` (Phase 2). The existing `firecrawl-ai-enrich` edge function already handles ai-clean, ai-enrich, ai-find-links, ai-fix-missing, ai-seo, and ai-run-all for all drafts. Phase 3 adds:

1. A **government-specific deep AI extraction** action that uses multi-source context (listing + detail + PDF) for richer initial field extraction
2. **Extended field coverage** for government job specifics (advt number, fee dates, admit card date, age relaxation, etc.)
3. **Confidence scoring per critical field** with evidence snippets
4. **Retry logic** for low-confidence drafts
5. **Government Draft Jobs filter tabs** in the existing drafts manager
6. **Quality gates** preventing fabricated data from being saved

## Architecture Approach

- Extend the existing `firecrawl-ai-enrich` edge function with new government-specific actions — no new edge functions
- Add new columns to `firecrawl_draft_jobs` via migration for government-specific fields
- Add filter tabs to existing `FirecrawlDraftsManager.tsx`
- Reuse the existing `callAI` multi-model dispatcher, tool-calling patterns, admin protection, and enrichment log

## Database Migration

Add columns to `firecrawl_draft_jobs`:

```sql
-- Government-specific fields
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS advertisement_number text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS last_date_for_fee text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS correction_window text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS admit_card_date text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS result_date text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS age_relaxation text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS how_to_apply text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS important_instructions text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS eligibility_summary text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS application_fee_details text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS selection_process_details text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS vacancy_details text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS important_dates_json jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS official_links_json jsonb DEFAULT '{}';

-- Evidence & confidence tracking
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS field_confidence jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS field_evidence jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS source_type_tag text DEFAULT 'general';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS publish_readiness text DEFAULT 'incomplete';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS ai_govt_extract_at timestamptz;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS ai_govt_enrich_at timestamptz;
```

## Edge Function Changes: `firecrawl-ai-enrich/index.ts`

### New Action: `ai-govt-extract`

A government-specific deep extraction that uses the full raw_scraped_text (up to 12K chars) to extract all government job fields via a single comprehensive tool call. This replaces the generic regex-based extraction for government sources with AI-powered extraction.

**Prompt design:**
- System: "You are a meticulous Indian government job data extractor. Extract ONLY what is explicitly stated. Never invent dates, links, vacancies, or eligibility. Use null for anything not clearly mentioned. Attach evidence snippets for critical fields."
- User: Full raw text + source URL + any existing fields
- Tool schema: All government-specific fields + confidence scores + evidence snippets

**Fields extracted:**
- title, organization_name, post_name, department, advertisement_number
- total_vacancies, vacancy_details
- state, city, location
- category, application_mode
- qualification, eligibility_summary, age_limit, age_relaxation
- salary, pay_scale, application_fee, application_fee_details
- opening_date, closing_date, last_date_for_fee, correction_window, exam_date, admit_card_date, result_date
- selection_process, selection_process_details
- how_to_apply, important_instructions
- official_notification_url, official_apply_url, official_website_url
- field_confidence: `{ title: "high", closing_date: "medium", ... }`
- field_evidence: `{ closing_date: "Last date for submission: 15.07.2026", ... }`

**Quality gates:**
- Dates must match patterns (DD/MM/YYYY, DD.MM.YYYY, etc.) — reject freeform text
- URLs must start with https:// and pass aggregator blocklist
- Vacancies must be numeric
- Evidence snippets required for dates, vacancies, and links — if no evidence, set confidence to "low"

### New Action: `ai-govt-enrich`

Government-specific SEO content generation that produces structured sections for the published page:

- Clean SEO title (max 60 chars)
- Meta description (130-155 chars)
- Slug suggestion
- Structured intro paragraph
- Important dates section (HTML table from dates fields)
- Eligibility section
- Vacancy breakdown section
- Application fee section
- Selection process section
- How to apply section
- Official links section
- 4-6 FAQs grounded in extracted data only

**Anti-hallucination rules in prompt:**
- "Only include dates/links/numbers that appear in the source data"
- "If a section has no data, omit it entirely — do not generate placeholder content"
- "Never fabricate FAQ answers — use only verified extracted information"

### New Action: `ai-govt-retry`

For drafts where `field_confidence` has any critical field at "low" or null:
1. Re-fetch raw_scraped_text (uses more chars — up to 20K)
2. Re-run extraction with explicit instruction to focus on missing/low-confidence fields
3. Merge: only overwrite if new confidence > old confidence
4. Log retry attempt in `ai_enrichment_log`

### Publish Readiness Calculation

After any government extraction/enrichment, compute `publish_readiness`:
- `ready`: title + org + closing_date + (apply_url OR notification_url) present with high/medium confidence
- `review_needed`: some critical fields at low confidence or missing apply link
- `incomplete`: title or org missing
- `retry`: critical fields failed extraction, worth retrying with more context

### Updated `ai-run-all` for Government Drafts

When a draft has `source_type_tag = 'government'`, the run-all sequence becomes:
1. `ai-govt-extract` (instead of ai-clean + ai-enrich)
2. `ai-find-links`
3. `ai-fix-missing`
4. `ai-govt-enrich` (instead of ai-seo)
5. `ai-cover-prompt`
6. Calculate `publish_readiness`

## Frontend Changes: `FirecrawlDraftsManager.tsx`

### Extended Filter Tabs

Add government-specific filter tabs to the existing `FilterTab` type and `filterTabs` array:

```
type FilterTab = ... | 'govt-all' | 'govt-ready' | 'govt-review' | 'govt-incomplete' | 'govt-retry' | 'govt-no-dates' | 'govt-no-links' | 'govt-low-conf';
```

New tabs (grouped under a "Govt Filters" label):
- **Govt All**: `source_type_tag = 'government'`
- **Ready**: `publish_readiness = 'ready'`
- **Review**: `publish_readiness = 'review_needed'`
- **Incomplete**: `publish_readiness = 'incomplete'`
- **Retry**: `publish_readiness = 'retry'`
- **No Dates**: government drafts where `closing_date IS NULL`
- **No Links**: government drafts where `official_apply_url IS NULL AND official_notification_url IS NULL`
- **Low Conf**: government drafts with any critical field confidence = "low"

### Government Steps Indicator

Add `ai-govt-extract` and `ai-govt-enrich` to the `AI_STEP_MAP` so government-specific steps show green/pending badges in the row.

### DraftJob Interface Extension

Add the new fields to the `DraftJob` TypeScript interface so they're available in the UI.

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| DB migration | Create | Add ~16 columns to `firecrawl_draft_jobs` |
| `supabase/functions/firecrawl-ai-enrich/index.ts` | Edit | Add `ai-govt-extract`, `ai-govt-enrich`, `ai-govt-retry` actions (~300 lines), update `ai-run-all` routing |
| `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | Edit | Extend DraftJob interface, add govt filter tabs, add govt step badges (~80 lines) |

## Regression Checklist

1. Existing ai-clean, ai-enrich, ai-fix-missing, ai-seo, ai-run-all still work for non-govt drafts
2. Existing filter tabs (all, draft, enriched, reviewed, etc.) unchanged
3. Government drafts still appear in the main "All" tab
4. AI step badges still show correctly for non-govt drafts
5. Bulk Run All still targets draft-status rows correctly
6. TP Cleaner still works (govt actions set tp_clean_status = 'stale')
7. Publish gate still enforces TP cleaning
8. No new edge functions — all integrated into existing `firecrawl-ai-enrich`
9. `callAI` dispatcher unchanged — same model routing for all actions

