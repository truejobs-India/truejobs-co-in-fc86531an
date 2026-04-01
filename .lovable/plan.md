

# Duplicate Reconciliation v1 — Simplest Safe Version

## Current State
- `IntakeCsvUploader.tsx` (lines 264-326) already fetches draft URLs and title+domain sets before import
- Exact URL duplicates against drafts are skipped (line 309-312)
- Title+domain near-matches against drafts are tagged `duplicate_risk` (line 316-319)
- `isLowConfidence()` in `IntakeDraftsManager.tsx` already routes `duplicate_risk` tagged rows to Low Confidence
- **No checking against published tables at all**

## What v1 Adds

### File 1: `IntakeCsvUploader.tsx`

**Before the import loop (after line 272), fetch published URLs:**

```
employment_news_jobs → select apply_link
govt_exams → select apply_link, official_notification_url
```

Build a `publishedUrlSet` of all non-null normalized URLs.

**Also fetch published identifiers for conservative near-matching:**

```
employment_news_jobs → select post, org_name
govt_exams → select exam_name, conducting_body
```

Build a `publishedIdentifierSet` using exact normalized concatenation: `normalizeTitle(post||exam_name) + "||" + normalizeTitle(org_name||conducting_body)`. This is strict — only exact normalized matches count.

**In the import loop, after existing draft URL check (line 309):**

1. If `source_url` matches `publishedUrlSet` → skip row, increment `skippedPublishedDupes`
2. After existing draft title+domain check (line 316), also check incoming title against `publishedIdentifierSet` using exact normalized match. If matched → add `published_duplicate_risk` tag

**Matching approach (conservative, per user's guard):**
- URL matching: exact normalized only
- Identifier matching: exact normalized `post/exam_name + org/body` concatenation only
- No fuzzy matching, no substring matching, no similarity scoring

**Update `ImportSummary`:** Add `skippedPublishedDupes: number`. Show in summary card.

### File 2: `IntakeDraftsManager.tsx`

**In `isLowConfidence()` (line 62-83):** Add `if (tags.includes('published_duplicate_risk')) return true;`

**In row rendering:** Add an amber "Possible Published Duplicate" badge when `published_duplicate_risk` tag is present.

### No schema changes needed
Uses existing `secondary_tags` array. No migration.

### No merge logic
Near-matches go to Low Confidence for manual review. No auto-merging.

## Decision Matrix

| Condition | Action |
|-----------|--------|
| Exact URL in drafts | Skip (existing) |
| Exact URL in published | Skip (new) |
| Title+domain match in drafts | Tag `duplicate_risk` → Low Confidence (existing) |
| Exact identifier match in published | Tag `published_duplicate_risk` → Low Confidence (new) |
| No match | Ready Draft (unchanged) |

## Files Changed

| File | Changes |
|------|---------|
| `IntakeCsvUploader.tsx` | Fetch published URLs + identifiers, skip published URL dupes, tag exact published identifier matches, update summary |
| `IntakeDraftsManager.tsx` | Route `published_duplicate_risk` to Low Confidence, add amber badge |

