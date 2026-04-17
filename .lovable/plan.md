

## Root cause

Two bugs in `buildLiveUrl` inside `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`:

1. **Wrong origin** — `window.open('/jobs/...')` uses the current preview origin (`...lovableproject.com`), not production. Live site is `https://truejobs.co.in`.
2. **Wrong path** — the map says `jobs → /jobs/{slug}`, but `intake-publish` actually inserts `publish_target='jobs'` rows into the **`employment_news_jobs`** table, whose public route is `/jobs/employment-news/:slug`. So `/jobs/{slug}` 404s even on production.

### Verification (already done)

- Both published drafts exist in `employment_news_jobs` with `status='published'`.
- `https://truejobs.co.in/jobs/employment-news/federal-bank-sales-professionals-recruitment-2026` → **HTTP 200**, `<title>Federal Bank Sales Professionals Recruitment 2026 | TrueJobs</title>` ✅
- `https://truejobs.co.in/jobs/employment-news/ngel-deputy-general-manager-asst-manager-recruitment-2026` → **HTTP 200** ✅
- `https://truejobs.co.in/jobs/{slug}` (current broken behavior) → **HTTP 404** ✗

## Fix

Single file: `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

1. Add a constant `LIVE_SITE_ORIGIN = 'https://truejobs.co.in'`.
2. Drive the URL off **`published_table_name`** (set by `intake-publish`), not the loosely-named `publish_target`. This is the source of truth for where the row actually landed. Fall back to `publish_target` only when `published_table_name` is missing.
3. Correct mapping based on real routes in `src/App.tsx`:

   | published_table_name | path prefix |
   |---|---|
   | `employment_news_jobs` | `/jobs/employment-news` |
   | `govt_exams` | `/sarkari-jobs` |
   | `govt_results` | `/sarkari-jobs` |
   | `govt_admit_cards` | `/sarkari-jobs` |
   | `govt_answer_keys` | `/sarkari-jobs` |

   (All `govt_*` content is rendered via `/sarkari-jobs/:slug` → `GovtExamDetail`, which is the existing live convention.)

4. Build the absolute URL: `${LIVE_SITE_ORIGIN}${prefix}/${slug}`.
5. Keep the icon button visible only when `processing_status === 'published'` and the URL resolves.

```ts
const LIVE_SITE_ORIGIN = 'https://truejobs.co.in';
const TABLE_TO_PATH: Record<string, string> = {
  employment_news_jobs: '/jobs/employment-news',
  govt_exams: '/sarkari-jobs',
  govt_results: '/sarkari-jobs',
  govt_admit_cards: '/sarkari-jobs',
  govt_answer_keys: '/sarkari-jobs',
};
const buildLiveUrl = (d: any): string | null => {
  if (!d?.slug) return null;
  const prefix = TABLE_TO_PATH[d.published_table_name];
  if (!prefix) return null;
  return `${LIVE_SITE_ORIGIN}${prefix}/${d.slug}`;
};
```

6. Ensure `fetchDrafts` selects `published_table_name` (audit the existing select; if missing, add it).

## Out of scope / not changed

- `intake-publish` edge function, DB schema, RLS — untouched.
- Preview/edit dialogs — untouched.
- Filter chips and section count badges — untouched.

## Risk

None. Pure UI correction. If `published_table_name` is unmapped (rare), the live-link icon is simply hidden — no broken link is shown.

