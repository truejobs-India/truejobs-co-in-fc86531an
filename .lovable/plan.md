

## Fix: drafts table only shows ~8 of 20 rows per page

**Root cause:** All 20 rows ARE rendered, but the table is wrapped in `<ScrollArea className="max-h-[600px]">` (line 433). At the user's viewport, only ~8 rows fit; the remaining 12 are hidden inside an inner scroll container that's easy to miss (especially since the page already scrolls).

**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` (line 432-433, 528-529)

### Change

Remove the inner `ScrollArea` wrapper so all 20 rows render in normal page flow and the user scrolls the page (not a nested container) to see them. Keep the bordered container and horizontal overflow for wide tables.

```tsx
// Before
<div className="border rounded-lg overflow-hidden">
  <ScrollArea className="max-h-[600px]">
    <Table>...</Table>
  </ScrollArea>
</div>

// After
<div className="border rounded-lg overflow-x-auto">
  <Table>...</Table>
</div>
```

Also remove the now-unused `ScrollArea` import.

**Result:** All 20 paginated drafts visible per page; user clicks "Next" / page 2 to see the rest. ~3 lines changed.

