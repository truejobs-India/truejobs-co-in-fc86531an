

## Goal
Fix the ChatGPT Agent draft preview so it shows the AI-generated cover image and renders the draft exactly as it will appear to users — matching the rich layout used in the blog section's preview.

## Problem
The `IntakeDraftPreviewDialog` currently:
1. Does **not fetch** `image_url`, `image_alt_text`, `publish_title`, `draft_heading_h1`, or `enrichment_result` from the database.
2. Does **not render** the cover image anywhere in the preview.
3. Shows a minimal layout that doesn't match what users actually see on the published page.

## Changes

### 1. Update `IntakeDraftPreviewDialog.tsx` — add missing fields and image display

**SELECT_FIELDS update** — add these columns to the query:
- `image_url`, `image_alt_text`, `publish_title`, `draft_heading_h1`, `enrichment_result`, `category_family`, `update_type`, `organization_authority`, `primary_cta_url`, `primary_cta_label`, `official_reference_url`, `official_website_url`, `secondary_official_url`, `section_bucket`

**Cover image rendering** — in all three preview variants (`JobPreview`, `ExamPreview`, `FallbackPreview`), add a full-width cover image block at the top of the card (before the title), matching the blog layout:
```
{draft.image_url && (
  <img
    src={draft.image_url}
    alt={draft.image_alt_text || title}
    className="w-full h-48 sm:h-64 object-cover rounded-lg mb-4"
  />
)}
```

**Title priority** — use `draft.publish_title || draft.draft_heading_h1 || draft.normalized_title || draft.raw_title` so production-format drafts show their correct title.

**Content priority** — use `draft.enrichment_result || draft.draft_content_html` so enriched content (the actual published version) takes precedence over raw AI output.

**Organization priority** — use `draft.organization_authority || draft.organisation_name` for the org line.

**CTA buttons** — render `primary_cta_url` / `primary_cta_label` as a prominent CTA button alongside the existing official links, and show `official_reference_url`, `official_website_url`, `secondary_official_url` as additional link buttons.

**Category/Update type badges** — show `category_family` and `update_type` as badges in the header area.

### 2. No new files or components needed
All changes are within `src/components/admin/intake/IntakeDraftPreviewDialog.tsx`. The existing component structure (SeoBlock, JobPreview, ExamPreview, FallbackPreview, ContentBlock, LinksBlock) is preserved and extended.

## Verification
- Open ChatGPT Agent section → click the Eye (preview) icon on any draft that has an AI-generated image.
- Confirm the cover image appears at full width at the top of the preview card.
- Confirm the enriched content HTML renders below the image.
- Confirm production-format titles (`publish_title`) display correctly.
- Confirm CTA buttons and official links all render.
- Confirm drafts without images still render correctly (no broken layout).

