

# Select & Delete: Government Sources and Government Draft Jobs

## Overview
Add checkbox-based multi-select with Select All capability to both the Government Sources table and the Government Draft Jobs table, along with bulk delete actions that permanently remove selected items and all cascading data.

## Changes

### 1. Government Sources — Select & Delete (`GovtSourcesManager.tsx`)

**Selection state:**
- Add `selectedSourceIds: Set<string>` state
- Add a checkbox column (first column) in the table with Select All in header
- "Select All" toggles all currently visible sources

**Delete action:**
- Add a "Delete Selected" destructive button in the header toolbar (visible when `selectedSourceIds.size > 0`)
- Show count: "Delete 3 Selected"
- Confirm via `AlertDialog`: "This will permanently delete X source(s) and all their fetch runs, staged items, and draft jobs. This cannot be undone."
- On confirm: `supabase.from('firecrawl_sources').delete().in('id', [...selectedSourceIds])` — cascading FKs handle child data automatically
- Clear selection and refresh after delete
- Toast: "X sources permanently deleted"

### 2. Government Draft Jobs — Select & Delete (`DraftJobsSection.tsx`)

**Selection state:**
- Add `selectedDraftIds: Set<string>` state
- Add a checkbox column (first column) in the table with Select All in header
- "Select All" toggles all currently visible (filtered) drafts

**Delete action:**
- Add a "Delete Selected" destructive button in the toolbar (visible when `selectedDraftIds.size > 0`)
- Confirm via `AlertDialog`: "This will permanently delete X draft job(s). This cannot be undone."
- On confirm: `supabase.from('firecrawl_draft_jobs').delete().in('id', [...selectedDraftIds])` — cascading FKs handle child data
- Clear selection and refresh after delete
- Toast: "X draft jobs permanently deleted"

### 3. Add Checkbox UI component
Use the existing `Checkbox` from `@/components/ui/checkbox` (standard shadcn component — verify it exists, create if missing).

## Files Changed
| File | What |
|------|------|
| `src/components/admin/firecrawl/GovtSourcesManager.tsx` | Add selection state, checkbox column, bulk delete button + confirmation dialog |
| `src/components/admin/firecrawl/DraftJobsSection.tsx` | Add selection state, checkbox column, bulk delete button + confirmation dialog |
| `src/components/ui/checkbox.tsx` | Create if missing (standard shadcn checkbox) |

## Database
No migration needed. Existing `ON DELETE CASCADE` constraints on `firecrawl_fetch_runs`, `firecrawl_staged_items`, and `firecrawl_draft_jobs` ensure all child data is automatically removed when a source is deleted.

