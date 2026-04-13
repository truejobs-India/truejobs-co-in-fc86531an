

# Plan: Tighten RSS + AI + Firecrawl System for TrueJobs Business Goal

## Current State Analysis

**Data confirms the problem clearly:**
- **172 of 195 items** (88%) are `unknown/general_alerts/Low` — satellite telemetry from mosdac.gov.in, SEBI legal recovery certificates, income tax press releases
- Only **10 items** (5%) are actual jobs/exam content
- Review queue has **7 policy items** alongside **10 relevant items** — 40% noise
- False positives: "Application for NOC of Mobile Tower" classified as `recruitment`; "Check Application Status" classified as `exam`
- Sources include ISRO satellite data feeds (`mosdac.gov.in/3drimager.xml`), which are completely irrelevant

## Changes Required (4 Files)

### File 1: `supabase/functions/_shared/rss/classifier.ts`

**A. Add early noise-rejection layer (before all rules)**

Add a `NOISE_PATTERNS` blocklist that immediately returns `Low` relevance with a `noise_rejected` reason for items matching:
- Satellite/telemetry: `3RSND`, `L1B`, `L2B`, `SB1`, `SA1`, `sounder`, `imager`, `radiance`, `spectral`
- Financial/legal: `recovery certificate`, `attachment`, `illiquid stock`, `SEBI order`, `adjudicating officer`, `PAN:`, `penalty order`
- Tender-only: `tender`, `corrigendum`, `addendum` (when no recruitment keyword co-occurs)
- Weather/research: `satellite`, `weather`, `cyclone`, `monsoon`, `research paper`, `scientific`
- Utility/NOC: `NOC of Mobile Tower`, `status check`, `status lookup`, `grievance`, `RTI`

**B. Tighten existing rules to reduce false positives**

- Move `document_service` relevance from `Medium` → `Low`
- Move `certificate`, `marksheet`, `school_service`, `university_service` from `Medium` → `Low`
- Move `policy`, `circular` from `Medium` → `Low`
- Move `notification` (public_services) from `Medium` → `Low`
- Move `signal` to remain `Low` (no change)
- Add `scholarship` as `Medium` only if co-occurring with recruitment keywords, else `Low`

**C. Add new high-value patterns (currently missed)**

Add patterns for:
- `cut[\s-]*off`, `score\s*card`, `merit\s*list` → `exam_updates/result`, `High`
- `selection\s*list`, `counselling`, `document\s*verification` (when near recruitment context) → `exam_updates/result`, `High`
- `last\s*date`, `application\s*start`, `correction\s*window` → `jobs/recruitment`, `High`
- `joining`, `interview`, `PET`, `PST`, `DV`, `skill\s*test` → `exam_updates/exam`, `High`

**D. Add `truejobs_relevance_score` to ClassificationResult**

Add a numeric 0–100 score based on weighted signals:
- Recruitment intent: +40
- Exam/result/admit card: +35
- Urgency (dates, deadlines): +15
- PDF presence: +5
- Non-core domain penalty: −30 (policy, public_services, education_services)
- Noise domain penalty: −50 (satellite, legal, financial)

This score is used by downstream banding and queue routing.

### File 2: `supabase/functions/_shared/rss/ai-decision.ts`

**A. Tighten Stage One system prompt**

Replace the generic "government jobs and education portal" prompt with a strict TrueJobs-specific prompt:
- Explicitly state: "You are a strict relevance gatekeeper for TrueJobs.co.in, an Indian government jobs, exams, results, and admit cards website"
- List what to strongly prioritize (recruitment, vacancy, exam notification, result, admit card, answer key, cut-off, merit list, counselling, application dates, DV/interview/joining)
- List what to strongly reject (policy, NOC, certificate services, registration portals, citizen services, tenders, legal orders, satellite data, research, general schemes)
- Add explicit instruction: "When in doubt, prefer skip over queue. TrueJobs audience = job aspirants only."

**B. Tighten Stage Two system prompt**

Same TrueJobs-specific framing. After Firecrawl, the AI must confirm the content actually contains:
- Vacancy details (post names, count, eligibility)
- Exam details (date, syllabus, admit card link)
- Result details (merit list, cut-off, selection list)
- Application process details (dates, how to apply)

If the content is just a portal landing page, policy circular, or generic service page → mark as not useful.

**C. Add `truejobs_relevance_score` to both stage outputs**

Add a 0–100 score field to both StageOneOutput and StageTwoOutput schemas. AI must assign based on:
- Recruitment/vacancy intent: 30 points
- Exam/result/admit card: 25 points  
- Urgency/actionability: 20 points
- SEO/search demand: 15 points
- Noise penalty: −30 points (policy, service, certificate, NOC)

**D. Tighten banding logic**

- Band 1 Low: expand criteria — also skip items where `truejobs_relevance_score < 20` OR domain is `policy_updates`/`public_services`/`education_services` with no co-occurring job/exam keywords
- Band 1 High: expand criteria — also auto-proceed for `exam_updates` domain with `High` relevance even with short summaries (these are often brief but high-value)

### File 3: `supabase/functions/_shared/rss/queue-router.ts`

**A. Replace simple `shouldQueue` with `shouldQueueForTrueJobs`**

Current logic: `relevance === 'High' || relevance === 'Medium'` — this lets all Medium items through including policy, certificates, etc.

New logic:
```
function shouldQueueForTrueJobs(relevanceLevel, primaryDomain, itemType, score):
  // Always queue core types
  if itemType in ['recruitment', 'vacancy', 'exam', 'admit_card', 'result', 'answer_key'] AND relevance in ['High', 'Medium']:
    return { queue: true, reason: 'core_type' }
  
  // Queue high-relevance exam-adjacent types
  if itemType in ['syllabus'] AND relevance === 'High':
    return { queue: true, reason: 'exam_adjacent' }
  
  // Never queue non-core domains unless score > 60
  if primaryDomain in ['policy_updates', 'public_services', 'general_alerts', 'education_services']:
    if score >= 60: return { queue: true, reason: 'high_score_override' }
    return { queue: false, reason: 'non_core_domain' }
  
  // Default: queue only if High relevance
  if relevance === 'High': return { queue: true, reason: 'high_relevance' }
  return { queue: false, reason: 'insufficient_relevance' }
```

**B. Add `skip_reason` to returned data** so the admin UI can show why items were not queued.

### File 4: `src/components/admin/rss-intake/RssFetchedItemsTab.tsx`

**A. Add skip/deprioritization reason badge**

When an item has `firecrawl_reason` containing skip reasons or `ai_stage_one_json?.reason_code`, show a small muted badge:
- `noise_rejected` → "Noise" (gray)
- `non_core_domain` → "Non-core" (gray)
- `low_candidate_intent` → "Low intent" (gray)
- `policy_only` → "Policy only" (pink)
- `citizen_service` → "Service page" (gray)
- `band_1_low` → "Auto-skip" (gray)

**B. Add TrueJobs relevance score column** (small numeric badge, color-coded: green ≥60, amber 30-59, red <30)

### File 5: `supabase/functions/rss-ingest/index.ts`

**A. Pass `truejobs_relevance_score` from classifier into item data**

Store the score on the rss_items row (will need a column addition — but instruction says no DB changes, so store it in `raw_payload` or `detection_reason` string as `"score=75 | Matched..."`)

**B. Use tightened `shouldQueueForTrueJobs` instead of `shouldQueue`**

Pass the domain, type, and score to the new queue routing function.

### File 6: `supabase/functions/rss-firecrawl-enrich/index.ts`

**A. Tighten `shouldEnrich` deterministic rules**

- Do NOT enrich items where `primaryDomain` is `policy_updates`, `public_services`, `general_alerts`, or `education_services` unless item_type is `recruitment`, `vacancy`, `exam`, `admit_card`, `result`, or `answer_key`
- Prefer PDF extraction for `recruitment` + `exam` type items with PDFs
- Prefer page scrape for items with `item_link` pointing to known recruitment board domains

**B. Add Firecrawl `onlyMainContent: true` always** (currently false for PDFs — keep that, but ensure page scrapes strip navigation/chrome)

---

## Live Verification Plan

After implementation:
1. Query rss_items to show before/after classification distribution
2. Confirm mosdac.gov.in satellite items → `noise_rejected`, not queued
3. Confirm SEBI legal items → `noise_rejected`, not queued
4. Confirm income tax press releases → `Low` relevance, not queued (unless recruitment-specific)
5. Confirm recruitment/exam items still classified `High` and queued
6. Show review queue composition improvement

## What Stays the Same
- No DB schema changes (score stored in detection_reason or raw_payload)
- No new edge functions
- No architecture changes
- Execution, dedup, feed parsing unchanged
- AI model (Mistral) unchanged
- RSS source management unchanged

