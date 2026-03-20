

# Review-First Bulk Enrichment — Implementation Plan

## Current Problem

`BulkEnrichByWordCount.tsx` lines 244-253 auto-save enriched content directly into `blog_posts`. Lines 225-228 auto-fail on word count mismatch (`wcValidation?.status === 'fail'`). Both behaviors must be replaced with a review-first flow.

## Architecture

```text
Scan → Generate → Store proposals (new table) → Show summary → Admin reviews → Save only on Accept
```

## Changes

### 1. Database Migration

New table `blog_enrichment_proposals`:

```sql
CREATE TABLE public.blog_enrichment_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  article_id uuid NOT NULL,
  article_title text NOT NULL,
  article_slug text NOT NULL,
  original_content text NOT NULL,
  original_word_count integer NOT NULL DEFAULT 0,
  proposed_content text,
  proposed_word_count integer NOT NULL DEFAULT 0,
  target_word_count integer NOT NULL,
  word_count_delta integer GENERATED ALWAYS AS (proposed_word_count - target_word_count) STORED,
  status text NOT NULL DEFAULT 'pending_review',
  model_used text,
  error_message text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_enrichment_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrichment proposals"
  ON public.blog_enrichment_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bep_batch ON public.blog_enrichment_proposals(batch_id);
CREATE INDEX idx_bep_status ON public.blog_enrichment_proposals(status);
```

Statuses: `pending_review`, `accepted`, `rejected`, `discarded`, `generation_failed`

### 2. Modify `BulkEnrichByWordCount.tsx`

- Add new phase: `'generated'` to Phase type
- Refactor `handleEnrich`:
  - Generate a `batch_id` (UUID) at start
  - For each article, call `improve-blog-content` as before
  - Instead of writing to `blog_posts`, insert into `blog_enrichment_proposals` with `status: 'pending_review'`
  - If generation fails (API error, empty response), insert with `status: 'generation_failed'` and `error_message`
  - Word count mismatch no longer causes failure — all successful generations stored as `pending_review`
  - Remove lines 225-265 (auto-save + auto-fail logic)
- After generation loop, show summary: succeeded/failed counts + "Review Results" button
- Store `currentBatchId` in state, pass to review component

### 3. New Component: `EnrichmentReviewQueue.tsx`

A Dialog that opens when admin clicks "Review Results". Shows a table of proposals for the batch:

**Table columns:** Title | Original WC | Proposed WC | Target | Delta | Status | Actions

**Delta color coding:**
- Red badge: under target by >15%
- Green badge: within ±15% of target
- Amber badge: over target by >15%
- Destructive badge: `generation_failed`

**Per-row actions:** Accept | Reject | Discard | View Detail

**Bulk actions:** Accept All Pending | Reject All Pending (with confirmation)

### 4. New Component: `EnrichmentProposalDetail.tsx`

A Dialog opened from the review queue for a single proposal:

- Shows original content (read-only, left/top) and proposed content (right/bottom)
- Word count metrics: original → proposed, target, delta
- "Edit" button toggles proposed content into a textarea for manual editing
- Action buttons:
  - **Accept & Save**: writes `proposed_content` (or edited version) to `blog_posts.content`, updates `word_count`, `reading_time`, `updated_at`. Sets proposal `status = 'accepted'`.
  - **Reject**: sets `status = 'rejected'`. No change to `blog_posts`.
  - **Discard**: sets `status = 'discarded'`. No change to `blog_posts`.
  - **Save Edited**: if admin edited, saves the edited version to `blog_posts` and updates proposal.

### 5. Safety Rules

- `blog_posts` is ONLY updated when admin clicks Accept/Save
- `original_content` preserved in proposal row for audit
- Reject/Discard never touch `blog_posts`
- Word count mismatch is informational only — shown via colored delta badge

### 6. Files Changed

| File | Change |
|------|--------|
| `src/components/admin/blog/BulkEnrichByWordCount.tsx` | Refactor `handleEnrich` to store proposals, add `'generated'` phase, add summary + review button |
| `src/components/admin/blog/EnrichmentReviewQueue.tsx` | **New** — batch review table with filters and bulk actions |
| `src/components/admin/blog/EnrichmentProposalDetail.tsx` | **New** — per-proposal detail view with accept/reject/edit/discard |
| Migration SQL | **New** — `blog_enrichment_proposals` table |

No edge function changes. No other component changes.

