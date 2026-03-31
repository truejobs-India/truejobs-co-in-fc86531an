

# Intake-to-Draft-to-Publish Pipeline — Implementation Plan

## Architecture Summary

A 5-phase pipeline: CSV → `intake_drafts` table → AI classification (edge function) → admin review UI → protected publish (edge function) → live tables.

**Key architectural decisions based on codebase inspection:**

1. **AI routing:** Reuse the existing multi-provider `callAI` dispatcher pattern from `firecrawl-ai-enrich` (Vertex AI / Bedrock / Lovable Gateway routing with no hidden fallback). The admin selects a model via the shared `AiModelSelector` component.

2. **Publish routing:** Follow the `handleGovtAutoPublish` pattern — edge function validates, builds data, inserts into `employment_news_jobs`. Publishing happens server-side via edge function with admin auth, not client-side.

3. **Notification routing:** No existing frontend support for `job_category = 'Notification'`. No `Notification` category exists in current data. **Notifications will NOT publish into `employment_news_jobs`. They stay in `manual_check` with a reported gap.**

4. **Exam linking for results/admit_cards/answer_keys:** `govt_exams` has 0 rows. Publishing these types will almost always require creating a parent exam first. The edge function will do strict deterministic matching (exact exam_name + conducting_body), and only create a minimal parent when evidence is sufficient. Otherwise, block publish.

5. **Certificates, marksheets, scholarships:** No live destination tables exist. Block publish, keep in `manual_check`.

---

## Phase 1: Database Migration

Create `intake_drafts` table with ~75 columns across groups A–I:

- `primary_status` is **nullable** (NULL before AI classification), constrained to `publish_ready`, `manual_check`, `reject` via validation trigger
- `processing_status` NOT NULL, default `imported`, values: `imported`, `ai_processed`, `reviewed`, `published`, `publish_failed`
- `review_status` NOT NULL, default `pending`, values: `pending`, `reviewed`, `approved`, `rejected`
- All other enum-like fields validated via trigger (same pattern as existing `validate_firecrawl_draft_jobs_fields`)
- Indexes on 8 columns
- RLS: admin-only read/write using `has_role(auth.uid(), 'admin')`
- `created_at` + `updated_at` with auto-update trigger

---

## Phase 2: CSV Import UI

**New file:** `src/components/admin/intake/IntakeCsvUploader.tsx`

- Raw JS CSV parsing (no new dependency — split by newline, handle quoted fields)
- File input → parse → preview (row count, columns, first 5 rows)
- Column mapping UI (auto-maps common names: `title`→`raw_title`, `url`→`source_url`, etc.)
- On import: inserts rows with `processing_status='imported'`, `review_status='pending'`, `primary_status=NULL`

**Duplicate detection (clearly defined):**
1. **Exact:** Normalize `source_url` (trim, lowercase, strip trailing slash). Skip if match exists in `intake_drafts.source_url`.
2. **Probable:** Normalize title (lowercase, strip punctuation, collapse whitespace). If normalized title + source_domain matches existing row, import it but tag `duplicate_risk`.

**Generic title detection:** Regex match for patterns like `advertisement.pdf`, `notice.pdf`, `corrigendum.pdf`, etc. → tag `generic_title`.

**Stale content detection (stronger):**
- Extract 4-digit years from title + raw_text
- If max year ≤ current year - 2 → tag `old_year` + `stale_content`
- If title contains time-sensitive terms (result, admit card, answer key, merit list, correction notice) AND year ≤ current year - 1 → also tag `stale_content`
- PDF-led: tag `pdf_only` when `raw_file_url` ends with `.pdf` and title ≤ 5 words
- Weak evidence: tag `weak_evidence` when `source_url` missing AND title ≤ 3 words

**Import summary:** total, imported, skipped exact dupes, tagged counts, errors.

---

## Phase 3: AI Classification Edge Function

**New file:** `supabase/functions/intake-ai-classify/index.ts`

- Auth-first pattern (same as `firecrawl-ai-enrich`: verify token → check admin role → then parse body)
- Accepts `{ draft_ids: string[], aiModel: string }`
- **Reuses the same multi-provider callAI dispatcher pattern:** copies the Vertex/Bedrock/Gateway routing from `firecrawl-ai-enrich` — no hidden fallback, uses exact selected model
- Uses tool calling for structured JSON output
- Processes drafts sequentially with 2s delay between calls
- Sets `processing_status = 'ai_processed'`, keeps `review_status = 'pending'`

**AI prompt produces:** `content_type`, `primary_status`, `publish_target`, `secondary_tags[]`, `classification_reason`, `confidence_score` (0-100), `publish_blockers[]`, all normalized fields, dates, links, summary, key_points, draft content.

**Config:** Add `[functions.intake-ai-classify] verify_jwt = false` to `config.toml`.

---

## Phase 4: Admin Review UI

**New files:**
- `src/components/admin/intake/IntakeDraftsManager.tsx` — main container with dashboard cards + filters + table
- `src/components/admin/intake/IntakeDraftDetailDialog.tsx` — view/edit combined dialog

**Dashboard cards:** Total, Imported (unclassified), Publish Ready, Manual Check, Reject, Published

**Filters:** primary_status, publish_target, content_type, processing_status, search

**Table:** Status badges, Title, Org, Post/Exam, Source, Confidence, Tags, Actions

**Row actions:** View/Edit, Re-run AI, Approve, Move to Manual Check, Reject, Publish

**Approve:** Sets `review_status='approved'`, `processing_status='reviewed'`
**Publish:** Only enabled when `primary_status='publish_ready'` AND `review_status='approved'` AND no critical blockers — calls the publish edge function

**Integration:** Add "Intake" tab to `AdminDashboard.tsx`.

---

## Phase 5: Publish Edge Function

**New file:** `supabase/functions/intake-publish/index.ts`

- Auth-first admin check
- Validates: `primary_status='publish_ready'`, `review_status='approved'`, no critical blockers, minimum fields per type
- Slug collision check: query target table for existing slug; if collision, append `-{short_id}`

**Routing (verified against real tables):**

| publish_target | Live table | Notes |
|---|---|---|
| `jobs` | `employment_news_jobs` | Maps normalized fields → existing columns, status='published' |
| `exams` | `govt_exams` | Creates new exam record with slug, status='upcoming' |
| `results` | `govt_results` | Requires valid `exam_id` — strict match or create parent |
| `admit_cards` | `govt_admit_cards` | Same exam_id requirement |
| `answer_keys` | `govt_answer_keys` | Same exam_id requirement |
| `notifications` | **BLOCKED** | No safe destination — stays manual_check |
| `scholarships` | **BLOCKED** | No live table — stays manual_check |
| `certificates` | **BLOCKED** | No live table — stays manual_check |
| `marksheets` | **BLOCKED** | No live table — stays manual_check |

**Exam linking (strict, deterministic):**
1. Query `govt_exams` by exact `exam_name` (case-insensitive trim match)
2. If single confident match → use that `exam_id`
3. If no match AND enough evidence (exam_name + org + at least one date/link) → create minimal `govt_exams` record, use new ID
4. If evidence too weak → block publish, add `missing_exam_link` blocker, keep in `manual_check`

**Post-publish:** Update intake row with `published_record_id`, `published_table_name`, `published_at`, `processing_status='published'`
**On failure:** Set `processing_status='publish_failed'`, store error in `publish_error`

---

## Files to Create (~6)

1. `src/components/admin/intake/IntakeCsvUploader.tsx`
2. `src/components/admin/intake/IntakeDraftsManager.tsx`
3. `src/components/admin/intake/IntakeDraftDetailDialog.tsx`
4. `supabase/functions/intake-ai-classify/index.ts`
5. `supabase/functions/intake-publish/index.ts`

## Files to Modify (~2)

1. `src/pages/admin/AdminDashboard.tsx` — add Intake tab
2. `supabase/config.toml` — add function configs

## Database Changes

1. Create `intake_drafts` table with validation trigger, indexes, RLS policies, updated_at trigger

## Risks & Assumptions

1. `govt_exams` has 0 rows — results/admit_cards/answer_keys will require creating parent exam records
2. No live tables for notifications, scholarships, certificates, marksheets — publish blocked honestly
3. CSV parsing uses raw JS (no PapaParse) — handles basic quoted fields but not all edge cases
4. Edge function timeout (~60s) limits AI batch to ~15 rows per invocation
5. Slug collision resolution uses `-{6-char-id}` suffix

