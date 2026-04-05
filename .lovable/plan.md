

# Phase 5: Blog and Content Quality (Revised)

## Key findings from audit

- **Noto Sans Devanagari is already loaded** in `index.html` (lines 49–50) — no change needed there.
- Blog index (`Blog.tsx`) fetches all posts at once with no pagination.
- Card images use fixed `h-48` instead of consistent aspect ratios.
- `BlogCategory.tsx` hardcodes 7 categories instead of the canonical 16.
- No `lang="hi"` applied to Hindi-dominant articles.

---

## Plan

### 1. Add `.hindi-content` CSS class
**File**: `src/index.css`
- Add a `.hindi-content` class that sets `font-family: 'Noto Sans Devanagari', sans-serif` and `line-height: 1.7` on all text inside `.content-area`.

### 2. Stricter Hindi-dominance detection in BlogPost
**File**: `src/pages/blog/BlogPost.tsx`
- Instead of checking if title contains *any* Devanagari character, count the ratio of Devanagari characters to total alphanumeric characters in both title and first 500 chars of content.
- Only apply `lang="hi"` and `.hindi-content` when Devanagari characters exceed 40% of the combined sample. This prevents English articles with a single Hindi word from being tagged as Hindi.

### 3. Sync BlogCategory with canonical category list
**File**: `src/pages/blog/BlogCategory.tsx`
- Remove the hardcoded 7-category `BLOG_CATEGORIES` array and the local `slugToCategory()` function.
- Import `BLOG_CATEGORIES` from `src/lib/blogCategories.ts` and `slugToCategory` from `src/lib/blogUtils.ts`.
- Standardize card images to `aspect-[16/9] object-cover` (replacing `h-48`).
- Set excerpts to `line-clamp-2` for uniform card height.

### 4. Add load-more pagination to Blog index
**File**: `src/pages/blog/Blog.tsx`
- Add state: `page` (number), `hasMore` (boolean).
- Initial fetch: 12 posts via `.range(0, 11)`, ordered `published_at desc`.
- "Load More" appends next 12 via `.range(page*12, page*12+11)` with the same order and filters.
- Deduplicate by `id` on append (guard against concurrent inserts shifting offsets).
- Hide the "Load More" button when fewer than 12 posts are returned (end state).
- Show remaining count badge on button when total is known.

### 5. Card consistency on Blog index
**File**: `src/pages/blog/Blog.tsx`
- Replace `h-48` on card images with `aspect-[16/9] object-cover`.
- Change grid card excerpts from `line-clamp-3` to `line-clamp-2`.
- Keep `line-clamp-3` on featured post only.

### ~~6. Load Noto Sans Devanagari~~
**Skipped** — already loaded in `index.html` lines 49–50.

---

## Files changed

| # | File | Change |
|---|---|---|
| 1 | `src/index.css` | Add `.hindi-content` class |
| 2 | `src/pages/blog/BlogPost.tsx` | Stricter Hindi detection (40% threshold), apply `lang="hi"` + `.hindi-content` |
| 3 | `src/pages/blog/BlogCategory.tsx` | Use canonical categories, aspect-ratio cards, `line-clamp-2` excerpts |
| 4 | `src/pages/blog/Blog.tsx` | Load-more pagination (newest-first, dedup, end-state), aspect-ratio cards, `line-clamp-2` |

**Total: 4 files, ~70 lines changed**

