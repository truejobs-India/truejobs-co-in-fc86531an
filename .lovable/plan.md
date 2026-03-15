

# Implementation Plan: Production-Grade Enrich Workflow Fix

## Root Causes (confirmed from code audit)

1. **Prompt never requests specific missing elements** — `enrich-article` action in the edge function uses a generic "expand and improve" prompt. It never tells the model "add a conclusion", "add FAQs", etc.
2. **`internal_links` DB field never updated** — enrichment saves content but never extracts `<a>` tags to update the `internal_links` JSONB field.
3. **FAQ detection too narrow** — only counts `<strong>?</strong>` patterns; misses `<h3>?` and `<dt>` formats.
4. **Conclusion detection too narrow** — only checks last heading for a few keywords; ignores closing paragraph blocks.
5. **FAQ is universally required** — even for categories like "Resume" or "Interview" where FAQs may not be natural.
6. **No Pass 2 escalation** — no retry with a stronger model for articles that remain pending.
7. **No full-rebuild mode** — stub articles (<500 words) get the same "expand" prompt as 3000-word articles.

## Changes by File

### 1. `supabase/functions/improve-blog-content/index.ts`

**A. Accept `failingCriteria` and `isStubRebuild` in request body**

Add to destructured fields: `failingCriteria` (string array), `isStubRebuild` (boolean).

**B. Build criteria-specific prompt instructions**

Map each failing criterion string to a concrete instruction block:
- `"Missing conclusion"` → "ADD a conclusion section: `<h2>Conclusion</h2>` or `<h2>निष्कर्ष</h2>` followed by 2-3 summary sentences"
- `"No FAQs"` → "ADD a FAQ section with at least 3 Q&A items. Format: `<h2>FAQ</h2>` then `<p><strong>Question?</strong></p><p>Answer.</p>` for each"
- `"Missing intro"` → "ADD an introduction paragraph (2-3 sentences) BEFORE the first H2 heading, in `<p>` tags"
- `"H2 headings"` → "ENSURE at least 4 H2 headings structuring the article into clear sections"
- `"Word count"` → "Expand content to at least 1200 words with substantive depth"
- `"No internal links"` → "Where contextually relevant, add 2-3 internal links using `<a href=\"/relevant-path\">anchor text</a>`"

Append these as a `SPECIFIC REQUIREMENTS` block in the prompt.

**C. Full-rebuild mode for stub articles**

When `isStubRebuild` is true, use a different prompt:
- "Write a comprehensive, well-structured article on this topic"
- Pass existing content as "context and outline to preserve topic intent"
- Explicit instruction: "Preserve the topic, angle, and any surviving factual content. Do NOT invent specific statistics, dates, or official details. Do NOT change the article's subject."
- Do NOT touch slug/title/metadata (handled client-side by not including them in the update payload — already the case)

**D. No other changes** — model resolution, token scaling, truncation detection all stay as-is.

### 2. `src/hooks/useBulkBlogWorkflow.ts`

**A. Pass failing criteria to edge function** (in `executeEnrichForArticle`, ~line 1307)

Before calling `improve-blog-content`:
```
const preReadiness = checkEnrichReadiness(post);
const isStubRebuild = preWordCount < 500;
```
Pass `failingCriteria: preReadiness.failing` and `isStubRebuild` in the request body.

**B. Move internal-link extraction into the update step** (~line 1367-1377)

After enrichment, extract `<a href>` tags from `newContent` using DOMParser, filter for internal paths (starting with `/` or containing `truejobs.co.in`), and write to `updatePayload.internal_links`. This ensures the DB field is always synced with actual content.

**C. Broaden FAQ detection** (~line 1344-1362)

Also count:
- `<h3>` tags ending with `?` (length > 10)
- `<dt>` tags (definition list items)

**D. Make FAQ requirement topic-aware in `checkEnrichReadiness`** (~line 161-172)

Accept optional `category` parameter. Only require FAQs for categories where they're natural: `'Sarkari Naukri Basics'`, `'Exam Preparation'`, `'Career Advice'`, `'Job Search'`. For other categories (`'Resume'`, `'Interview'`, `'AI in Recruitment'`, `'Hiring Trends'`, `'HR & Recruitment'`, `'Results & Admit Cards'`), treat FAQ as a bonus (don't fail on it).

**E. Pass 2 escalation with stable ID tracking** (after the main loop ~line 1041)

After the main loop completes for `wfType === 'enrich'`:
1. Collect articles from `executionResults` where status is `'still_pending'` or `'partially_improved'`, matched by `slug` (stable identifier, not array index).
2. For each, re-fetch the post from DB by slug, re-run `executeEnrichForArticle` with model `'gemini-2.5-pro'`.
3. Update progress to show "Pass 2 (Pro model)" in `current_title`.
4. Update counters and persist results.

Track via a `Map<string, ArticleVerdict>` keyed by slug so stop/skip/deferred cases never corrupt the retry set.

**F. Stub article guardrails**

For `isStubRebuild` articles, the `executeEnrichForArticle` function:
- Sets `isStubRebuild: true` in the edge function call
- Does NOT update `slug`, `title`, `meta_title`, `meta_description`, or any metadata fields — only `content`, `word_count`, `reading_time`, `faq_count`, `has_faq_schema`, `internal_links`
- Keeps the existing shrinkage guard (reject if <80% of original), though for stubs this threshold is lenient enough to allow a full rebuild from 200 to 1500 words

### 3. `src/lib/blogArticleAnalyzer.ts`

**A. Expand `detectConclusion`** (~line 393)

Two detection paths:
1. **Heading-based**: Check last 2 headings (not just last) for expanded keyword list: `conclusion|summary|final\s*thoughts|key\s*takeaway|wrap|in\s*short|closing|last\s*word|निष्कर्ष|सारांश|अंतिम|महत्वपूर्ण\s*बातें`
2. **Paragraph-based**: If no conclusion heading found, check if the last `<p>` block in the content (after the last heading) is ≥50 chars — count it as a closing paragraph. This handles articles that end with a substantive paragraph rather than a labeled conclusion.

### 4. `src/components/admin/blog/BulkWorkflowPanel.tsx`

**A. Enhanced completion report**

When workflow completes for enrich type, show:
- Average word-count delta (from execution results)
- Count of Pass 2 escalations
- Top 3 most common still-failing criteria
- Count of stub rebuilds attempted

No structural changes to the panel layout — just richer text in the completion summary area.

## Alignment Summary

```text
CRITERIA               BEFORE                         AFTER
────────────────────   ─────────────────────────────   ──────────────────────────────
Conclusion required    Only heading keyword match      Heading keywords + closing paragraph detection
FAQ required           Universal for all articles      Topic-aware (only for relevant categories)
FAQ detection          Only <strong>? counted          Also <h3>? and <dt> elements
Internal links         DB field never updated          Extracted from content on every save
Prompt specificity     Generic "expand" prompt         Criteria-specific instructions per article
Stub articles          Same prompt as large articles   Full-rebuild mode with topic preservation
Model escalation       None                           Pass 2 with gemini-2.5-pro for pending
Retry tracking         N/A                            By slug (stable ID), not array index
Metadata safety        Could overwrite                 Stubs: only content fields updated
```

## Files to Change

| File | Nature |
|------|--------|
| `supabase/functions/improve-blog-content/index.ts` | Criteria-specific prompt + full-rebuild mode |
| `src/hooks/useBulkBlogWorkflow.ts` | Pass criteria, link sync, broader FAQ detection, topic-aware readiness, Pass 2 escalation |
| `src/lib/blogArticleAnalyzer.ts` | Expanded conclusion detection (heading + paragraph) |
| `src/components/admin/blog/BulkWorkflowPanel.tsx` | Richer completion stats |

