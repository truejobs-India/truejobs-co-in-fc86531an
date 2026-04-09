

# Fix: Blog Admin Table Shows "No blog posts yet" — Statement Timeout

## Root Cause

The network logs prove it definitively:

| Query | Status | Result |
|---|---|---|
| `blog_posts?select=*&order=created_at.desc` (main table) | **500** | `"canceling statement due to statement timeout"` |
| `blog_posts?select=*` (stats component) | **200** | Success |

The main `fetchPosts()` query at line 264-268 of `BlogPostEditor.tsx` does `SELECT *` with `ORDER BY created_at DESC` on 660 posts. Each row contains a large `content` column (full HTML article body). Sorting 660 large rows by `created_at` exceeds the database statement timeout.

The stats query succeeds because it has no `ORDER BY` clause, which is cheaper for the database to execute.

## Fix Strategy

Two complementary changes — both in the same file:

### Change 1: Select only needed columns in `fetchPosts()` (primary fix)

Replace `.select('*')` with an explicit column list that **excludes the large `content` column** from the list query. The content is only needed when editing a single post — not for rendering the table rows.

Columns needed for the table: `id, title, slug, is_published, published_at, created_at, updated_at, meta_title, meta_description, cover_image_url, featured_image_alt, excerpt, category, tags, author_name, word_count, reading_time, content_mode, canonical_url`

The `content` column (and possibly `article_images`) will be fetched on-demand only when the user clicks "Edit" on a specific post.

### Change 2: Lazy-load content on edit

When the user clicks to edit a post, fetch `content` and `article_images` for that single post from the database. This keeps the table load fast and only pulls heavy data when needed.

### Optional: Add a database index

If the timeout persists even without `content`, add an index on `created_at` via migration:
```sql
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC);
```

This is a safety net — the column-pruning fix should be sufficient alone.

## Files Changed

1. **`src/components/admin/BlogPostEditor.tsx`** — Change `fetchPosts` to select specific columns (exclude `content`, `article_images`), add lazy content fetch on edit
2. **Database migration** (if needed) — Add index on `created_at`

## What is NOT changed

- No layout changes
- No stats component changes
- No blog rendering changes
- No other admin tools affected

## Why the previous behavior failed

`SELECT * ORDER BY created_at DESC` on 660 rows with multi-KB HTML content per row requires the database to load all content into memory, sort it, and return it — exceeding the statement timeout (likely 8-10 seconds for the anon/authenticated role).

## Why the fix works

Excluding the `content` column reduces the per-row payload from potentially 50-100KB to ~1KB. The same query with ordering becomes trivially fast. Content is loaded only for the single post being edited.

