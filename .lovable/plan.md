

## Plan: Keep published drafts visible + add live-page link icon

### Diagnosis
Verified in DB: the 2 published drafts (Federal Bank, NGEL) still exist in `intake_drafts` with `source_channel='chatgpt_agent'`, `section_bucket='job_postings'`, `processing_status='published'`. The `fetchDrafts` query has NO filter that excludes published rows, and the row renderer already has a "Published" badge branch (line 706).

So the disappearance is almost certainly because the user is looking at a different section tab (e.g. "Results" / "Exams") while both published rows live in the **Job Postings** bucket. We'll keep current behavior (published rows already persist) but make this discoverability issue impossible by:

1. Adding a small **"Show published"** filter chip alongside the existing All / With Link / Missing Link chips, defaulting to ON, with a count like `Published (2)`. Clicking it filters to only published rows in the current section. This makes published drafts findable in one click regardless of which tab they're in.
2. Adding a tab-level published-count badge so each section tab shows e.g. `Job Postings (24 · 2 published)`.

### Add live page hyperlink icon
For every row where `processing_status === 'published'`, render a new icon button (`ExternalLink` from lucide-react) in the actions cell that opens the live URL in a new tab.

URL resolution by `publish_target` + `slug` (using existing values already on the row):
- `jobs` → `/jobs/{slug}`
- `results` → `/results/{slug}`
- `admit_cards` → `/admit-cards/{slug}`
- `answer_keys` → `/answer-keys/{slug}`
- `exams` → `/exams/{slug}`
- `notifications` → `/notifications/{slug}`
- `scholarships` → `/scholarships/{slug}`
- `certificates` → `/certificates/{slug}`
- `marksheets` → `/marksheets/{slug}`

Helper:
```ts
const buildLiveUrl = (d: any): string | null => {
  if (!d?.slug || !d?.publish_target || d.publish_target === 'none') return null;
  const map: Record<string,string> = {
    jobs:'/jobs', results:'/results', admit_cards:'/admit-cards',
    answer_keys:'/answer-keys', exams:'/exams', notifications:'/notifications',
    scholarships:'/scholarships', certificates:'/certificates', marksheets:'/marksheets',
  };
  const base = map[d.publish_target];
  return base ? `${base}/${d.slug}` : null;
};
```

Button (only shown when `processing_status === 'published'` AND URL resolves):
```tsx
{d.processing_status === 'published' && buildLiveUrl(d) && (
  <Button size="sm" variant="ghost" title="Open live page"
    onClick={() => window.open(buildLiveUrl(d)!, '_blank', 'noopener,noreferrer')}>
    <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
  </Button>
)}
```

### Files touched (1 file)
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`
  - Add `ExternalLink` to lucide imports.
  - Add `buildLiveUrl` helper.
  - Extend `LinkFilter` type with `'published'` and add the published filter chip with count.
  - Update `filteredDrafts` to honor the new chip.
  - Add the live-link icon button in row actions.
  - Optional: append `· N published` to each section tab label using `sectionCounts` (a second lightweight count query per section for `processing_status='published'`).

### Deliberately not changed
- `fetchDrafts` query — already correct (no published exclusion).
- `intake-publish` edge function — DB state is already correct.
- DB schema, RLS, edge functions.
- Existing publish/unpublish flow.

### Risk
None. Pure additive UI.

