

# Blog Image Cleanup — Two Separate Admin Functions (Revised)

## Overview

Two separate, isolated admin functions for safely deleting blog images for selected articles. One for cover images, one for inline images. Both support mandatory dry-run audit before actual deletion.

## Architecture

New component `BlogImageCleanup.tsx` in `src/components/admin/blog/`, rendered as a collapsible section in `BlogPostEditor.tsx`. Provides article multi-select, two separate audit buttons, dry-run display, and confirmed delete actions.

### Shared Utility

```typescript
function extractStoragePath(publicUrl: string): string | null {
  const marker = '/blog-assets/';
  const idx = publicUrl.indexOf(marker);
  return idx === -1 ? null : publicUrl.substring(idx + marker.length);
}
```

## Function 1: Delete Cover Images

**Input:** Array of blog post IDs

**Dry-run output shape:**

| Post ID | Slug | Cover URL | Storage Path | File Exists |
|---------|------|-----------|-------------|-------------|

**Delete logic:**
1. `supabase.storage.from('blog-assets').remove([storagePath])` for each verified match
2. Set `cover_image_url = null`, `featured_image_alt = null` for matched posts
3. Does NOT touch: inline images, `article_images`, `content` HTML

## Function 2: Delete Inline Images

**Input:** Array of blog post IDs

**Dry-run output shape:**

| Post ID | Slug | Inline URL | Storage Path | File Exists | Reference Source |
|---------|------|-----------|-------------|-------------|-----------------|

The **Reference Source** column shows where the inline image was found: `article_images`, `content`, or `both`. This is derived during audit by checking whether the URL appears in the `article_images.inline` JSON array, in `<img>` tags within `content` HTML, or in both locations.

**Delete logic:**
1. `supabase.storage.from('blog-assets').remove([storagePath])` for each verified match
2. Remove matching entries from `article_images.inline` array
3. Remove `<figure data-inline-slot="N">` blocks (or standalone `<img>` tags) from `content` where `src` matches deleted URL
4. Does NOT touch: cover images, `cover_image_url`, `featured_image_alt`

## UI Flow

```text
[Image Cleanup] (collapsible)
  ┌─ Search articles... ──────────────────────────┐
  │ ☑ ssc-cgl-2026-notification    (has cover ✓)  │
  │ ☑ upsc-preparation-tips        (has cover ✓)  │
  │ ☐ railway-group-d-vacancy      (no cover)     │
  └────────────────────────────────────────────────┘
  [Audit Cover Images]  [Audit Inline Images]
  
  ── Dry-Run: Inline Images ───────────────────────
  | Slug                      | Storage Path          | Exists | Ref Source      |
  | ssc-cgl-2026-notification | inline/ssc-...-s1.png | Yes    | both            |
  | ssc-cgl-2026-notification | inline/ssc-...-s2.png | Yes    | article_images  |
  Total: 2 inline images to delete
  [Confirm Delete Inline Images]
```

## Files Changed

1. **`src/components/admin/blog/BlogImageCleanup.tsx`** — New component with both cleanup functions, article selector, dry-run display with reference source column for inline, and confirmed delete actions
2. **`src/components/admin/BlogPostEditor.tsx`** — Import and render `BlogImageCleanup` in toolbar area

## Safety Guarantees

- Cover and inline functions are completely separate — no shared delete path
- Dry-run is mandatory before delete
- Only selected article IDs are queried
- Storage path must start with `covers/` (function 1) or `inline/` (function 2)
- Missing storage files reported; DB references still cleaned if ownership is certain
- Published status never changed
- No changes to public rendering, SEO, AdSense, or sitemaps beyond cleaning broken image URLs

