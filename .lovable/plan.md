

# Intake System: Visibility, Error Clarity, and Template Download

## Problem
1. After CSV upload, if AI classification fails, rows with `processing_status: 'imported'` are invisible — no tab shows them.
2. When classification fails, the upload itself appears to have failed (no distinction between upload success and processing failure).
3. No way to download a template file to understand the expected upload format.

## Changes

### 1. Separate upload success from processing failure messages
**File:** `src/components/admin/intake/IntakeDraftsManager.tsx` — `onImportComplete` handler

Currently, `onImportComplete` immediately calls `runAutoProcessing`. Change to:
- Show a success toast: "X rows uploaded to Imported"
- Refresh drafts immediately so imported rows are visible
- Then start auto-processing in background
- If `runAutoProcessing` catches an error, show: "AI processing failed: [real error]" without overwriting the upload success message

### 2. Add "Imported" tab to show unprocessed rows
**File:** `src/components/admin/intake/IntakeDraftsManager.tsx`

- Add `'imported'` to `TabKey` type and `TAB_LABELS` (`"Imported"`)
- Add filter case in `filterDrafts`: rows where `processing_status === 'imported'`
- Add summary card (with `UploadIcon`, blue color) in the stats grid
- Add tab trigger and content
- Include a "Process Now" button on the Imported tab (reuses existing `handleResumeProcessing`)
- Auto-switch to the Imported tab after a successful upload

### 3. Improve `runAutoProcessing` error handling
**File:** `src/components/admin/intake/IntakeDraftsManager.tsx`

- After calling `supabase.functions.invoke('intake-ai-classify')`, check the response for errors
- If the function returns an error or non-200, show toast: "AI processing failed: [detail]" — don't let it fail silently
- Always call `fetchDrafts()` after each batch so the UI stays current

### 4. Add "Download Template" dropdown to uploader
**File:** `src/components/admin/intake/IntakeCsvUploader.tsx`

- Add a `DropdownMenu` button labeled "Download Template" with three options: Excel (.xlsx), CSV (.csv), JSON (.json)
- Template columns: `raw_title`, `source_url`, `source_domain`, `source_name`, `raw_text`, `raw_html`, `raw_file_url`, `raw_file_type`, `source_type`
- Each template includes headers + one sample row with realistic Indian govt job data
- Excel uses the already-imported `xlsx` library; CSV/JSON use `Blob` + `URL.createObjectURL`
- Place the button next to the file input area in the uploader card header

### 5. Deploy `intake-ai-classify` edge function
Deploy the existing function so auto-processing works. No code changes to the function itself.

## Files Changed
| File | What |
|------|------|
| `src/components/admin/intake/IntakeDraftsManager.tsx` | Add Imported tab, fix onImportComplete flow, improve error handling |
| `src/components/admin/intake/IntakeCsvUploader.tsx` | Add Download Template dropdown |
| `supabase/functions/intake-ai-classify/index.ts` | Deploy (no code change) |

## What stays the same
- All existing tabs (Ready, Low Confidence, Published, Rejected) unchanged
- Column mapping, dedup logic, auto-processing loop structure unchanged
- No database changes needed

