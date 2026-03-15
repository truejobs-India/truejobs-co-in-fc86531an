

# Implementation Plan: Production-Grade Bulk Fix & Enrich System

## Overview

Replace the "Auto Fix & Enrich All" button (lines 145-149, 509-657, 1231-1236 of `BlogPostEditor.tsx`) with two separate report-first, stoppable, DB-persisted workflows: **"Fix All Pending"** and **"Enrich All Pending"**.

## Files to Create/Modify

### 1. DB Migration: `blog_bulk_workflow_sessions` table

```sql
CREATE TABLE public.blog_bulk_workflow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type text NOT NULL CHECK (workflow_type IN ('fix', 'enrich')),
  status text NOT NULL DEFAULT 'scanning'
    CHECK (status IN ('scanning','scan_complete','executing','stopped','completed','failed','stale','cancelled')),
  scan_report jsonb DEFAULT '{}'::jsonb,
  progress jsonb DEFAULT '{"total":0,"done":0,"success":0,"failed":0,"skipped":0,"current_article_id":null}'::jsonb,
  execution_results jsonb DEFAULT '[]'::jsonb,
  stop_requested boolean NOT NULL DEFAULT false,
  ai_model text,
  max_articles_per_run integer NOT NULL DEFAULT 50,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid NOT NULL
);
ALTER TABLE public.blog_bulk_workflow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage workflow sessions"
ON public.blog_bulk_workflow_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

### 2. New Edge Function: `supabase/functions/classify-blog-articles/index.ts`

- Uses exact `verifyAdmin()` pattern from `analyze-blog-compliance-fixes`
- Accepts batch of 5-8 articles with structured content digest:
  - `headings[]`, `meta_summary`, `intro_excerpt` (500 chars), `middle_excerpt` (500 chars from ~50%), `ending_excerpt` (500 chars), `faq_summary`, `internal_links`, `heuristic_scores`, `is_published`, `word_count`
  - For short articles (< 6000 chars): `full_plain_text`
- Returns per-article verdict: `{ slug, verdict, confidence, reasons, severity, action_type, safe_to_bulk_edit, requires_manual_review, preserve_elements, missing_elements, ranking_risk }`
- AI prompt includes ranking-protection rules for published strong posts
- Confidence < 0.7 or ranking_risk 'high' → `manual_review`

### 3. New Hook: `src/hooks/useBulkBlogWorkflow.ts`

Core state machine:

**`startScan(type, posts, aiModel, maxPerRun)`**:
1. Check DB for active sessions (heartbeat < 5 min) → block if exists
2. Insert new session row (status='scanning')
3. **Stage 1**: Client-side heuristic triage using `analyzeQuality()`, `analyzeSEO()`, `analyzePublishCompliance()`, `blogPostToMetadata()`
   - Fix triage: PASS (quality >= 80, SEO >= 80, 0 compliance fails, <= 1 warn) / BORDERLINE (60-80 or warns 2-4) / LIKELY_PENDING_OBJECTIVE (quality < 60 OR SEO < 60 OR compliance failCount >= 3 — skip Stage 2 only for these clear-cut cases)
   - Enrich triage: PASS (wordCount >= 1200, intro+conclusion, >= 3 H2s, FAQs, internal links) / AUTO_PENDING (wordCount < 200, near-empty) / **all others → Stage 2**
4. Update heartbeat after Stage 1
5. **Stage 2**: Send non-PASS candidates to `classify-blog-articles` edge fn in batches of 5-8, update heartbeat after each batch
   - Fix: only BORDERLINE goes to Stage 2 (LIKELY_PENDING_OBJECTIVE already decided)
   - Enrich: everything except PASS and AUTO_PENDING goes to Stage 2
6. Build report with categories: skip_already_good, skip_ranking_protection, minimal_safe_edit, targeted_fix, deeper_enrichment, manual_review, with per-article details
7. Store report in `scan_report` JSONB, set status='scan_complete'

**`confirmExecution(sessionId)`**:
1. Set status='executing'
2. Process only `safe_to_bulk_edit === true` articles, capped at `max_articles_per_run`
3. Sequential with 3s delay; before each article: fetch session to check `stop_requested`
4. After each article: append result to `execution_results` via `jsonb_concat` pattern (read existing array, append, write back) — never overwrites earlier results
5. Update `progress` and `last_heartbeat_at`
6. On stop/complete: set final status, `completed_at`

**`requestStop(sessionId)`**: UPDATE `stop_requested = true`

**`cancelScan(sessionId)`**: Set status='cancelled', preserve partial scan_report for audit

**On mount**: Check for active/scan_complete sessions, restore state. Mark stale if heartbeat > 5 min.

### 4. New Component: `src/components/admin/blog/BulkWorkflowPanel.tsx`

Collapsible panel replacing old button. States:
- **Idle**: Two buttons + max-per-run input (default 50)
- **Scanning**: Progress with cancel button
- **Report**: Summary cards showing:
  - Total scanned / Total pending / Max this run / Deferred by cap
  - Skip (already good) / Skip (ranking protection) / Minimal safe edit / Targeted fix or Deeper enrichment / Manual review
  - Estimated API calls
  - Expandable per-article rows with reasons, severity, confidence
  - Confirm button (only for safe_to_bulk_edit articles up to cap)
- **Executing**: Progress bar, current article, counters, Stop button
- **Stopped/Completed**: Final summary from `execution_results` showing per-article status/reason/timestamp, grouped by: success, failed, skipped during execution, deferred by cap

### 5. Modify `BlogPostEditor.tsx`

- Remove lines 145-149 (bulk fix-enrich state)
- Remove lines 509-657 (handleBulkFixAndEnrich function)
- Remove lines 1231-1236 (old button)
- Add `<BulkWorkflowPanel posts={posts} blogTextModel={blogTextModel} onComplete={fetchPosts} />` in toolbar area
- Keep SAFE_METADATA_FIELDS (used by per-article fix too)

### 6. Modify `supabase/config.toml`

Add:
```toml
[functions.classify-blog-articles]
verify_jwt = false
```

## Key Design Decisions

**Execution results append-safety**: Each article result is appended by reading the current `execution_results` array from DB, pushing the new entry, and writing back. This ensures no data loss on concurrent reads.

**Cancel during scanning**: Sets status to `'cancelled'` — a terminal state. Partial scan data in `scan_report` is preserved for audit. Admin must start fresh scan.

**Objective fix cases that skip Stage 2**: Only articles with compliance `failCount >= 3` OR quality < 60 OR SEO < 60. These are unambiguous. Articles with 1-2 compliance fails or scores 60-80 always go to Stage 2.

**Skip reason separation in final summary**:
- `skip_already_good` — passed Stage 1 heuristics
- `skip_ranking_protection` — Stage 2 AI determined strong published post
- `manual_review` — low confidence or high ranking risk, excluded from bulk
- `deferred_by_cap` — eligible but exceeded max_articles_per_run
- `skipped_execution` — skipped during execution (e.g., edge fn returned skip verdict)

**Stale session handling**: Sessions with `last_heartbeat_at` > 5 min in `scanning`/`executing` status are auto-marked `stale` on mount. No resume — fresh scan required.

