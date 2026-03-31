

# Fix: Custom Word Count Input Not Appearing

## Root Cause
In `BlogPostEditor.tsx` line 1561, when "Custom" is selected:
```js
onValueChange={(v) => { if (v !== 'custom') setBulkWordCount(Number(v)); }}
```
This **does nothing** when `v === 'custom'`, so `bulkWordCount` stays at a preset (e.g. 1500). The input field on line 1571 checks `![1200,1500,1800,2200].includes(bulkWordCount)` — which is still `true`, so the input never renders.

## Fix
**File:** `src/components/admin/BlogPostEditor.tsx`

**Line 1561** — Change the `onValueChange` to set a non-preset default when "Custom" is selected:
```js
onValueChange={(v) => {
  if (v === 'custom') setBulkWordCount(2500);
  else setBulkWordCount(Number(v));
}}
```

This sets `bulkWordCount` to 2500 (a non-preset value), which:
1. Makes the input field appear immediately
2. Gives a sensible starting value the user can adjust
3. Preserves all existing logic — presets still work, custom input still clamps 300–5000

**One line change. No other files affected.**

