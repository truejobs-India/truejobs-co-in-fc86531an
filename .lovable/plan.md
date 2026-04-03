

# Add Enrichment Outcome Status to AI Fill Empty Fields

## Summary
Add a new `enrichment_result` column to `intake_drafts` that records the outcome of each fill-empty-fields run. Show this status in the UI so admins can quickly see which drafts were truly enriched vs. skipped.

## Database Migration

Add one column to `intake_drafts`:

```sql
ALTER TABLE public.intake_drafts
ADD COLUMN enrichment_result text DEFAULT NULL;
```

No enum or CHECK constraint — just a nullable text column storing one of three values:
- `enriched`
- `not_enriched_tech_error`
- `not_enriched_no_data`

NULL means the fill action was never run on this draft.

## File Changes

### 1. `supabase/functions/intake-ai-classify/index.ts`

In the new `fill_empty_only` code path (to be added per the approved plan), after processing each draft:

- **Count fields actually filled**: Compare the update payload against the original empty-field list. If ≥1 field was filled → `enrichment_result = 'enriched'`
- **No fields filled but no error**: → `enrichment_result = 'not_enriched_no_data'`
- **Catch block (tech failure)**: → `enrichment_result = 'not_enriched_tech_error'`

The `enrichment_result` value is included in the same DB update that writes the filled fields. Always set `enrichment_result` in fill_empty_only mode, even on failure.

Return the `enrichment_result` in the per-draft response object so the frontend knows what happened.

### 2. `src/components/admin/intake/IntakeDraftsManager.tsx`

- Add `enrichment_result` to the `IntakeDraft` type and the select query
- In the table row, show a small badge when `enrichment_result` is set:
  - `enriched` → green badge "Enriched"
  - `not_enriched_tech_error` → red badge "Fill Failed"  
  - `not_enriched_no_data` → amber badge "No Data"
- Place it near the existing status badges (e.g., after confidence score or in the actions area)

### 3. `src/components/admin/intake/IntakeDraftDetailDialog.tsx`

- Show `enrichment_result` in the Classification tab if present, using the same badge styling
- Label: "Fill Result" with the outcome badge

## Safety
- Column is only written in `fill_empty_only` mode — normal classification never touches it
- NULL default means existing drafts are unaffected
- No existing columns or logic modified

## Verification Checklist
1. Draft with fillable evidence → shows "Enriched" badge after fill
2. Draft with no usable evidence → shows "No Data" badge
3. Draft where edge function fails → shows "Fill Failed" badge
4. Drafts never run through fill → no badge (NULL)
5. Normal classification flow unaffected

