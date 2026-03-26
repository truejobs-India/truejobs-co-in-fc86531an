

# Third Party Cleaner — 3-Phase Implementation Plan

## Current State (Root Causes)

1. **Preview footer** (line 215, `FirecrawlDraftPreviewDialog.tsx`): Shows `Source: {draft.source_name}` — the aggregator name
2. **Published page** (line 219, `EmploymentNewsJobDetail.tsx`): Shows `Source: {job.source}` — exposes pipeline label
3. **Admin row** (line 1202, `FirecrawlDraftsManager.tsx`): Shows `source_name` without "internal" label
4. **No `tp_clean_status` column exists** — no tracking of cleaning state
5. **No branding-sanitizer utility exists** — no shared deterministic cleaner
6. **No cleanup edge function exists** — no backend cleaning action
7. **`executePublish`** (line 843): Copies fields to `employment_news_jobs` without sanitization, sets `source: 'firecrawl'`
8. **`content-cleaner.ts`** has `BRANDING_TOKENS` but only cleans raw markdown — not structured fields
9. **`firecrawl-ai-enrich`** has `AGGREGATOR_DOMAINS` (line 61) but only for link validation — not field-level cleaning

---

## Phase 1: Foundation — Sanitizer Utility + Database Columns + Edge Function

**Goal**: Build the core infrastructure — shared sanitizer, DB tracking columns, and the backend cleanup edge function.

### 1a. Database migration — Add 4 columns to `firecrawl_draft_jobs`
- `tp_clean_status TEXT DEFAULT 'pending'` — values: pending, cleaned, failed, stale
- `tp_cleaned_at TIMESTAMPTZ DEFAULT NULL`
- `tp_clean_log JSONB DEFAULT '[]'`
- `tp_contamination_count INTEGER DEFAULT 0`
- Update `validate_firecrawl_draft_jobs_fields` trigger to validate `tp_clean_status`

### 1b. New file: `supabase/functions/_shared/firecrawl/branding-sanitizer.ts`
Exports:
- `BRANDING_TOKENS` — master list (merge from `content-cleaner.ts` + `ai-enrich` AGGREGATOR_DOMAINS + expanded)
- `AGGREGATOR_DOMAINS` — master list
- `sanitizeTextField(text): { cleaned: string, tracesFound: string[] }` — strips brand tokens, attribution patterns, non-official URLs
- `isAggregatorUrl(url): boolean`
- `isAggregatorImageUrl(url): boolean`
- `detectBrandingTraces(text): string[]` — detection without modification
- `sanitizeDraftFields(draft): { sanitizedFields, totalTraces, traceDetails }` — applies to all publishable text fields

### 1c. New file: `supabase/functions/firecrawl-cleanup-branding/index.ts`
Actions:
- `clean-single` — sanitize one draft row, update DB fields + tp_clean_status
- `clean-batch` — sanitize array of draft IDs with throttling
- `backfill-all` — scan all rows where `tp_clean_status != 'cleaned'`, sanitize in batches
- Auth: admin-only

### 1d. Deploy edge function

---

## Phase 2: Pipeline Integration — Auto-sanitize at Ingest + AI Enrich + Publish Gate

**Goal**: Wire the sanitizer into the existing pipeline so all future jobs are auto-cleaned.

### 2a. `supabase/functions/firecrawl-ingest/index.ts`
- Import `sanitizeDraftFields` from shared module
- After field extraction, before DB upsert: apply sanitization to all text fields
- Set `tp_clean_status = 'cleaned'` if no traces remain, else `'pending'`
- Set `tp_cleaned_at` and `tp_contamination_count`

### 2b. `supabase/functions/firecrawl-ai-enrich/index.ts`
- Import shared `AGGREGATOR_DOMAINS` and `isAggregatorUrl` from branding-sanitizer (remove local duplicate)
- After each AI step that modifies text fields (ai-clean, ai-enrich, ai-fix-missing, ai-seo): set `tp_clean_status = 'stale'`
- This forces admin to re-run Third Party Cleaner after AI modifications

### 2c. `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` — Publish gate
- In `validateForPublish`: add first check — if `tp_clean_status !== 'cleaned'`, add error: `"First Run the Third Party Cleaner"`
- In `executePublish`: apply frontend sanitization to all text fields before insert, set `source: 'TrueJobs'`

### 2d. Redeploy both edge functions

---

## Phase 3: Admin UI — Buttons, Badges, Preview/Public Fixes

**Goal**: Add row-level and bulk cleaner buttons, status badges, and fix UI branding leaks.

### 3a. `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx`
- **DraftJob interface**: Add `tp_clean_status`, `tp_cleaned_at`, `tp_contamination_count`
- **Fetch query**: Add these 3 columns
- **Row-level "Clean" button**: Shield icon, calls `firecrawl-cleanup-branding` with `clean-single`
- **Bulk "Third Party Cleaner" button**: Next to existing bulk buttons, counts rows where `tp_clean_status !== 'cleaned'`, calls `clean-batch`
- **Status badge per row**: gray=pending, green=cleaned, red=failed, amber=stale
- **Admin source label**: Change `{draft.source_name}` to `src: {draft.source_name}` (italic, clearly internal)

### 3b. `src/components/admin/firecrawl/FirecrawlDraftPreviewDialog.tsx`
- Line 214-215: Change to `Published on TrueJobs` — remove aggregator name

### 3c. `src/pages/jobs/EmploymentNewsJobDetail.tsx`
- Line 218-219: Change to `Published on TrueJobs` — remove pipeline label

---

## Files Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | DB migration | Add 4 columns + update trigger |
| 1 | `_shared/firecrawl/branding-sanitizer.ts` | New — shared sanitizer |
| 1 | `firecrawl-cleanup-branding/index.ts` | New — cleanup edge function |
| 2 | `firecrawl-ingest/index.ts` | Auto-sanitize after extraction |
| 2 | `firecrawl-ai-enrich/index.ts` | Stale marking after AI steps |
| 2 | `FirecrawlDraftsManager.tsx` | Publish gate + sanitize before insert |
| 3 | `FirecrawlDraftsManager.tsx` | UI buttons, badges, source label fix |
| 3 | `FirecrawlDraftPreviewDialog.tsx` | Remove aggregator source label |
| 3 | `EmploymentNewsJobDetail.tsx` | Remove pipeline source label |

## Verification Checklist
1. New extraction: fields enter DB sanitized, `tp_clean_status` set
2. AI enrichment: marks `tp_clean_status = 'stale'`
3. Publish blocked with "First Run the Third Party Cleaner" when not cleaned
4. Row-level and bulk Clean buttons functional
5. Status badges visible (pending/cleaned/failed/stale)
6. Preview shows "Published on TrueJobs" — no aggregator name
7. Public page shows "Published on TrueJobs" — no pipeline label
8. Backfill cleans existing contaminated rows
9. Official org names, links, dates remain intact

