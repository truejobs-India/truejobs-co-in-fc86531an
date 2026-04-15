

# Add "Check Our Latest Articles" Homepage Section

## Files to Change
1. **New migration SQL** — add `show_on_homepage` column to `blog_posts`
2. **New file: `src/components/home/LatestArticles.tsx`** — the section component
3. **`src/pages/Index.tsx`** — insert component between LatestGovtJobs and in-content ad
4. **`src/components/admin/BlogPostEditor.tsx`** — add "Show on Homepage" toggle

## 1. Database Migration

```sql
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blog_posts_homepage
  ON public.blog_posts (show_on_homepage, published_at DESC)
  WHERE is_published = true AND show_on_homepage = true;
```

## 2. Thumbnail Optimization Strategy

Cover images are stored in Supabase Storage (`blog-assets` bucket). Supabase Storage supports server-side image transformations via URL parameters.

A helper function will:
- Detect Supabase Storage URLs (containing `/storage/v1/object/public/`)
- Append `?width=256&height=160&resize=cover&quality=75` to serve a ~5-10KB optimized thumbnail instead of the full-size image
- For any non-Storage URL, pass through as-is (CSS `object-cover` handles cropping)

Thumbnail CSS dimensions: `w-24 h-16 sm:w-32 sm:h-20` with explicit `width`/`height` attributes for CLS safety.

All thumbnails use `loading="lazy"` since this section is below the fold (after Latest Govt Jobs).

## 3. LatestArticles Component

**Query logic:**
- Primary: `show_on_homepage = true AND is_published = true`, limit 5, ordered by `published_at DESC`
- Fallback (if zero results): `is_published = true`, limit 5, ordered by `published_at DESC`
- Fields: `id, title, slug, excerpt, cover_image_url, featured_image_alt, category, reading_time, published_at`

**Layout:**
- Outer container: `rounded-2xl border border-slate-200 bg-white shadow` with tri-color top accent (matching LatestGovtJobs style)
- Header: "Check Our Latest Articles" + subtitle + "View All →" linking to `/blog`
- Each row: horizontal card with optimized thumbnail (left), title + excerpt + category chip + reading time (center), orange "Read Article →" CTA (right)
- Entire row is a `<Link to={/blog/${slug}}>` — fully clickable
- Grid: single column, `gap-3`
- Skeleton loading: 3 rows matching final height for CLS safety

## 4. Index.tsx Insertion

```
<LatestGovtJobs />
<LatestArticles />              ← NEW
<AdPlaceholder variant="in-content" />   ← UNCHANGED
<GovtJobCategories />
```

No ad containers moved. Identical spacing preserved.

## 5. Admin Toggle

In `BlogPostEditor.tsx`:
- Add `show_on_homepage` to `formData` state, `resetForm()`, `openEditDialog()`, `buildPostData()`, and `fetchPosts` select fields
- Add a "Show on Homepage" `Switch` toggle in the editor form near publish controls

## AdSense Safety
- All existing ad slots remain in identical positions
- Section `py-8` consistent with other sections
- CLS-safe: skeleton loaders + explicit thumbnail dimensions
- No layout grid changes in Index.tsx

