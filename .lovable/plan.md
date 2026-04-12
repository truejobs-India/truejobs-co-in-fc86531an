

# Corrected Plan: AWS Mistral AI Decision Layer for RSS + Firecrawl System

## Corrections Applied

### 1. Column count: 14 columns (not 13)
The migration, validation trigger, TypeScript types, UI, and all documentation will consistently reference **14 columns**.

### 2. Band 3 removed
Only two bands exist:
- **Band 1** — deterministic skip/proceed (no AI call)
- **Band 2** — AI-assisted (Mistral called for uncertain items)
- On AI failure: fall back to deterministic rules (not a separate band)

### 3. Strict JSON validation
After every Mistral call, validate the parsed output for:
- Valid JSON parse
- All required fields present (`should_use_firecrawl`, `crawl_target`, `queue_priority`, `confidence`, etc.)
- Enum values match allowed sets (e.g., `crawl_target` in `['none','page','pdf']`)
- `confidence` is a number between 0.0 and 1.0
- On any validation failure: log raw output + specific error to `ai_error`, set `ai_decision_status = 'failed'`, fall back to deterministic rules

### 4. Stage Two threshold: meaningful content only
Stage Two runs only when Firecrawl markdown is >= 200 characters AND contains at least one non-whitespace word beyond boilerplate. A `hasSubstantiveContent()` check will strip common boilerplate patterns (nav bars, cookie notices) and verify remaining text exceeds the threshold. Trivial, blank-like, or stub output does not trigger Stage Two.

### 5. Stage Two payload trimmed
Stage Two sends to Mistral only:
- `title` (item_title)
- `source_url` (firecrawl_source_url)
- `content_type` (item_type)
- `relevance_level`
- `excerpt` — first 500 characters of markdown, trimmed
- `markdown_length` — total character count (number, not full text)
- `pdf_mode` if applicable

Full raw markdown is never sent to Mistral.

---

## A. Database Changes — 14 columns added to `rss_items`

```sql
ALTER TABLE public.rss_items
  ADD COLUMN ai_decision_status text NOT NULL DEFAULT 'not_needed',
  ADD COLUMN ai_decision_band text,
  ADD COLUMN ai_stage_one_json jsonb,
  ADD COLUMN ai_stage_one_confidence real,
  ADD COLUMN ai_stage_one_reason text,
  ADD COLUMN ai_stage_one_decided_at timestamptz,
  ADD COLUMN ai_firecrawl_decision text,
  ADD COLUMN ai_queue_priority text,
  ADD COLUMN ai_stage_two_json jsonb,
  ADD COLUMN ai_stage_two_confidence real,
  ADD COLUMN ai_stage_two_reason text,
  ADD COLUMN ai_stage_two_decided_at timestamptz,
  ADD COLUMN ai_model_used text,
  ADD COLUMN ai_error text;
```

Validation trigger addition:
```sql
IF NEW.ai_decision_status NOT IN ('not_needed','pending','stage_one_done','stage_two_done','failed','skipped') THEN
  RAISE EXCEPTION 'Invalid rss_items.ai_decision_status: %', NEW.ai_decision_status;
END IF;
```

---

## B. New shared helper: `_shared/rss/ai-decision.ts`

**Banding logic (deterministic, no AI):**
- Band 1 Skip: `relevance_level = 'Low'` AND no PDFs AND summary >= 80 chars
- Band 1 Proceed: `relevance_level = 'High'` AND summary >= 150 chars AND no PDFs
- Band 2: everything else (Medium relevance, High with weak summary, PDFs with unclear importance, short titles < 30 chars, manual trigger)

**On AI failure:** log error to `ai_error`, set `ai_decision_status = 'failed'`, proceed with deterministic `shouldEnrich()` result. No Band 3.

**Strict JSON validation function** (`validateStageOneOutput`, `validateStageTwoOutput`):
- Parse JSON safely
- Check every required field exists and has correct type
- Validate enums against allowed value sets
- Validate `confidence` is number in [0.0, 1.0]
- Return `{ valid: true, data }` or `{ valid: false, error: string }`

**Mistral call details:**
- Model: `mistral.mistral-large-2407-v1:0` via `awsSigV4Fetch` from `_shared/bedrock-nova.ts`
- Region: `us-west-2`
- Max tokens: 1024, Temperature: 0.1
- Timeout: 30s
- System prompt: strict JSON routing engine instructions

**Stage One output schema:**
```json
{
  "should_use_firecrawl": boolean,
  "crawl_target": "none" | "page" | "pdf",
  "queue_priority": "urgent" | "normal" | "low" | "ignore",
  "should_queue_for_review": boolean,
  "should_skip_as_low_value": boolean,
  "reason_code": string,
  "reason_text": string,
  "confidence": number
}
```

**Stage Two output schema:**
```json
{
  "is_useful_after_enrichment": boolean,
  "likely_content_type": "vacancy" | "result" | "admit_card" | "answer_key" | "exam" | "counselling" | "document_update" | "other",
  "queue_priority": "urgent" | "normal" | "low" | "ignore",
  "should_queue_for_review": boolean,
  "should_retry_firecrawl": boolean,
  "reason_code": string,
  "reason_text": string,
  "confidence": number
}
```

**Stage Two payload (trimmed):**
Only these fields sent to Mistral — no raw markdown:
- `title`, `source_url`, `content_type`, `relevance_level`
- `excerpt` (first 500 chars of markdown)
- `markdown_length` (number)
- `pdf_mode` (if applicable)

**Stage Two gate:** `hasSubstantiveContent(markdown)` — returns true only if markdown >= 200 chars after stripping whitespace and common boilerplate patterns.

---

## C. Integration into `rss-firecrawl-enrich`

- New action: `ai-decide` — runs Stage One only for given item IDs
- Enrichment flow modified: after deterministic check, if Band 2, call Stage One AI
- After successful Firecrawl with substantive content (>= 200 chars post-cleanup), call Stage Two with trimmed payload
- AI cannot bypass hard caps (MAX_ITEMS_PER_CALL=10, FRESHNESS_HOURS=24, MAX_AUTO=5)

---

## D. Integration into `rss-ingest`

- Before Firecrawl dispatch: compute bands for new items
- Band 1 low-value: mark `ai_decision_status='skipped'`, `ai_decision_band='band_1_low'`, exclude from dispatch
- Band 1 high-value: mark `ai_decision_band='band_1_high'`, include in dispatch
- Band 2: include in dispatch, AI runs inside `rss-firecrawl-enrich`
- No AI calls in `rss-ingest` itself

---

## E. UI changes in `RssFetchedItemsTab.tsx`

- "AI" status column with icons (not_needed/stage_one_done/stage_two_done/failed/skipped)
- AI Decision panel in expanded detail: band, confidence, reason, queue priority, error
- "View JSON" toggle for raw AI output
- "AI Decide" in per-item dropdown and bulk toolbar
- "Retry AI" button when status is `failed`

---

## F. Type updates in `rssTypes.ts`

Add 14 AI fields to `RssItem`. Add `AI_DECISION_STATUSES` constant.

---

## G. Files changed

| # | File | Change |
|---|------|--------|
| 1 | Migration SQL | Add 14 columns to `rss_items`, update validation trigger |
| 2 | `supabase/functions/_shared/rss/ai-decision.ts` | **New** — Mistral decision helper with strict JSON validation |
| 3 | `supabase/functions/rss-firecrawl-enrich/index.ts` | Add `ai-decide` action, integrate AI with substantive content gate |
| 4 | `supabase/functions/rss-ingest/index.ts` | Band computation before Firecrawl dispatch |
| 5 | `src/components/admin/rss-intake/rssTypes.ts` | Add 14 AI fields to RssItem |
| 6 | `src/components/admin/rss-intake/RssFetchedItemsTab.tsx` | AI status column, detail panel, actions |

---

## H. Intentionally left out

- No Band 3 (removed per correction)
- No full raw markdown in Stage Two payload
- No Stage Two for items with trivial Firecrawl output (< 200 chars)
- No AI for every item (Band 1 skips AI)
- No publishing pipeline
- No OCR expansion
- No full-site crawling
- No new cron jobs
- No separate AI queue table
- No AI model selection UI
- No changes to monitoring_review_queue routing or dedup logic

