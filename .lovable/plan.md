
## Revised plan: full grounded evidence + official PDF extraction + honest no-data

### 1. Official trust decision (primary → secondary)
**Primary trust (used as-is, no domain check needed):**
- `intake_drafts.official_notification_url`
- `intake_drafts.official_website_url`
- Any URL inside `structured_data_json.official_*` keys
- Any URL flagged with `verification_status='verified'` + `verified_url`

**Secondary trust (only if no primary exists, AND only as supporting evidence):**
- Domain on `.gov.in` or `.nic.in` (NOT `.org.in` — removed)
- Marked clearly in provenance as `trust=secondary_domain_heuristic` so AI knows it's weaker

Aggregator domains (sarkariresult, freejobalert, etc.) are explicitly excluded from "official" at any level.

### 2. Official PDF extraction (new, required)
Detect PDF by: URL ends `.pdf` OR HEAD `Content-Type: application/pdf`.

Pipeline per official URL:
- If PDF → fetch with Firecrawl (`formats: ['markdown']` — Firecrawl handles PDFs natively and returns extracted text as markdown). Tag bundle entry as `[from: official_pdf @ <ts>, url: …]`.
- If HTML → Firecrawl scrape (`markdown`, `onlyMainContent: true`). Tag as `[from: official_html @ <ts>, url: …]`.
- If both `official_notification_url` (PDF) and `official_website_url` (HTML) exist → fetch BOTH; in the bundle, mark PDF as **PRIMARY** and HTML as **SUPPORTING**.

Cap each fetched body at ~12 KB of relevant excerpt (head + middle + tail) so packing stays sane without dropping facts.

### 3. When official refresh fires (broader triggers)
Fire official refresh BEFORE calling the AI when ANY of:
- A primary official URL exists AND no fetch in last **48 hours** (tighter than 7d), OR
- Critical freshness fields are missing/empty: `closing_date`, `posting_date`, `vacancy_count`, `qualification_text`, `fee_text`, `application_mode`, OR
- Conflicting values exist for any critical field across `structured_data_json` and `raw_text`, OR
- Existing values are only sourced from secondary/aggregator evidence (no `official_*` provenance).

If no official URL exists at all → skip refresh, proceed with what we have. Never block enrichment on a missing official URL.

Fail-soft: fetch failures are logged in `official_fetch_status` but enrichment continues with all other evidence.

### 4. Priority-based evidence packing (replaces proportional truncation)
Build the bundle in tiers, oldest-trimmed-first when nearing the cap. **Tier 1 is never trimmed:**

```text
TIER 1 — never dropped (high-value, structured, low byte cost)
  • All non-empty structured fields (dates, vacancy, qualification, fee, salary, age,
    selection process, application mode, location, department, organization)
  • All official URLs + verification metadata + freshness timestamps
  • Provenance tags for every value (source + tier + age)
  • Conflict map: each field shows preferred value + all alternates with their provenance

TIER 2 — official fetched evidence (PDF preferred, HTML secondary)
  • Official PDF excerpt (up to 12 KB)
  • Official HTML excerpt (up to 8 KB)

TIER 3 — structured payload
  • structured_data_json (pretty, capped 6 KB; trim verbose nested arrays first)

TIER 4 — raw text excerpt (trimmed first under pressure)
  • First 4 KB of raw_text

Total soft cap ~32 KB. If exceeded → trim Tier 4 → trim Tier 3 → never touch Tier 1 or 2.
```

### 5. Conflict + provenance format (sent to AI)
For every important field where multiple sources disagree:
```
closing_date:
  preferred: 2025-11-30   [from: official_pdf @ 2026-04-19T10:00Z, trust=primary]
  alternates:
    - 2025-11-25  [from: structured_data_json, trust=secondary, age=12d]
    - 2025-11-25  [from: raw_text, trust=secondary, age=12d]
```
AI prompt rule: prefer `trust=primary` and freshest timestamp; never fabricate; if all sources are secondary and stale, leave field empty and log reason in `enrichment_notes`.

### 6. No-data is the LAST decision, not a shortcut
Replace `hasSubstantialEvidence` early-exit with a deterministic 4-step gate:
1. Build full Tier 1 from row + structured_data_json. If ≥3 meaningful grounded fields → proceed to AI.
2. Else, if any primary official URL exists → run official refresh (HTML + PDF as applicable) → re-evaluate Tier 1.
3. Else, if only secondary domain hints exist → optionally fetch with `trust=secondary` tag → re-evaluate.
4. Only after steps 1–3 yield zero meaningful structured/fetched evidence → label `not_enriched_no_data` with `enrichment_reason` listing exactly what was attempted ("row had only title+CTA URL; no official URL; structured_data_json empty of facts; raw_text < 200 chars").

### 7. Outcome states (kept, sharpened)
- `enriched` — ≥1 real field written, every written field traceable to a tagged evidence entry
- `not_enriched_no_data` — full 4-step gate exhausted, honestly nothing to enrich
- `not_enriched_tech_error` — JSON parse / timeout / quota / lock / write failure → **retryable**
- `enrichment_reason TEXT` (new column) → human-readable why, plus list of evidence sources actually used

### 8. Retry honesty
- `not_enriched_no_data` → NOT auto-retried by orchestrator (`isAiFixed` treats it as terminal)
- `not_enriched_tech_error` → retried on next "Run All Needed Fixes" (orchestrator does not advance `pipeline_current_step` past errored step)
- Orphan `running` rows → `releaseLock` always finalizes status

### 9. Technical hardening (carried over, now serves the new evidence flow)
- `extractJsonObject()` strips `<think>…</think>` and ```` ```json ```` fences before `JSON.parse`
- `azure-deepseek-r1` timeout 90s → 180s (others unchanged)
- `intake-ai-pipeline` error path: set `failed`, do NOT advance step → idempotent retry
- `releaseLock` always writes terminal status
- 429/quota → surfaced honestly, retryable, no silent model swap (per project memory)

### 10. Schema (tiny additive migration)
```sql
ALTER TABLE intake_drafts
  ADD COLUMN IF NOT EXISTS official_fetch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS official_fetch_html_text TEXT,
  ADD COLUMN IF NOT EXISTS official_fetch_pdf_text TEXT,
  ADD COLUMN IF NOT EXISTS official_fetch_status TEXT,
  ADD COLUMN IF NOT EXISTS official_fetch_url TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_reason TEXT;
```
No RLS changes (existing policies cover new columns).

### 11. Files changed
- `supabase/functions/_shared/intake-ai.ts` — evidence builder rewrite, prompt rewrite, JSON cleanup, timeout fix
- `supabase/functions/_shared/firecrawl/client.ts` — already exists; reused (HTML + PDF both flow through `scrapePage`)
- `supabase/functions/intake-ai-pipeline/index.ts` — error path + lock finalize fix
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — three honest counters + per-row state badge

Out of scope (untouched): row ordering, tabs, filters, "Select all visible", "Select all unfixed", scope banner, RLS, image generation, classification logic, other admin views.

### 12. Verification I will deliver after coding (with real counts)
On a 20-row representative batch (mix of `not_enriched_no_data`, `failed`, `running` orphans, `NULL`):
1. Per-row dump: old evidence vs new evidence vs new outcome
2. **A** = rows that flipped `no_data → enriched` purely from richer row evidence (no fetch)
3. **B** = rows that flipped after **official HTML refresh**
4. **C** = rows that flipped after **official PDF extraction**
5. **D** = rows that stayed honest `no_data` with full reason logged
6. **E** = rows that were `failed` and now `enriched` after technical hardening
7. Spot-check 5 newly enriched rows: every written field shown next to its tagged evidence line
8. Conflict spot-check: 1+ row where stale `structured_data_json` value was correctly NOT used because fresher official PDF disagreed
9. Confirm orphan `running` rows finalized to `failed` and re-runnable
10. Confirm row order, tabs, filters, badges (other than the 3-state addition), and "Run All Needed Fixes" runner unchanged

### Risk
Medium-low. One shared backend file does most of the work. Firecrawl already integrated and proven on this project. 6 additive columns. UI change is cosmetic + truthful. No model fallbacks, no schema rewrites, no orchestrator redesign.
