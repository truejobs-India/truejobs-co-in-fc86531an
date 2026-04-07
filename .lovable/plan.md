

# Increase Bulk Topic Limit from 20 to 100

## Single file change: `src/components/admin/BlogPostEditor.tsx`

### Change 1 — Validation limit (line 1249)
Change `topics.length > 20` to `topics.length > 100` and update the toast message to `'Maximum 100 topics at a time'`.

### Change 2 — Textarea rows (line 1696)
Increase `rows={4}` to `rows={8}` so more topics are visible without scrolling.

### Change 3 — Add a counter hint
Below the textarea (near line 1697), add a small counter showing `"{N} / 100 topics"` so the user knows how many they've entered and the limit.

**No other files need changes. No logic, routing, or UI structure changes required.**

