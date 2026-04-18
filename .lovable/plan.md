
## Final approved plan (with 2 last adjustments)

### Adjustments applied
1. **Migration backfill**: backfill `import_identity = id::text` for **all** existing rows in `public.intake_drafts` where `import_identity IS NULL` (not scoped to `chatgpt_agent`) → then `SET NOT NULL` → then create unique index on `(source_channel, import_identity)`.
2. **Classification fallback**: derive `content_type` and `publish_target` from `update_type` first, then fall back to `category_family` if no clean match.

### A. DB migration (single file)
Add to `public.intake_drafts` (all nullable):
- 16 production columns: `record_id`, `publish_status`, `category_family`, `update_type`, `organization_authority`, `publish_title`, `official_website_url`, `official_reference_url`, `primary_cta_label`, `primary_cta_url`, `secondary_official_url`, `verification_status`, `verification_confidence`, `official_source_used`, `source_verified_on`, `production_notes`
- `source_row_json jsonb`, `source_verified_on_date date`
- `import_identity text` nullable

Then:
```sql
UPDATE public.intake_drafts SET import_identity = id::text WHERE import_identity IS NULL;
ALTER TABLE public.intake_drafts ALTER COLUMN import_identity SET NOT NULL;
CREATE UNIQUE INDEX intake_drafts_source_identity_uidx
  ON public.intake_drafts (source_channel, import_identity);
```

### B. Parser — `parseProductionExcelWorkbook()` in `chatgptAgentExcelParser.ts`
- Sheet detection (3-step): exact `master_publish_ready_verified` → scan all sheets for the full 16-header signature → fallback to first non-empty sheet.
- Strict header validation; missing → `{ ok:false, missing, detected, sheetUsed }`.
- `cleanUrl()` trims and nulls `''`/`N/A`/`-`/`na`/`none`.
- Excel serial date → `YYYY-MM-DD` into `source_verified_on_date`; original text in `source_verified_on`.
- Empty-row skip if all of `publish_title`, `organization_authority`, `category_family`, `update_type`, all 4 URLs blank.
- `import_identity`: `record_id` if present, else `'fb:' + sha256(url||title||org||type||cat).slice(0,32)` where URL precedence is `official_reference_url` → `primary_cta_url` → `official_website_url`.
- `source_row_json` = full original row.
- Legacy mirror: `raw_title` ← `publish_title`; `normalized_title` ← `publish_title`; `organisation_name` ← `organization_authority`; `official_notification_link` ← reference→cta→website (post-sanitize); `structured_data_json` ← `{...source_row_json, _format:'production_v1'}`.
- **`content_type` / `publish_target`**: derive from `update_type` first; if no match, fall back to `category_family`. `content_type` may be null; `publish_target` defaults to `'none'`.
- Status stamps (verified valid): `source_type='manual'`, `raw_file_type='unknown'`, `processing_status='imported'`, `review_status='pending'`, `primary_status` = `publish_ready` if verified+ready else `reject` if reject/discard else `manual_check`.
- Section bucket from same keyword map → `job_postings`/`results`/`admit_cards`/`answer_keys`/`exam_dates`/`admissions`/`scholarships`/`other_updates`.

### C. Importer (`ChatGptAgentManager.tsx`)
- Format detection by header signature → new parser path or existing legacy parser path.
- Pre-fetch existing `import_identity` set for `source_channel='chatgpt_agent'` (paginated) → classify each row as insert vs update.
- Single upsert: `.upsert(rows, { onConflict: 'source_channel,import_identity' })` in batches of 50.
- Summary: `{ total, inserted_new, updated_existing, skipped_empty, failed:[{row,reason}] }` shown in upload dialog.

### D. Draft UI
- **Listing**: title uses `publish_title || normalized_title || raw_title`. New cols: Category Family, Update Type, Org/Board/Authority, Verification Status, Verification Confidence, Source Verified On, Primary CTA (label + clickable URL).
- **Filters**: Publish Status, Category Family, Update Type, Verification Status, Verification Confidence (built from distinct values).
- **Search**: `publish_title`, `normalized_title`, `organization_authority`, `organisation_name`, `record_id`, `official_source_used`, `production_notes`, `official_website_url`, `official_reference_url`, `primary_cta_url`.
- **Editor — new "Production Format" tab**: all 16 fields editable (incl. `official_source_used`, `source_verified_on`); `record_id` read-only; URL fields editable + open-in-new-tab icon; notes textarea wraps; three URL types stay separate.
- **Non-destructive mirror on save**:
  ```ts
  function safeMirror(newVal, legacyVal, userTouched) {
    if (newVal && newVal.trim()) return newVal.trim();
    if (userTouched) return null;
    return legacyVal;
  }
  ```
  Applied to `normalized_title`, `raw_title`, `organisation_name`, `official_notification_link`. `userTouched` derived from edits-state key presence.

### E. Verification (performed by me before declaring done)
1. Build a sandbox `.xlsx` matching all 16 headers, including: row with blank `record_id`, an empty row, an Excel-serial date, an `N/A` URL, an ambiguous row with only `category_family`. Run a Node script that imports the parser and asserts: correct sheet picked, 16 headers detected, empty row skipped, identity = record_id when present and URL-prefixed hash otherwise, date converted, legacy fields mirrored, `content_type`/`publish_target` correctly fall back to `category_family`.
2. Build an old-format `.xlsx`; assert backward-compat path triggers and old parser is used.
3. After deploy, run:
   ```sql
   SELECT count(*), count(import_identity), count(source_row_json),
          count(*) FILTER (WHERE publish_title IS NOT NULL)
   FROM intake_drafts
   WHERE source_channel='chatgpt_agent'
     AND structured_data_json->>'_format'='production_v1';
   ```
   Inspect one full row → all 16 + legacy fields populated. Re-run same payload → 0 inserts / N updates.

### Files
- `supabase/migrations/<new>.sql` — 16 cols + `source_row_json` + `source_verified_on_date` + `import_identity` (add → backfill all → NOT NULL → unique index).
- `src/components/admin/chatgpt-agent/chatgptAgentExcelParser.ts` — add `parseProductionExcelWorkbook` + helpers; existing parser untouched.
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — detection, classify, upsert, columns/filters/search, summary dialog.
- `src/components/admin/chatgpt-agent/ChatGptAgentDraftEditor.tsx` — new "Production Format" tab + non-destructive mirror.

### Risk: low
Migration adds nullable cols + 1 plain unique index after global backfill. Parser additive; legacy parser untouched. Status enums verified against live trigger. Mirror non-destructive. URL sanitation conservative. Classification falls back to `category_family` for ambiguous rows.
