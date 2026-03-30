

# Remove `/insurance-advisor-jobs-` from Multi-Segment Prefix List

## Finding

All `/insurance-advisor-jobs-*` routes are single-segment:
- `/insurance-advisor-jobs-lucknow`
- `/insurance-advisor-jobs-uttar-pradesh`
- `/insurance-advisor-jobs-:citySlug` (catch-all in App.tsx)

None contain a second path segment. The `isLikelyValid()` helper already returns `true` for all single-segment paths (`segments.length <= 1`), so this entry in `KNOWN_MULTI_SEGMENT_PREFIXES` is unnecessary and incorrectly categorized.

## Change

**File:** `public/_worker.js`

Remove the `/insurance-advisor-jobs-` entry and its comment from `KNOWN_MULTI_SEGMENT_PREFIXES` when that constant is implemented. The final list should be:

```javascript
const KNOWN_MULTI_SEGMENT_PREFIXES = [
  '/jobs/',
  '/sarkari-jobs/',
  '/results/',
  '/sample-papers/',
  '/books/',
  '/previous-year-papers/',
  '/guides/',
  '/companies/',
  '/blog/',
  '/tools/',
];
```

10 entries, all genuinely multi-segment prefixes ending with `/`.

## Risk
Zero. These routes are already covered by the single-segment allowance in `isLikelyValid()`. Removing the entry only corrects a categorization error in the plan — no behavioral change.

