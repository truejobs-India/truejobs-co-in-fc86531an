

# Fix: Internal Links Always Skipped — "No valid internal link targets found"

## Root Cause

Two compounding issues cause every internal link fix to be skipped:

1. **The AI has no knowledge of real pages.** The edge function prompt tells the AI to return paths like `/path`, but provides zero actual slugs from the database. The AI hallucates URLs — either full URLs (`https://truejobs.co.in/blog/best-books-for-upsc`) or invented relative paths that may not exist.

2. **Full URLs are rejected by the validator.** `isValidInternalPagePath` blocks anything starting with `https:`. If the AI returns `https://truejobs.co.in/blog/some-slug`, `extractHrefsFromHtml` extracts it, then `isValidInternalPagePath` rejects it → 0 valid links → skip.

Both issues must be fixed for internal links to ever succeed.

## Plan

### Change 1: Supply real blog slugs to the edge function

**Files:** `src/hooks/useBulkAutoFix.ts` + `supabase/functions/analyze-blog-compliance-fixes/index.ts`

Before calling the edge function in `processOneArticle` (~line 885), fetch a pool of existing published blog slugs (excluding the current article) and pass them in the request body as `availableSlugs`.

In `useBulkAutoFix.ts` — fetch the slug pool once at the start of `executeAutoFix` (not per-article) and pass it through:

```typescript
// At start of executeAutoFix, fetch slug pool once
const { data: slugRows } = await supabase
  .from('blog_posts')
  .select('slug')
  .eq('is_published', true)
  .order('id', { ascending: true })
  .limit(500);
const availableSlugs = (slugRows || []).map(r => r.slug).filter(Boolean);
```

Pass `availableSlugs` into each `processOneArticle` call and include it in the edge function body.

In the edge function prompt (line 219), replace the generic instruction with:

```
- internal_links: fixType=internal_links, applyMode=append_content.
  Pick 3-6 links from the AVAILABLE SLUGS list below. Return as:
  <h3>Related Resources</h3><ul><li><a href="/blog/{slug}">anchor text</a></li></ul>
  ONLY use slugs from the provided list. Never invent URLs.
```

Add the slug list to the prompt context:

```
Available blog slugs for internal linking (pick relevant ones):
${availableSlugs.filter(s => s !== slug).slice(0, 200).map(s => `/blog/${s}`).join('\n')}
```

### Change 2: Normalize full URLs to relative paths before validation

**File:** `src/hooks/useBulkAutoFix.ts`, lines 700-710

Before calling `isValidInternalPagePath`, strip the TrueJobs domain if the AI returned a full URL despite instructions:

```typescript
for (let href of hrefs) {
  // Normalize full URLs to relative paths
  try {
    const parsed = new URL(href, 'https://truejobs.co.in');
    if (parsed.hostname === 'truejobs.co.in' || parsed.hostname.endsWith('.truejobs.co.in')) {
      href = parsed.pathname;
    }
  } catch {}

  if (!isValidInternalPagePath(href)) continue;
  if (linkAlreadyInContent(modifiedContent, href)) continue;
  if (validLinks.length >= MAX_AUTO_LINKS) break;
  // ... rest unchanged
}
```

### Change 3: Add debug logging for internal link validation

**File:** `src/hooks/useBulkAutoFix.ts`, before the `validLinks.length === 0` check at line 712

```typescript
if (validLinks.length === 0) {
  console.warn(`[BULK_AUTO_FIX] Internal links: ${hrefs.length} hrefs extracted, 0 passed validation. Raw hrefs:`, hrefs);
  fixesSkipped.push({ ... });
  continue;
}
```

## Summary of changes

| # | Change | File |
|---|--------|------|
| 1 | Fetch slug pool once in `executeAutoFix` | `src/hooks/useBulkAutoFix.ts` |
| 2 | Pass `availableSlugs` to edge function | `src/hooks/useBulkAutoFix.ts` |
| 3 | Add slug list to AI prompt | `supabase/functions/analyze-blog-compliance-fixes/index.ts` |
| 4 | Normalize full URLs → relative paths | `src/hooks/useBulkAutoFix.ts` (lines 700-710) |
| 5 | Debug log on zero valid links | `src/hooks/useBulkAutoFix.ts` (line 712) |

No analyzer changes. No scoring changes. No threshold changes.

