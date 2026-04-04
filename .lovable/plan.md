

# Fix: Distinguish "Blocked" from "Failed" in Publish UI

## Problem
When an admin clicks "Approve & Publish" on a draft that has `publish_blockers`, the edge function correctly returns a 400 with `"Publish blocked: ..."`. But the UI treats this identically to a real failure — it shows a red "Publish Failed" toast, reverts `review_status` to `pending`, and sets `processing_status` to `publish_failed`. This makes it look like a code bug instead of a deliberate content block.

## Solution

### 1. Frontend: `IntakeDraftsManager.tsx` — `handleApproveAndPublish` (~lines 306-314)

Detect blocker responses and handle them differently:

- **If error message contains "Publish blocked:"** → show an amber/warning toast titled **"Publish Blocked"** with the blocker reasons, do NOT revert `review_status` or set `processing_status` to `publish_failed` (the draft stays as-is for admin to fix the content)
- **If any other error** → keep existing red "Publish Failed" behavior

Same change in `handleBulkApprovePublish` for consistency.

### 2. Frontend: `IntakeDraftDetailDialog.tsx` — Publish button area (~line 303)

When `draft.publish_blockers` has entries, disable the "Approve & Publish" button and show a small warning label like **"Blocked — clear blockers first"** so the admin knows before even clicking.

### 3. Edge function: No changes needed
The edge function already returns a clear `"Publish blocked: ..."` message. The problem is purely in how the UI interprets and displays it.

## Files Changed

| # | File | Change |
|---|---|---|
| 1 | `src/components/admin/intake/IntakeDraftsManager.tsx` | Detect "Publish blocked" in response, show warning toast instead of error, skip status revert |
| 2 | `src/components/admin/intake/IntakeDraftDetailDialog.tsx` | Disable publish button when blockers exist, show inline warning |

**Total: 2 files, ~20 lines changed**

