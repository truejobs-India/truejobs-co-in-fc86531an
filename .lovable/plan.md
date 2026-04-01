

# Fix Blog Image Cleanup — Use Existing Article Table

## Problem
The current `BlogImageCleanup` component has its own separate article list with search and checkboxes. The user wants to use the **existing article table** in `BlogPostEditor.tsx` instead, with two direct action buttons.

## Changes

### File 1: `src/components/admin/BlogPostEditor.tsx`

**Add selection state:**
- Add `selectedPostIds` as a `Set<string>` state
- Add `imageCleanupLoading` state for tracking deletion progress

**Add checkbox column to the existing article table (line ~1773):**
- Add a `<TableHead>` with a select-all checkbox as the first column
- Add a `<TableCell>` with per-row checkboxes to each `paginatedPosts.map()` row
- Select-all toggles all currently visible (filtered) posts

**Add two action buttons above the table (near line ~1770):**
- "Delete Cover Images (N)" — destructive variant, disabled when no posts selected or loading
- "Delete Inline Images (N)" — destructive variant, disabled when no posts selected or loading
- Each button triggers an `AlertDialog` confirmation before executing
- Show selected count in button label

**Add deletion logic (imported from cleaned-up BlogImageCleanup utilities):**
- `handleDeleteCoverImages`: For each selected post that has a `cover_image_url`, extract storage path, delete from storage, then set `cover_image_url = null` and `featured_image_alt = null` in DB. Show toast with results.
- `handleDeleteInlineImages`: For each selected post, collect inline URLs from `article_images` and content HTML, delete from storage, clean `article_images` JSON, remove matching `<figure>`/`<img>` from content. Show toast with results.

Both functions use the same safe utilities already in `BlogImageCleanup.tsx`: `extractStoragePath`, `extractInlineUrlsFromContent`, `removeInlineImageFromContent`.

### File 2: `src/components/admin/blog/BlogImageCleanup.tsx`

- Export the three utility functions (`extractStoragePath`, `extractInlineUrlsFromContent`, `removeInlineImageFromContent`) so they can be imported by `BlogPostEditor.tsx`
- Remove the entire component UI (the collapsible panel with its own article list, audit tables, etc.)
- Keep the file as a utility-only module, or move utilities to a small helper file

### File 3: Remove `BlogImageCleanup` component usage

- Remove the `<BlogImageCleanup />` render from `BlogPostEditor.tsx` (line ~1474)
- Remove or update the import

## UI Flow

```text
Existing article table:
┌──┬─────────────────────────┬────────┬───────┬─────┬─────┬───────┬───────┬─────────┬─────────┐
│☑ │ Title                   │ Status │ Words │ Qly │ SEO │ Cover │Inline │ Updated │ Actions │
├──┼─────────────────────────┼────────┼───────┼─────┼─────┼───────┼───────┼─────────┼─────────┤
│☑ │ SSC CGL 2026...         │ Draft  │ 1200  │ 75  │ 80  │  ✓    │  2/2  │ 2h ago  │ ...     │
│☑ │ UPSC Preparation...     │ Draft  │ 900   │ 65  │ 70  │  ✓    │  1/2  │ 3h ago  │ ...     │
│☐ │ Railway Group D...      │ Pub    │ 1500  │ 82  │ 85  │  ✓    │  2/2  │ 1d ago  │ ...     │
└──┴─────────────────────────┴────────┴───────┴─────┴─────┴───────┴───────┴─────────┴─────────┘

  [🗑 Delete Cover Images (2)]  [🗑 Delete Inline Images (2)]    ← only when selection > 0
```

Clicking either button shows a confirmation dialog, then executes the deletion and refreshes the post list.

## Safety

- Confirmation dialog required before any deletion
- Only selected posts are affected
- Cover delete never touches inline images and vice versa
- Storage path validation (`covers/` or `inline/` prefix) preserved
- Toast reports exact counts of deleted files and cleaned DB records
- Post list auto-refreshes after deletion

## Files Changed

1. `src/components/admin/BlogPostEditor.tsx` — add checkboxes, selection state, two delete buttons with confirmation, deletion logic
2. `src/components/admin/blog/BlogImageCleanup.tsx` — convert to utility-only exports, remove component UI

