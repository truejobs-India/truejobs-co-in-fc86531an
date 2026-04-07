

# Long Tail SEO Pages — Full Implementation Plan

## Architecture Summary

The existing blog system uses:
- **`blog_posts`** table (35+ columns) for storage
- **`BlogPostEditor.tsx`** (2582 lines) as the monolithic admin component with "Create Articles in Bulk" collapsible section
- **`generate-blog-article`** edge function (960 lines) with multi-model AI dispatch
- **`BlogPost.tsx`** (629 lines) for frontend rendering
- SEO cache triggers via `queue_seo_rebuild` function on `blog_posts` changes
- Sitemap via `sitemap-blog.xml` generator

**Strategy**: Extend `blog_posts` with new columns for long-tail metadata. Build a **separate component** (`LongTailSeoPanel.tsx`) rendered inside `BlogPostEditor.tsx`. Extend the edge function with a `contentMode` parameter for template-aware prompts. Add a distinct frontend rendering path for long-tail pages.

---

## Phase 1: Database Migration

Add columns to `blog_posts`:

```sql
ALTER TABLE blog_posts
  ADD COLUMN content_mode text NOT NULL DEFAULT 'article',
  ADD COLUMN page_template text,
  ADD COLUMN primary_keyword text,
  ADD COLUMN secondary_keywords text[] DEFAULT '{}',
  ADD COLUMN search_intent text,
  ADD COLUMN target_exam text,
  ADD COLUMN target_state text,
  ADD COLUMN target_department text,
  ADD COLUMN target_category text,
  ADD COLUMN target_language text,
  ADD COLUMN target_year text,
  ADD COLUMN duplicate_risk_score integer DEFAULT 0,
  ADD COLUMN duplicate_risk_reason text,
  ADD COLUMN thin_content_risk boolean DEFAULT false,
  ADD COLUMN thin_content_reason text,
  ADD COLUMN fact_confidence text DEFAULT 'unknown',
  ADD COLUMN official_source_url text,
  ADD COLUMN official_source_label text,
  ADD COLUMN source_evidence jsonb DEFAULT '{}',
  ADD COLUMN last_verified_at timestamptz,
  ADD COLUMN stale_after timestamptz,
  ADD COLUMN needs_revalidation boolean DEFAULT false,
  ADD COLUMN review_status text DEFAULT 'none',
  ADD COLUMN long_tail_metadata jsonb DEFAULT '{}',
  ADD COLUMN noindex boolean DEFAULT false;

CREATE INDEX idx_blog_posts_content_mode ON blog_posts (content_mode);
CREATE INDEX idx_blog_posts_page_template ON blog_posts (page_template) WHERE page_template IS NOT NULL;
CREATE INDEX idx_blog_posts_primary_keyword ON blog_posts (primary_keyword) WHERE primary_keyword IS NOT NULL;
CREATE INDEX idx_blog_posts_needs_revalidation ON blog_posts (needs_revalidation) WHERE needs_revalidation = true;
CREATE INDEX idx_blog_posts_review_status ON blog_posts (review_status) WHERE review_status != 'none';
CREATE INDEX idx_blog_posts_stale_after ON blog_posts (stale_after) WHERE stale_after IS NOT NULL;
CREATE INDEX idx_blog_posts_noindex ON blog_posts (noindex) WHERE noindex = true;
```

All existing queries continue to work because `content_mode` defaults to `'article'` and all new columns are nullable or have safe defaults.

---

## Phase 2: Template System

**New file: `src/lib/longTailTemplates.ts`** (~300 lines)

Defines 17 template types with mandatory sections, prompt instructions, and quality check rules:

```typescript
export const LONG_TAIL_TEMPLATES = {
  'age-limit': {
    label: 'Age Limit',
    mandatorySections: ['quick-answer', 'summary-table', 'official-rules', 'category-breakdown', 'relaxation', 'confusion-points', 'faq', 'related-links'],
    promptInstructions: 'Start with the direct age limit answer. Include a category-wise table...',
    minWordCount: 800,
    faqTopics: ['category relaxation', 'age proof documents', 'exceptions'],
  },
  'salary': { ... },
  'eligibility': { ... },
  // ... 14 more templates
};
```

Each template maps to:
- Mandatory HTML section patterns for quality checking
- Template-specific prompt instructions injected into AI generation
- Minimum word count thresholds
- FAQ topic guidance
- Internal link category suggestions

**New file: `src/lib/longTailKeywordNorm.ts`** (~80 lines)

```typescript
// Stop words, year stripping, token sorting for semantic dedup
export function normalizeKeyword(kw: string): string { ... }

// Structured similarity using template + exam + state + keyword overlap
export function structuredSimilarity(a: TopicInput, b: TopicInput): number { ... }

// Check against existing blog_posts for overlap
export function findDuplicates(topic: TopicInput, existing: ExistingPage[]): DuplicateMatch[] { ... }
```

Unlike simple token sorting, this uses **structured comparison** across `page_template`, `target_exam`, `target_state`, `target_department`, normalized keyword, and slug — so "ssc gd age limit" and "age limit for ssc gd" collapse correctly, but "ssc gd age limit" and "ssc gd salary" don't.

---

## Phase 3: Admin Panel Component

**New file: `src/components/admin/blog/LongTailSeoPanel.tsx`** (~900 lines)

A self-contained collapsible panel rendered inside `BlogPostEditor.tsx` alongside the existing "Create Articles in Bulk" section. Reuses the same patterns:

### UI Layout
```
┌────────────────────────────────────────────────────┐
│ ▼ Long Tail SEO Pages                              │
│                                                    │
│ ┌──────────────────────────────────────────────┐   │
│ │ Template: [age-limit ▾]  Exam: [SSC CGL    ]│   │
│ │ State: [optional    ]  Dept: [optional     ] │   │
│ │ Year: [2026 ]  Source URL: [optional       ] │   │
│ └──────────────────────────────────────────────┘   │
│                                                    │
│ Keywords (one per line, max 50):                   │
│ ┌──────────────────────────────────────────────┐   │
│ │ ssc cgl age limit for obc                    │   │
│ │ ssc cgl age limit for sc st                  │   │
│ │ ssc cgl age limit for female                 │   │
│ └──────────────────────────────────────────────┘   │
│ 3 / 50 topics                                      │
│                                                    │
│ [Check Duplicates] [Remove Duplicates (1)]         │
│ ⚠ "ssc cgl age limit for obc" overlaps with       │
│   existing: "SSC CGL Age Limit 2025" (87%)         │
│                                                    │
│ Words: [1200]  Lang: [Auto]  Model: [Gemini Flash] │
│                                                    │
│ [Generate Pages] [Stop] [Retry Failed]             │
│                                                    │
│ Results:                                           │
│ ✓ ssc cgl age limit for obc    ⚠Thin  [Open]      │
│ ✓ ssc cgl age limit for sc st  ✓OK    [Open]      │
│ ✗ ssc cgl age limit for female         [Retry]     │
└────────────────────────────────────────────────────┘
```

### Reused from existing bulk engine:
- `AiModelSelector` component
- Word count presets and custom input
- Output language selector
- Abort/Stop/Retry pattern
- Status badges (queued/generating/success/failed)
- Toast notifications
- Auth session checks
- Duplicate checker UI pattern (enhanced)

### New capabilities:
1. **Template selector** — dropdown with 17 types + "Auto-detect"
2. **Structured metadata inputs** — exam, state, department, year, source URL
3. **Enhanced duplicate detection** — uses `structuredSimilarity()` against existing `blog_posts` where `content_mode = 'long_tail_seo'` AND regular articles
4. **Cross-topic batch dedup** — warns if two topics in the same batch normalize identically
5. **Post-generation quality gates** — scans generated HTML for template-required sections
6. **Thin-content badge** — per-result indicator
7. **Duplicate risk badge** — per-result indicator
8. **Fact confidence indicator** — shows if source URL was provided

### Insert behavior:
```typescript
await supabase.from('blog_posts').insert({
  title: data.title,
  slug: data.slug,
  content: data.content,
  content_mode: 'long_tail_seo',
  page_template: selectedTemplate,
  primary_keyword: topic,
  secondary_keywords: secondaryVariants,
  search_intent: detectedIntent,
  target_exam: examInput || null,
  target_state: stateInput || null,
  target_department: deptInput || null,
  target_year: yearInput || null,
  official_source_url: sourceUrl || null,
  fact_confidence: sourceUrl ? 'source_provided' : 'ai_inferred',
  duplicate_risk_score: computedDupScore,
  duplicate_risk_reason: dupReason || null,
  thin_content_risk: !passesQualityGate,
  thin_content_reason: qualityFailReason || null,
  noindex: !passesQualityGate || computedDupScore > 70,
  review_status: 'pending',
  is_published: false,
  // ... standard fields (excerpt, meta_title, etc.)
});
```

---

## Phase 4: Edge Function Extension

**Modified: `supabase/functions/generate-blog-article/index.ts`**

Add ~200 lines. Accept new request body fields:
- `contentMode`: `'article'` | `'long_tail_seo'` (default: `'article'`)
- `pageTemplate`: template type string
- `primaryKeyword`: string
- `searchIntent`: string
- `targetExam`, `targetState`, `targetDepartment`, `targetYear`: optional context

When `contentMode === 'long_tail_seo'`:

1. Import template definitions from a `LONG_TAIL_PROMPT_TEMPLATES` map built inline in the function
2. Build template-specific system prompt that enforces:
   - Answer-first opening (no editorial intro)
   - Mandatory sections per template type
   - Table requirements where applicable
   - Factual tone, not bloggy
   - Hindi/English language rules (reused from existing)
3. Generate with the same `callAI()` dispatcher — no model routing changes needed
4. Return same JSON shape plus `contentMode` and `pageTemplate` in response

The existing article flow is completely untouched — the `contentMode` parameter defaults to `'article'` so all current calls work identically.

---

## Phase 5: Quality Gates

**New file: `src/lib/longTailQualityGates.ts`** (~150 lines)

```typescript
export interface QualityGateResult {
  passed: boolean;
  score: number;       // 0-100
  checks: QualityCheck[];
  reason: string | null;
}

export function runQualityGates(
  content: string,
  template: string,
  metadata: { officialSourceUrl?: string; wordCount: number }
): QualityGateResult { ... }
```

Checks:
1. Quick answer exists (checks for early `<p>` or `<strong>` answer within first 200 chars)
2. Template-required sections present (H2/H3 heading pattern matching per template)
3. Summary table present where required (checks for `<table>` tag)
4. FAQ section present (checks for FAQ heading + Q&A structure)
5. Word count meets template minimum
6. Content is not excessively repetitive (simple n-gram check)
7. Internal links present (checks for `<a>` tags or link suggestions)
8. Source grounding status (is `official_source_url` provided for factual templates?)

Results are used to set `thin_content_risk`, `thin_content_reason`, and `noindex` on insert.

---

## Phase 6: Freshness Management

Built into the panel and table filter. No separate component needed.

- On insert: if `target_year` is provided, auto-set `stale_after` to end of that year
- On insert: if template is time-sensitive (dates, admit-card, result), auto-set `stale_after` to 90 days from creation
- Admin filters include "Stale" and "Needs Revalidation" options
- Badge in table row shows freshness state (Fresh / Stale / Needs Review)
- Publish gate warns if `stale_after < now()` or `needs_revalidation = true`

---

## Phase 7: Frontend Rendering

**Modified: `src/pages/blog/BlogPost.tsx`** (~80 lines added)

After fetching the post, detect `content_mode === 'long_tail_seo'` and render with enhanced layout:

1. **Quick Answer Box** — extract first `<p>` or dedicated quick-answer section, render in a highlighted card at top
2. **Key Facts Table** — if `<table>` exists in first 500 chars of content, render it prominently
3. **Source Badge** — if `official_source_url` exists, show "Source: [label]" badge with link
4. **Stronger section hierarchy** — apply CSS class `long-tail-content` with:
   - Larger H2 styling with border-bottom
   - Tighter paragraph spacing
   - Table styling optimized for data display
   - Related Pages block at bottom
5. **Related Pages block** — query 3-5 other `long_tail_seo` posts with same `target_exam` or `page_template`, render as linked cards

Existing article rendering is completely unchanged — the `content_mode` check only activates for long-tail pages.

---

## Phase 8: Indexing and Sitemap Control

### Noindex logic (in `BlogPost.tsx` SEO component):
```typescript
const shouldNoindex = post.noindex || 
  (!post.is_published) ||
  (post.thin_content_risk && post.content_mode === 'long_tail_seo') ||
  (post.duplicate_risk_score > 70 && post.content_mode === 'long_tail_seo');
```

### Sitemap exclusion:
**Modified: `supabase/functions/dynamic-sitemap/index.ts`** or the sitemap-blog generator — add filter:
```sql
WHERE is_published = true AND (noindex IS NULL OR noindex = false)
```

This ensures draft, thin, duplicate-risk, or explicitly noindexed pages never appear in sitemap.

### SEO cache:
The existing `queue_seo_rebuild` trigger fires on `blog_posts` changes, so long-tail pages automatically get SEO cache entries when published. No trigger changes needed.

---

## Phase 9: Admin Table Filters

**Modified: `BlogPostEditor.tsx`** (~40 lines)

Add to status filter dropdown:
```
All Posts | Published | Drafts | Long Tail SEO
```

When "Long Tail SEO" selected, filter by `content_mode = 'long_tail_seo'`.

Add visual indicators in table rows for long-tail pages:
- Template badge (e.g., "age-limit", "salary")
- Duplicate risk icon if score > 50
- Thin content warning icon
- Freshness badge (Fresh/Stale)
- Fact confidence indicator
- Noindex badge if set

---

## Phase 10: Internal Linking Enhancement

**Modified: `src/components/admin/blog/InternalLinkSuggester.tsx`** (~40 lines added)

When `contentMode === 'long_tail_seo'` and `pageTemplate` is provided:
- Add template-specific link target suggestions (salary pages → eligibility pages, exam pattern → syllabus, etc.)
- Suggest links to same-exam hub pages
- Suggest links to same-state pages
- Query existing long-tail pages with matching `target_exam` for cluster linking

---

## Files Changed Summary

| File | Change Type | Lines Added |
|---|---|---|
| **New: `src/lib/longTailTemplates.ts`** | Template definitions, prompt builders | ~300 |
| **New: `src/lib/longTailKeywordNorm.ts`** | Keyword normalization, structured similarity | ~80 |
| **New: `src/lib/longTailQualityGates.ts`** | Quality gate checks | ~150 |
| **New: `src/components/admin/blog/LongTailSeoPanel.tsx`** | Main admin panel | ~900 |
| `src/components/admin/BlogPostEditor.tsx` | Import panel, add filter, add badges | ~50 |
| `supabase/functions/generate-blog-article/index.ts` | Template-aware prompts for long-tail mode | ~200 |
| `src/pages/blog/BlogPost.tsx` | Enhanced rendering for long-tail pages | ~80 |
| `src/components/admin/blog/InternalLinkSuggester.tsx` | Template-aware link mappings | ~40 |
| **Migration SQL** | Add 23 columns + 7 indexes | ~40 |

**Total new code**: ~1,850 lines across 4 new files + 5 modified files

---

## What Gets Reused vs. What's New

### Reused:
- `blog_posts` table (extended, not replaced)
- `generate-blog-article` edge function (extended)
- `AiModelSelector` component
- Word count presets + custom input
- Output language selector
- Abort/Stop/Retry patterns
- Status badge patterns
- Toast notifications
- Auth/session checks
- Publish workflow (`is_published` toggle)
- SEO cache trigger (automatic)
- Sitemap generator (filtered)
- Compliance tools, enrichment tools, FAQ tools (work on all blog_posts)
- Internal link suggester (extended)
- Blog frontend rendering (extended)
- Duplicate checker UI pattern (enhanced)

### New:
- 17 template types with mandatory sections
- Structured keyword normalization + multi-field similarity
- Template-specific AI prompts (answer-first, table-heavy)
- Quality gates with structured section verification
- Fact confidence and source grounding fields
- Freshness/staleness management
- Explicit noindex control
- Enhanced frontend rendering for long-tail pages
- Admin table filters and badges for long-tail management

---

## Duplicate Prevention — How It Works

1. **Pre-generation**: For each input topic, compute `structuredSimilarity()` against all existing `blog_posts` using normalized keyword + template + exam + state + department. Similarity >= 0.75 flags as duplicate risk.
2. **Cross-batch**: Topics within the same batch are compared against each other. Identical normalized keywords are warned.
3. **Post-generation**: Before insert, check slug uniqueness. If slug overlaps with existing, append numeric suffix but flag `duplicate_risk_score`.
4. **Publish gate**: Pages with `duplicate_risk_score > 70` default to `noindex = true` and show warning on publish attempt. Admin can override.

---

## Safety and Backward Compatibility

- All new columns have defaults → existing queries unaffected
- `content_mode` defaults to `'article'` → all 400+ existing posts unchanged
- Edge function accepts `contentMode` parameter but defaults to existing behavior when omitted
- Frontend rendering only activates enhanced layout when `content_mode === 'long_tail_seo'`
- No routes, redirects, or existing admin sections are modified
- No existing bulk article generation code is touched
- Sitemap filter is additive (adds `noindex` check) — existing published posts unaffected since `noindex` defaults to `false`

---

## Implementation Order

1. Database migration (columns + indexes)
2. `longTailTemplates.ts` — template definitions
3. `longTailKeywordNorm.ts` — normalization and similarity
4. `longTailQualityGates.ts` — quality checks
5. Edge function extension — template-aware prompts
6. `LongTailSeoPanel.tsx` — admin panel
7. `BlogPostEditor.tsx` — integrate panel + table filters
8. `BlogPost.tsx` — frontend rendering enhancements
9. `InternalLinkSuggester.tsx` — template-aware links
10. Sitemap filter update

