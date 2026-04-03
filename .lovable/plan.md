

# Phase 3: Strengthen Sidebar, Internal Linking, and End-of-Article Pageview Flow

## Current State Analysis

**Sidebar (lines 548-570):**
- Sticky sidebar ad (good — keep)
- TOC card (redundant — inline TOC already added in Phase 2)
- RelatedBlogs card — small 64x64 thumbnails, 3 posts, basic layout
- RelatedJobs card — functional but buried below everything
- No distribution/subscribe widgets in sidebar

**End-of-article (lines 487-545):**
- In-content ad → BlogCTA (jobs) → FAQ → Separator → Author box → BlogCTA (all 3 cards) → JobAlertCTA compact
- The sequence is CTA-heavy but lacks compelling "read next" flow
- RelatedBlogs only appears in sidebar, never in the main column where most readers are

**Key problems:**
1. Sidebar TOC is redundant with inline TOC — wastes prime sidebar space
2. RelatedBlogs is sidebar-only with tiny thumbnails — low click-through
3. No "Read Next" recommendation in the main content column after article ends
4. End-of-article has two BlogCTA blocks (lines 490 + 544) which is repetitive
5. Distribution widgets (email, telegram) are not in the sidebar on article pages
6. No topic cluster / category navigation near the end

---

## Plan

### File 1: `src/pages/blog/BlogPost.tsx` — Restructure sidebar and end-of-article

**Sidebar changes (lines 548-570):**
- Remove the redundant sidebar `<TableOfContents>` (inline version is primary now)
- Keep the sticky sidebar ad at the top
- Add `<DistributionSidebar />` below the ad (email + telegram widgets)
- Keep `<RelatedBlogs>` below distribution widgets
- Keep `<RelatedJobs>` at the bottom
- Wrap non-ad sidebar content outside the sticky div so only the ad is sticky

**End-of-article changes (lines 487-545):**
- Keep in-content ad (line 487)
- Remove the first `BlogCTA variant="jobs"` (line 490) — it's redundant with the bottom one
- Keep FAQ section as-is
- After FAQ + author box:
  - Add a full-width "Read Next" section using `<RelatedBlogs>` with a new `variant="cards"` prop that renders as horizontal cards (larger thumbnails, better click targets) — limit 4 posts, 2-column grid
  - Add a compact category cluster nav strip showing the current article's category plus 2-3 related categories as pill links
  - Keep `BlogCTA variant="all"` (the 3-card grid)
  - Keep `JobAlertCTA variant="compact"`
- Add footer ad after the last CTA

**Import `DistributionSidebar`** at the top of BlogPost.tsx.

### File 2: `src/components/blog/RelatedBlogs.tsx` — Add `variant="cards"` for end-of-article

**Current:** Only renders as a sidebar Card with tiny 64x64 thumbnails.

**Add a `variant` prop** with values `"sidebar"` (default, current behavior) and `"cards"`.

The `"cards"` variant:
- No wrapping Card — renders directly as a section with heading
- Grid layout: `grid-cols-1 sm:grid-cols-2` 
- Each item: cover image (aspect-[16/9], 100% width), title (line-clamp-2), category badge, reading time
- Larger click targets, more visual, more compelling
- Increase default limit to 4 for this variant
- Add "Explore more in [category]" link at the bottom pointing to `/blog/category/{slug}`

### File 3: `src/components/blog/CategoryCluster.tsx` — New small component

A compact horizontal strip of category pill links for topic cluster navigation. Props: `currentCategory: string | null`.

Renders:
- Current category highlighted as primary badge
- 3-4 other categories as outline badges linking to `/blog/category/{slug}`
- Uses the same `BLOG_CATEGORIES` array from Blog.tsx (extract to a shared constant if not already shared)
- Compact: single row, flex-wrap, small text

This improves internal linking and crawl paths without being heavy.

### File 4: `src/lib/blogCategories.ts` — Extract shared category list

Move the `BLOG_CATEGORIES` array from `Blog.tsx` into a shared file so both `Blog.tsx` and `CategoryCluster.tsx` can import it. Keep the icon images in the array.

### File 5: `src/pages/blog/Blog.tsx` — Import categories from shared file

Replace the inline `BLOG_CATEGORIES` constant with an import from `src/lib/blogCategories.ts`.

### File 6: `src/index.css` — Minor styling for cards variant

Add `.related-cards` grid styling if needed (likely just Tailwind classes suffice, but add hover transitions for the card items).

---

## Ad-Safety Decisions

- Sidebar ad stays sticky at top — unchanged
- In-content ad stays — unchanged
- Removing duplicate `BlogCTA variant="jobs"` (mid-article) reduces CTA fatigue without removing ads
- Adding footer ad after the last CTA block increases ad inventory
- Distribution widgets in sidebar increase engagement/return visits which supports long-term ad revenue
- "Read Next" cards in main column increase pageviews per session — directly increases ad impressions

## What Is NOT Changed
- No ads removed or repositioned
- No sidebar ad zone changes
- Cover image and header layout untouched
- Inline TOC untouched
- Author box untouched

## Remaining Limitations
- RelatedBlogs query is category-based; if an article has no category, it falls back to recency — this is acceptable
- CategoryCluster shows a fixed set of categories, not dynamically weighted by content volume
- Topic cluster depth depends on having enough published articles per category

## Manual Verification Checklist
1. Open any blog article — sidebar should show: sticky ad → email/telegram widgets → related articles → related jobs
2. No duplicate TOC in sidebar (inline-only now)
3. Scroll to end of article — "Read Next" cards should appear with large thumbnails in a 2-column grid
4. Category cluster strip should show current category highlighted + other category links
5. Only one BlogCTA block (the 3-card "all" variant) — no duplicate mid-article CTA
6. Footer ad appears after the last CTA block
7. Mobile (375px): sidebar content stacks below article; Read Next cards go single-column
8. Verify all ads still render correctly

