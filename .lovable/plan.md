

# Fix: AI Classification Crashing — No Drafts Created

## Root Cause

`IntakeCsvUploader.tsx` line 371 stores `secondary_tags` as `JSON.stringify(tags)` — a **string** like `'["duplicate_risk"]'` instead of a native array `["duplicate_risk"]`.

When `intake-ai-classify` reads these rows back and calls `draft.secondary_tags.join(', ')` on line 282, it crashes because strings don't have a `.join()` method. Every single draft fails with `draft.secondary_tags.join is not a function`, so zero drafts get created.

## Fix

### File 1: `IntakeCsvUploader.tsx` (line 371)

Change `JSON.stringify(tags)` to just `tags` — Supabase automatically serializes arrays to JSONB.

```ts
// Before:
mapped.secondary_tags = JSON.stringify(tags);

// After:
mapped.secondary_tags = tags;
```

### File 2: `intake-ai-classify/index.ts` (line 281-282) — defensive guard

Even after fixing the uploader, add a safety parse for any existing rows that already have stringified tags in the database:

```ts
const rawTags = draft.secondary_tags;
const parsedTags = Array.isArray(rawTags)
  ? rawTags
  : (typeof rawTags === 'string' ? (() => { try { return JSON.parse(rawTags); } catch { return []; } })() : []);
```

Use `parsedTags` for the `.join()` call and for merging.

## What This Fixes

- AI classification will stop crashing on every row
- Drafts will actually be created after classification succeeds
- Existing rows with stringified tags will also work

## Files Changed

| File | Change |
|------|--------|
| `IntakeCsvUploader.tsx` | Remove `JSON.stringify()` wrapper on `secondary_tags` |
| `intake-ai-classify/index.ts` | Add defensive parse for `secondary_tags` before `.join()` and merge |

