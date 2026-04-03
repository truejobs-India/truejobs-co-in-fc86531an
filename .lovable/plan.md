

# Intake Draft Preview — End-User View

## What This Does
Replaces the current admin-style preview dialog with one that renders the draft exactly as it would appear to end users on the published page. The preview adapts based on `publish_target` — showing the Employment News Job layout or the Govt Exam layout accordingly.

## Current State
- `IntakeDraftPreviewDialog` shows an admin-formatted view: SEO block, key-details table, raw HTML
- The actual published pages (`EmploymentNewsJobDetail.tsx` and `GovtExamDetail.tsx`) have completely different layouts with cards, badges, info grids, FAQ sections, apply buttons, etc.
- The intake_drafts table stores fields that map to both target tables (org name, post name, exam name, salary, qualification, dates, links, `draft_content_html`)

## Plan

### File: `src/components/admin/intake/IntakeDraftPreviewDialog.tsx` — Full rewrite

Replace the current admin-formatted preview with a layout that mirrors the actual published pages:

**Based on `publish_target`:**

**Jobs target** (publish_target = `jobs` or content_type = `job`): Mirror `EmploymentNewsJobDetail.tsx`:
- Org name as subtitle, normalized_title as h1
- Badge row: vacancy_count, application_mode, job_location
- Info grid (muted bg): salary_text, qualification_text, age_limit_text, application_mode, closing_date, opening_date
- `draft_content_html` rendered as prose
- Official links section (notification + apply)
- Wrapped in a Card with CardContent, matching the real page styling

**Exams/Results/Admit Cards target**: Mirror `GovtExamDetail.tsx`:
- exam_name as h1, organisation_name as conducting body
- Status badge + category badges
- Info grid: vacancy_count, salary_text, closing_date, qualification_text
- `draft_content_html` rendered as prose
- Important links card (apply + notification)

**Fallback** (unknown target): Keep current generic layout with key-details table + HTML content.

**Shared elements across both variants:**
- SEO meta preview block at the top (seo_title, slug, meta_description) — kept as a collapsible admin-only info bar since this doesn't appear on the real page but is useful for review
- Summary block if present
- "Preview Mode" banner at top to clarify this is a draft preview

**No new files needed** — this is a self-contained rewrite of the existing dialog component. No new database queries — same `intake_drafts` select query, just rendered differently.

### Technical Details
- The dialog fetches the same fields it already does from `intake_drafts`
- Field mapping: `organisation_name` → org_name, `post_name` → post, `normalized_title` → enriched_title, `salary_text` → salary, `qualification_text` → qualification, `age_limit_text` → age_limit, `closing_date` → last_date, `draft_content_html` → enriched_description
- Uses the same Card, Badge, Button, and icon components already imported in the project
- `dangerouslySetInnerHTML` for `draft_content_html` stays (trusted internal HTML policy unchanged)
- Dialog max-width stays `max-w-4xl` to approximate the real `max-w-4xl` content area

