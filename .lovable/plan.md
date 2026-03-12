

# Blog Publishing System Upgrade — Implementation Plan

This is a large upgrade touching ~15 files. It extends the existing blog system with scoring, analysis, image generation, and editorial workflow improvements.

## Architecture

```text
┌─ blogArticleAnalyzer.ts (scoring engine) ─────────────┐
│  analyzeQuality() → QualityReport (0-100)              │
│  analyzeSEO() → SEOReport (checklist)                  │
│  getReadinessStatus() → ReadinessStatus                │
│  THRESHOLDS constant (centralized config)              │
└────────────────────────────────────────────────────────┘
         ↓ used by both tabs
┌─ BlogPostEditor.tsx ──────┐  ┌─ BulkBlogUpload.tsx ────┐
│  + search/filter/paginate │  │  + save-as-draft persist │
│  + scores in table        │  │  + scores in queue       │
│  + delete confirm dialog  │  │  + validation gates      │
│  + autosave (5s debounce) │  └─────────────────────────┘
│  + collapsible panels     │
└───────────────────────────┘
         ↓
┌─ generate-blog-image (edge function) ──────────────────┐
│  DIRECT Gemini 2.5 Flash API only                      │
│  Admin-auth validated via getClaims() + has_role()      │
│  Uploads to blog-assets/covers/{slug}-generated.png    │
└────────────────────────────────────────────────────────┘
```

## Centralized Thresholds

All scoring thresholds live in one place inside `blogArticleAnalyzer.ts`:

```typescript
export const BLOG_THRESHOLDS = {
  QUALITY_EXCELLENT: 85,
  QUALITY_GOOD: 70,
  QUALITY_NEEDS_IMPROVEMENT: 50,
  SEO_GOOD: 70,
  SEO_ACCEPTABLE: 50,
  MIN_WORD_COUNT_FULL: 1200,
  MIN_WORD_COUNT_ADEQUATE: 800,
  THIN_CONTENT_THRESHOLD: 300,
  META_TITLE_MAX: 60,
  META_DESC_MIN: 100,
  META_DESC_MAX: 155,
  INTERNAL_LINKS_GOOD: 2,
  READINESS_PUBLISH_QUALITY: 70,
  READINESS_PUBLISH_SEO: 70,
  READINESS_DRAFT_QUALITY: 50,
  READINESS_DRAFT_SEO: 50,
};
```

## Files to Create (8)

### 1. `src/lib/blogArticleAnalyzer.ts`
Central scoring engine (client-side, no API calls).

**Quality scoring** (0-100):
- Word count weight (>1200=full, <500=poor, <300=thin)
- Heading structure (H2s present, no skipped levels)
- Intro paragraph detection (text before first H2)
- Conclusion detection (last heading matches "conclusion"/"summary" patterns)
- FAQ presence (bonus)
- Internal links count (>=2=good)
- Metadata completeness (title, meta title, meta description, excerpt)
- Image readiness (cover image + alt text)
- Readability structure (paragraph length, lists)

Grade mapping: >=85 Excellent, >=70 Good, >=50 Needs Improvement, <50 Poor.

**SEO scoring** (checklist, pass/warn/fail per item):
- Title exists, meta title ≤60 chars, meta description 100-155 chars
- Slug clean, canonical correct
- Content >800 words, H1 exists, heading hierarchy valid
- FAQ schema eligible, image exists, alt text exists
- Internal links >=1, no duplicate slug conflict
- Keyword overlap (title vs body word Jaccard)

**Duplicate slug check**: accepts optional `excludePostId` parameter so editing an existing post doesn't falsely flag its own slug.

**Publish readiness**:
- Not Ready: missing title/slug/content
- Needs Review: quality < 50 OR SEO < 50 OR no cover
- Ready as Draft: quality >= 50, SEO >= 50
- Ready to Publish: quality >= 70, SEO >= 70, cover present, meta complete
- Published: `is_published = true`

### 2. `src/components/admin/blog/PublishReadinessBadge.tsx`
Color-coded badge: red (Not Ready), amber (Needs Review), blue (Ready as Draft), green (Ready to Publish / Published).

### 3. `src/components/admin/blog/BlogArticleReport.tsx`
Quality score display: progress bar, grade badge, factor-by-factor breakdown with explanation of why.

### 4. `src/components/admin/blog/BlogSEOChecklist.tsx`
SEO checklist: each check as pass (green ✓) / warn (yellow) / fail (red ✗) with label + total score.

### 5. `src/components/admin/blog/BlogAdminStats.tsx`
Stats cards at top of Blog tab querying `blog_posts`: total, drafts, published, missing meta, missing cover, low word count (<500), recently published (7 days).

### 6. `src/components/admin/blog/InternalLinkSuggester.tsx`
Recommendation-only component. Scans content for exam names, state names, job keywords. Suggests links to known routes. Shows current internal link count + sufficiency indicator. **No auto-insertion** — suggestions are displayed as copyable items. Admin decides whether to add them.

### 7. `supabase/functions/generate-blog-image/index.ts`
**Direct external Gemini 2.5 Flash API only.** No Lovable AI gateway.

- Admin-safe: validates JWT via `getClaims()`, then checks `has_role(userId, 'admin')` using a Supabase service-role client. Returns 403 if not admin.
- `GEMINI_API_KEY` from `Deno.env` (already configured).
- Calls `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with `responseModalities: ["TEXT", "IMAGE"]`.
- Prompt: safe editorial illustration prompt avoiding official symbols.
- Extracts base64 image, uploads to `blog-assets/covers/{slug}-generated.png` with `upsert: true`.
- Generates alt text from same response text part.
- Returns `{ imageUrl, altText, model: "gemini-2.5-flash" }`.
- Top-of-file comment: `// DIRECT GEMINI API — Does NOT use Lovable AI gateway`.
- Config: `verify_jwt = false` in `supabase/config.toml`.

### 8. `src/components/admin/blog/FeaturedImageGenerator.tsx`
Button + loading state. Calls `supabase.functions.invoke('generate-blog-image', ...)`. Shows "Regenerate" if image exists. Manual upload override always available (existing CoverImageUploader stays untouched). Label: "AI Generated via Gemini 2.5 Flash". Image generation is fully optional — never blocks save/publish workflow.

## Files to Modify (7)

### 1. `src/lib/blogParser.ts`
Extend `ParsedArticle` with:
- `headings: { level: number; text: string }[]`
- `tables: number`
- `externalLinks: { url: string; anchorText: string }[]`
- `hasIntro: boolean`
- `hasConclusion: boolean`
- `disclaimer: string | null`
- `keyHighlights: string[]`
- `excerpt: string`

Add extraction logic. Backward compatible — new fields have defaults.

### 2. `src/components/admin/BlogPostEditor.tsx`
Major upgrade:
- **Search input** filtering by title/slug
- **Draft/published filter** dropdown
- **Pagination** (20 per page, prev/next)
- **Table columns**: add word count, quality score badge, SEO score, cover image icon, updated time
- **Delete confirmation**: wrap delete in AlertDialog
- **Editor dialog**: add collapsible BlogArticleReport, BlogSEOChecklist, InternalLinkSuggester sections + FeaturedImageGenerator button next to CoverImageUploader + live word count + reading time + last-edited timestamp
- **Autosave**: debounced 5s for existing posts only
- **BlogAdminStats** rendered above table
- **Duplicate slug check** passes `editingPost?.id` as `excludePostId` so editing doesn't self-flag

### 3. `src/components/admin/BulkBlogUpload.tsx`
- **Save All as Draft**: persists to `blog_posts` with `is_published: false`, reports success/failure count
- Pass quality/SEO data to sub-components

### 4. `src/components/admin/bulk-blog/ArticleQueue.tsx`
- Show quality score badge (color-coded) per article
- Show SEO score badge per article
- Show PublishReadinessBadge

### 5. `src/components/admin/bulk-blog/ArticleEditPanel.tsx`
- Add collapsible BlogArticleReport, BlogSEOChecklist, InternalLinkSuggester sections
- Add FeaturedImageGenerator button in images section

### 6. `src/components/admin/bulk-blog/BulkPublishModal.tsx`
- Validation checks include quality >= 50 and SEO >= 50 (using `BLOG_THRESHOLDS`)
- Articles below threshold shown as "Needs Review" with explicit override option
- Aggregate quality/SEO stats in validation summary

### 7. `supabase/config.toml`
Add:
```toml
[functions.generate-blog-image]
verify_jwt = false
```

## Key Safety Points Addressed

1. **`generate-blog-image` is admin-safe**: `verify_jwt = false` but validates JWT + admin role in code
2. **Image generation is optional**: never blocks manual workflow, save, or publish
3. **Thresholds centralized**: all in `BLOG_THRESHOLDS` constant in `blogArticleAnalyzer.ts`
4. **Duplicate slug check excludes current post**: `excludePostId` parameter prevents self-flagging
5. **Internal link suggestions are recommendation-only**: no automatic insertion
6. **SEO rebuild compatibility**: no changes to existing triggers — uses same `blog_posts` table

## Implementation Order

1. `blogArticleAnalyzer.ts` + `BLOG_THRESHOLDS` (foundation)
2. `PublishReadinessBadge`, `BlogArticleReport`, `BlogSEOChecklist` (shared UI)
3. `blogParser.ts` upgrades (extended extraction)
4. `BlogAdminStats` (reporting)
5. `InternalLinkSuggester` (recommendations)
6. `generate-blog-image` edge function + `FeaturedImageGenerator` + config.toml
7. `BlogPostEditor` upgrade (search, pagination, scores, autosave, delete confirm)
8. `BulkBlogUpload` + sub-component upgrades (save as draft, validation)

