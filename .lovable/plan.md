

# Revised Plan: Public Notifications Section

This is the same approved plan with one added guard for Phase 2 detail page rendering.

## All Previous Phases — Unchanged

Phases 1–5 from the approved plan remain exactly as specified:
- Route notification drafts into `employment_news_jobs` with `job_category = 'Notification'`
- New `/notifications` listing page
- Homepage entries in InfoCardsRow and QuickAccessBar
- Quality gate in `intake-publish`
- No new DB table, no new detail page component

## Added Guard: Context-Aware Labels on Detail Page

### File: `src/pages/jobs/EmploymentNewsJobDetail.tsx`

The detail page currently has several job-centric labels and behaviors that would read oddly for notice-type content. Add conditional logic based on `job.job_category === 'Notification'`:

**1. Breadcrumb** (line 98-99): Currently says "Back to Employment News Jobs."
- If `job_category === 'Notification'` → show "Back to Notifications" linking to `/notifications`
- Otherwise → keep existing text

**2. Vacancies badge** (line 113-114): Shows "X Vacancies."
- Only render when `job_category !== 'Notification'` OR when vacancies is explicitly set. Notifications like corrigenda or schedules typically have no vacancy count, so this naturally hides via the existing `job.vacancies &&` guard — no change needed here.

**3. Apply Now button** (around line 204): Label says "Apply Now."
- If `job_category === 'Notification'` → label becomes "View Official Notice"
- Otherwise → keep "Apply Now"

**4. Page footer text** (line 227): Says "Published on TrueJobs" — fine for both, no change needed.

**5. Key Info Grid labels** — fields like Salary, Qualification, Age Limit naturally hide when null (existing `&&` guards), so a notification with no salary simply won't show that row. No change needed.

**Summary of detail page changes:**
- Breadcrumb text + link: conditional on `job_category`
- Apply button label: "View Official Notice" for notifications
- Everything else already adapts via null-guards

This ensures corrigenda, schedules, shortlist notices, and verification notices render with appropriate language rather than looking like vacancy postings.

## Files Changed (Complete List)

1. `supabase/functions/intake-publish/index.ts` — enable notification publishing + quality gate
2. `src/pages/jobs/Notifications.tsx` — new listing page
3. `src/App.tsx` — add `/notifications` route
4. `src/components/home/InfoCardsRow.tsx` — add Notifications card
5. `src/components/home/QuickAccessBar.tsx` — add Notifications quick link
6. `src/pages/jobs/EmploymentNewsJobDetail.tsx` — context-aware breadcrumb + button labels for notification items

