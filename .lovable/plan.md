

# ChatGPT Agent v1 — Implementation Plan (Final)

## Database Migration (1 migration, 4 columns)

```sql
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS source_channel text DEFAULT 'intake';
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS section_bucket text;
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS import_source_sheet text;
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS import_row_number integer;
```

No trigger changes needed — `source_type = 'manual'` is already valid.

## Edge Function Change

**`supabase/functions/intake-publish/index.ts`**: Add `'scholarships'` case (same as `notifications` but with `job_category: 'Scholarship'`), before the `default` case (~15 lines).

## Files to Create

### 1. `src/components/admin/chatgpt-agent/chatgptAgentExcelParser.ts` (~200 lines)
Pure parser utility. Parses and returns normalized rows (no DB inserts).
- Reads sheets, skips Summary/ReadMe
- Imports from Master_List only; falls back to category sheets if Master_List is missing/empty
- Tolerant column mapping (trim, lowercase)
- Routes rows to 8 section_buckets via Category → Subcategory → Suggested Content Type
- Marks rows Needs Review when: missing title, missing official link, from Needs_Verification, uncertain routing
- Within-batch dedup by normalized title + org
- Returns `{ rows, summary }` — caller handles DB insert

### 2. `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` (~600 lines)
Main component with:
- 8 tabs, top bar (Upload Excel, AI Model Selector, Find Duplicates)
- Table columns: Checkbox, Title, Organization, Status, Official Link (clickable/truncated/copy/"Missing" badge), Last Date, Priority, Duplicate Status, Created Date
- "With Official Link" / "Missing Official Link" filter toggle per tab
- Upload Excel inline dialog: parse → preview → confirm → insert into `intake_drafts`
- AI actions dropdown (Fix, Enrich, SEO Fix, Improve Title, Improve Summary, Generate Slug, Normalize Fields) via `intake-ai-classify`
- Publish button per draft (calls `intake-publish`)
- Row click opens editor

### 3. `src/components/admin/chatgpt-agent/ChatGptAgentDraftEditor.tsx` (~250 lines)
Editor drawer reusing IntakeDraftDetailDialog patterns:
- Editable fields: title, summary, slug, meta_description, seo_title, official links, dates, notes, org, post_name
- Diagnostics tab: import source sheet, row number, routing reason, official link presence
- Save / Delete / Publish buttons

### 4. `src/components/admin/chatgpt-agent/ChatGptAgentDuplicateFinder.tsx` (~150 lines)
Per-section duplicate finder dialog:
- Exact official_notification_link match
- Exact normalized title match
- Same org + post_name combo
- Checks against other chatgpt_agent drafts + `employment_news_jobs` + `blog_posts`
- Shows match reason, select + delete duplicates (drafts only)

## Files to Modify

### `src/pages/admin/AdminDashboard.tsx`
Add `Bot` icon import, tab trigger `"chatgpt-agent"`, and `<TabsContent>` with `<ChatGptAgentManager />`.

## Content Type & Publish Mapping

| Section Bucket | content_type | publish_target | Destination |
|---|---|---|---|
| job_postings | job | jobs | employment_news_jobs |
| admit_cards | admit_card | admit_cards | govt_admit_cards |
| results | result | results | govt_results |
| answer_keys | answer_key | answer_keys | govt_answer_keys |
| exam_dates | exam | exams | govt_exams |
| admissions | notification | notifications | employment_news_jobs |
| scholarships | scholarship | scholarships | employment_news_jobs |
| other_updates | notification | notifications | employment_news_jobs |

