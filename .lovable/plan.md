

## Implementation Plan: Fix Policy Risk False Positives

### 1. Refine adult-content regex (`src/lib/blogComplianceAnalyzer.ts`, line 304)

Replace:
```js
const adultContent = /\b(porn|xxx|nude|naked|sex(?:ual|ting)?|escort|erotic|adult content)\b/i.test(plainText);
```
With:
```js
const adultContent = /\b(porn(?:ography)?|xxx|nude|naked|sexting|escort\s*service|erotic(?:a|ism)?|adult\s*content|adult\s*entertainment)\b/i.test(plainText);
```
This removes bare `sex`/`sexual` (which match "sexual harassment", "sex-based reservation") while retaining all explicitly adult terms.

### 2. Remove `ref=` from affiliate detection (line 367)

Change:
```js
/(?:utm_|ref=|affiliate|partner=|aff_id)/gi
```
To:
```js
/(?:utm_|affiliate|partner=|aff_id)/gi
```

### 3. Add temporary compliance debug logging

Add a debug helper at the top of `analyzeAdsenseCompliance` and log on `fail`-status checks only. Log: slug, rule key, matched snippet (truncated), stored `word_count`, live-computed `wordCount`. No full article bodies.

```js
// Temporary debug — log matched snippet for failed adsense-safety checks
const _debugSlug = metadata.slug || metadata.title?.substring(0, 40) || 'unknown';
function _logFail(key: string, matchSnippet: string | null, storedWC: number, liveWC: number) {
  console.warn(`[COMPLIANCE-DEBUG] slug="${_debugSlug}" rule="${key}" match="${matchSnippet?.substring(0, 80) || 'N/A'}" storedWC=${storedWC} liveWC=${liveWC}`);
}
```

Call `_logFail` after each check that results in `fail` status (thin-doorway, adult-content, illegal-content, dangerous-policy-risk, excessive-affiliates, link-density). Pass the regex match snippet (first match only, truncated) rather than the full body.

### 4. Save `word_count` in enrich-blog-articles edge function (line 134)

Add `word_count: wordCount` to the update payload:
```js
.update({
  content: expandedContent,
  faq_schema: faqSchema,
  reading_time: readingTime,
  word_count: wordCount,
  excerpt,
  updated_at: new Date().toISOString(),
})
```

### 5. One-time SQL backfill for `word_count` (via migration tool)

Single CASE-based statement that trims stripped content before splitting:
```sql
UPDATE blog_posts
SET word_count = CASE
  WHEN content IS NULL OR length(trim(regexp_replace(coalesce(content, ''), '<[^>]+>', ' ', 'g'))) = 0
    THEN 0
  ELSE array_length(
    regexp_split_to_array(
      trim(regexp_replace(content, '<[^>]+>', ' ', 'g')),
      '\s+'
    ),
    1
  )
END;
```

### Files Changed

| File | Change |
|------|--------|
| `src/lib/blogComplianceAnalyzer.ts` | Refine adult regex, remove `ref=`, add temporary debug logging |
| `supabase/functions/enrich-blog-articles/index.ts` | Add `word_count` to update payload |
| SQL migration | CASE-based `word_count` backfill |

