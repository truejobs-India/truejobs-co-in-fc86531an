

# Fix 3 Issues + Surface Publish Error Reason

## File 1: `IntakeDraftsManager.tsx`

### Fix 1: Safe publish failure handling (lines 269-295, 308-324)

**`handleApproveAndPublish`**: Set `review_status: 'approved'` (edge function requires it), call `intake-publish`. On failure: set `processing_status: 'publish_failed'` and `publish_error` with the error message, revert `review_status: 'pending'`. On success: leave as-is (edge function already sets `processing_status: 'published'`).

**`handleBulkApprovePublish`**: Same pattern per row — on failure, revert and store error.

### Fix 2: `publish_failed` rows visible in Low Confidence with badge + error reason

- Add `publish_error` to `IntakeDraft` type (line ~45)
- In `isLowConfidence` (line 57): add `if (d.processing_status === 'publish_failed') return true;`
- In `filterDrafts` `low_confidence` case (line 89-94): change filter to also include `d.processing_status === 'publish_failed'`
- In table row rendering (line 603-609 area): after existing tag badges, add a red "Publish Failed" badge when `processing_status === 'publish_failed'`, and if `publish_error` is present, show it as a truncated tooltip/subtitle

### Fix 3: Single-row delete confirmation (line 628-631)

- Add `singleDeleteId` state
- Change trash icon onClick to `setSingleDeleteId(d.id)` instead of `handleDeleteIds([d.id])`
- Add a simple `AlertDialog` (or reuse existing `Dialog`): "Permanently delete this draft? This cannot be undone." with Cancel / Delete buttons

### Fix 4: Preserve original payload for Excel/CSV

**File 2: `IntakeCsvUploader.tsx` (line ~300)**

Add `mapped.structured_data_json = row;` after the column mapping loop in the `else` branch (non-JSON imports).

## Summary of changes

| File | Changes |
|------|---------|
| `IntakeDraftsManager.tsx` | Safe publish flow with rollback + error storage, publish_failed in Low Confidence with error reason badge, single-delete confirmation dialog |
| `IntakeCsvUploader.tsx` | Add `structured_data_json = row` for Excel/CSV |

