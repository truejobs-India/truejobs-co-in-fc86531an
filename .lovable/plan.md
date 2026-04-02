

# Strengthen Empty-Field Extraction — Simplified v1

## Problem
The `intake-ai-classify` edge function ignores `structured_data_json`, `raw_html`, and `source_name`. The tool schema is missing 6 DB fields. No deterministic pre-extraction runs before the AI call. No second pass targets empty fields. Result: many avoidably empty fields in drafts.

## Single File Changed: `supabase/functions/intake-ai-classify/index.ts`

### 1. Add 6 missing fields to CLASSIFICATION_TOOL schema (line ~184)
Add properties: `application_fee_text`, `selection_process_text`, `correction_last_date`, `reference_no`, `ministry_name`, `how_to_apply_text`.

### 2. Feed all available evidence to AI (evidence assembly, lines 275-292)
Add to evidence block:
- `structured_data_json` — stringify first 3000 chars as "Original Import Payload"
- `raw_html` — first 3000 chars as "Source HTML"
- `source_name` as "Source Name"

### 3. Conservative deterministic pre-extraction
Add a `deterministicExtract(draft)` function before the AI call with only these safe rules:

- **Advt/Reference numbers**: regex for patterns like `Advt No. 01/2025`, `No. F.1-12/2025`, `Ref: RRC-01/2025` from title and raw_text
- **Dates from URL/filename**: extract from URL path segments like `/2025/03/15/` or filenames like `notification-2025-03-15.pdf`
- **Application mode keywords**: detect "Apply Online", "Walk-in", "Offline", "Deputation" from title/raw_text (case-insensitive exact phrase match only)
- **Official website from trusted domain**: set `official_website_link` only when `source_domain` is a bare second-level `.gov.in` or `.nic.in` domain (e.g. `upsc.gov.in`, `ssc.nic.in`). Skip subdomains like `cdn.upsc.gov.in`, `mail.xyz.gov.in`, IP addresses, localhost, or any domain with more than 3 dot-separated segments
- **Links from structured_data_json**: if original payload has keys matching `applyLink`, `apply_link`, `notificationLink`, `notification_link`, `resultLink`, `result_link`, `websiteLink`, extract directly as corresponding official link fields

Pre-extracted values are passed to AI as hints and used as fallbacks for any field AI leaves empty.

### 4. Strengthen system prompt (line ~190)
Add to SYSTEM_PROMPT:
- "You MUST attempt to fill every field where evidence exists. Leaving a field empty when evidence contains the answer is a failure."
- "Check the Original Import Payload carefully — it often contains structured fields the scraper already extracted."
- "Check Source HTML for links, dates, and structured data the plain text may have lost."

### 5. Focused fill-empty-fields second pass (after line ~298)
After main AI result, check if 3+ important fields are empty AND evidence is substantial (raw_text > 200 chars or structured_data_json exists). If so:
- Build targeted prompt listing only empty fields + all evidence
- Call AI with "FILL EMPTY FIELDS ONLY — return values only where grounded evidence exists"
- Merge: only overwrite fields that were empty and now have non-empty values
- Apply deterministic fallbacks for any still-empty pre-extracted fields

### 6. Publish-critical blockers only (after all extraction)
Add blockers for only these critical fields when empty:
- `organisation_name` → `missing_organisation`
- `post_name` or `exam_name` (at least one needed for job/result/admit_card) → `missing_post_or_exam_name`
- `official_notification_link` or `official_apply_link` (at least one needed) → `missing_official_link`
- For jobs: `closing_date` empty → `missing_closing_date`

No blocker flooding for optional fields.

### 7. Expand optionalFields list (line ~320)
Add: `application_fee_text`, `selection_process_text`, `correction_last_date`, `reference_no`, `ministry_name`, `how_to_apply_text`.

## Decision flow after changes

```text
Import row → Store with structured_data_json (already done)
  → Deterministic pre-extract (advt no, dates, mode, links, trusted-domain website)
  → AI Pass 1 (full evidence: structured_data_json + raw_html + source_name + pre-extracted hints)
  → Check empty important fields
  → If 3+ empty + evidence exists → AI Pass 2 (targeted fill-empty-fields)
  → Apply deterministic fallbacks for still-empty fields
  → Add critical-only blockers
  → Save draft
```

## What stays the same
- Readiness threshold unchanged
- No new DB schema or migrations
- No new edge functions
- Import flow in `IntakeCsvUploader.tsx` unchanged
- `IntakeDraftsManager.tsx` unchanged — existing `isLowConfidence()` already routes drafts with blockers to Low Confidence

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/intake-ai-classify/index.ts` | Feed structured_data_json + raw_html + source_name, add 6 tool fields, conservative deterministic pre-extraction (with trusted-domain guard), stronger prompt, fill-empty-fields second pass, publish-critical-only blockers |

