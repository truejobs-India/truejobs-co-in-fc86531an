
The user is asking whether the audit covered all job drafts, not just the 2 in the screenshot.

From my prior DB checks I already verified:
- Total intake-pipeline-published rows in `employment_news_jobs`: **14**
- Of those, **2** have `apply_link IS NULL` (Federal Bank + NGEL — both visible in screenshot scope)
- Other **12** intake rows already have `apply_link` populated

But the user's concern is broader: "every draft must have the orange Apply button." So I need to also confirm:
1. All `intake_drafts` with `processing_status='published'` and `published_table_name='employment_news_jobs'` → check the resulting row's `apply_link`
2. Confirm the source draft actually had a link to recover (otherwise nothing to backfill)

I'll add this verification step explicitly to the plan and keep the same fix.

## Plan: Fix missing Apply button across ALL ChatGPT Agent job drafts

### Audit (will run in implementation)
Single query before the fix to enumerate every affected row:
```sql
SELECT en.id, en.slug, en.apply_link,
       d.official_apply_link, d.official_notification_link, d.official_website_link
FROM employment_news_jobs en
JOIN intake_drafts d ON d.published_record_id::uuid = en.id
WHERE d.published_table_name = 'employment_news_jobs'
  AND en.apply_link IS NULL;
```
Current count from prior check: **2 rows** (Federal Bank, NGEL). The audit will be re-run at fix time to catch anything new.

### Fix (3 changes, same as before)

**1. `supabase/functions/intake-publish/index.ts` (line ~399)** — add fallback chain so future publishes never lose the link:
```ts
apply_link: draft.official_apply_link 
         || draft.official_notification_link 
         || draft.official_website_link,
```

**2. Backfill migration** — repairs every existing affected row, not just the 2:
```sql
UPDATE employment_news_jobs en
SET apply_link = COALESCE(d.official_apply_link, d.official_notification_link, d.official_website_link)
FROM intake_drafts d
WHERE d.published_record_id::uuid = en.id
  AND d.published_table_name = 'employment_news_jobs'
  AND en.apply_link IS NULL
  AND COALESCE(d.official_apply_link, d.official_notification_link, d.official_website_link) IS NOT NULL;
```
This is set-based — covers all rows in one shot, not row-by-row.

**3. `src/pages/jobs/EmploymentNewsJobDetail.tsx`** — make the CTA button orange + relabel:
```tsx
<Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
  <ExternalLink className="h-4 w-4 mr-2" />
  {job.job_category === 'Notification' ? 'View Official Notice' : 'Apply Now on Official Site'}
</Button>
```
Applied to both the primary `apply_link` button and the `official_website` fallback button.

### Verification after fix
Re-run the audit query — expected result: **0 rows** with NULL `apply_link` from intake pipeline. Spot-check Federal Bank + NGEL live URLs to confirm the orange button renders.

### Out of scope
- Pre-existing legacy `employment_news_jobs` rows (non-intake source) with NULL `apply_link` — different ingestion path, separate concern.
- Edge function logic, RLS, schema otherwise untouched.

### Risk
None. Fallback only activates when primary field is NULL. Backfill only touches NULL rows where a recoverable link exists in the draft.
