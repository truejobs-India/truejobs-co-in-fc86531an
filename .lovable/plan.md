

# Plan: Tighten RSS System with Real DB Support for TrueJobs

## Problem Summary
- `truejobs_relevance_score` is computed but only embedded in `detection_reason` text — no real DB column
- `skip_reason` doesn't exist — reconstructed from scattered text fields in UI
- No source-level usefulness tracking
- 7 policy items and 2 education service items polluting the 19-item review queue (47% noise)
- Noise rejection is keyword-blind — no positive override for recruitment context
- 172/195 items (88%) are unknown/general_alerts/Low

## Changes

### DB Migration 1: Add columns to `rss_items`

```sql
ALTER TABLE rss_items ADD COLUMN truejobs_relevance_score smallint DEFAULT 0;
ALTER TABLE rss_items ADD COLUMN skip_reason text DEFAULT NULL;
CREATE INDEX idx_rss_items_truejobs_score ON rss_items (truejobs_relevance_score);
CREATE INDEX idx_rss_items_skip_reason ON rss_items (skip_reason) WHERE skip_reason IS NOT NULL;
```

### DB Migration 2: Add source usefulness columns to `rss_sources`

```sql
ALTER TABLE rss_sources ADD COLUMN usefulness_score smallint DEFAULT 50;
ALTER TABLE rss_sources ADD COLUMN total_items_ingested integer DEFAULT 0;
ALTER TABLE rss_sources ADD COLUMN core_items_count integer DEFAULT 0;
ALTER TABLE rss_sources ADD COLUMN noise_items_count integer DEFAULT 0;
```

These are simple counters updated during ingestion — no complex subsystem.

### File 1: `supabase/functions/_shared/rss/classifier.ts`

**A. Context-aware noise rejection with positive overrides**

Expand `RESCUE_KEYWORDS` to include the full TrueJobs intent set:
- Add: `cut[\s-]*off`, `score\s*card`, `merit\s*list`, `selection\s*list`, `counselling`, `document\s*verification`, `interview`, `PET`, `PST`, `DV`, `joining`, `last\s*date`, `correction\s*window`, `application\s*start`, `skill\s*test`

This ensures items containing noise patterns but with strong recruitment/exam co-signals are NOT rejected.

**B. Add `skipReason` to `ClassificationResult`**

Return a structured `skipReason` field (null if not skipped):
- `noise_rejected` — matched noise pattern with no rescue
- `non_core_domain` — policy/public_services/education_services with Low relevance
- `generic_department_notice` — signal/unknown type with no recruitment signals
- `null` — item is relevant, not skipped

**C. Reweight scoring to prioritize candidate-action over SEO**

Current: recruitment +40, exam +25, result +20, urgency +15, PDF +5
Change to: recruitment +40, exam/result/admit card +30, urgency +20, PDF +5, SEO demand removed as explicit factor (it was never actually computed — the AI prompt mentioned it but the deterministic scorer doesn't have it). Non-core penalty stays at -30/-40.

**D. Fix `document_service` false positive**

The `document_service` rule at line 282 matches `document\s*verification` which is a core TrueJobs intent. Split:
- `document\s*verification` + `DV\s*schedule` → stays under `exam` type with High relevance (already handled by line 123)
- Remaining `document_service` patterns (correction, upload, etc.) → stay Low

Ensure rule ordering prevents the Low `document_service` rule from matching before the High `exam` rule for DV-related items. Currently correct (exam rule at line 117 comes before document_service at line 276).

### File 2: `supabase/functions/_shared/rss/queue-router.ts`

**A. Tighten queue routing**

Current: Medium relevance policy items enter queue. Fix:
- Core types (recruitment, vacancy, exam, admit_card, result, answer_key) with High or Medium → queue
- Syllabus with High only → queue
- Non-core domains (policy_updates, public_services, general_alerts, education_services) → queue ONLY if `truejobs_relevance_score >= 60` (unchanged threshold but now using real DB column)
- Everything else → NOT queued

This is already mostly implemented. The key fix is ensuring the score comparison uses the real DB value.

**B. Return `skipReason` in QueueDecision**

Already returns `reason` — rename to be consistent. Map reasons to the structured skip_reason values: `non_core_domain`, `insufficient_relevance`, etc.

### File 3: `supabase/functions/rss-ingest/index.ts`

**A. Store `truejobs_relevance_score` and `skip_reason` as real DB fields**

In `processSource`, after classification:
- Write `truejobs_relevance_score: classification.truejobsScore` to the item row
- Write `skip_reason: classification.skipReason` to the item row (null if relevant)
- If queue decision says don't queue, update `skip_reason` from queue decision reason

**B. Update source usefulness counters**

After processing all items for a source, update:
```
total_items_ingested += items_seen
core_items_count += count of items with type in CORE_TYPES
noise_items_count += count of items with skip_reason = 'noise_rejected'
usefulness_score = round(core_items_count / max(total_items_ingested, 1) * 100)
```

**C. Use source usefulness to skip enrichment on chronic noisy sources**

If `source.usefulness_score < 10` and item is not High relevance core type → skip enrichment. Flag in admin.

### File 4: `supabase/functions/_shared/rss/ai-decision.ts`

**A. Tighten banding to use real score column**

Replace `detectionReason.match(/^score=(\d+)/)` parsing with direct access to `item.truejobs_relevance_score` (the real DB column).

**B. No prompt changes needed** — prompts were already tightened in the previous implementation and are correct.

### File 5: `supabase/functions/rss-firecrawl-enrich/index.ts`

**A. Use source usefulness for enrichment gating**

Add source lookup. If source usefulness_score < 15, skip enrichment for non-core types.

**B. Use real `truejobs_relevance_score` column** instead of parsing from text.

### File 6: `src/components/admin/rss-intake/RssFetchedItemsTab.tsx`

**A. Use real DB columns for score and skip reason display**

Replace `parseTrueJobsScore` (which parses from `detection_reason` text) with direct access to `item.truejobs_relevance_score`.

Replace `getSkipReasonBadge` logic (which reconstructs from scattered fields) with direct `item.skip_reason` mapping:
- `noise_rejected` → gray "Noise"
- `non_core_domain` → gray "Non-core"
- `policy_only` → pink "Policy"
- `citizen_service` → gray "Service"
- `low_candidate_intent` → gray "Low intent"
- `weak_truejobs_relevance` → gray "Weak"
- `generic_department_notice` → gray "Generic"
- `source_low_usefulness` → orange "Noisy source"

**B. Add skip_reason filter** to the filter bar for quick isolation.

### File 7: `src/components/admin/rss-intake/rssTypes.ts`

Add `truejobs_relevance_score` and `skip_reason` to the `RssItem` interface. Add `usefulness_score`, `total_items_ingested`, `core_items_count`, `noise_items_count` to `RssSource` interface.

### File 8: `src/components/admin/rss-intake/RssSourcesTab.tsx` (or equivalent source management UI)

Show source usefulness_score as a small badge. Flag sources with score < 15 in orange/red.

---

## What stays the same
- Architecture unchanged
- AI model (Mistral via Bedrock) unchanged
- AI prompts unchanged (already tightened)
- Feed parser, deduper unchanged
- Firecrawl client unchanged
- Review queue table schema unchanged
- No enterprise complexity added

## Verification plan
1. Query before/after classification distribution
2. Confirm policy items no longer enter review queue on re-ingest
3. Confirm core recruitment/exam items still queued correctly
4. Show source usefulness scores after re-ingest
5. Confirm score and skip_reason columns populated and visible in admin UI

## Files changed (8 total)
1. DB migration (2 ALTER TABLE statements)
2. `supabase/functions/_shared/rss/classifier.ts`
3. `supabase/functions/_shared/rss/queue-router.ts`
4. `supabase/functions/rss-ingest/index.ts`
5. `supabase/functions/_shared/rss/ai-decision.ts`
6. `supabase/functions/rss-firecrawl-enrich/index.ts`
7. `src/components/admin/rss-intake/RssFetchedItemsTab.tsx`
8. `src/components/admin/rss-intake/rssTypes.ts`

