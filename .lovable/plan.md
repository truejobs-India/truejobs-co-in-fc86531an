

# Companies Section: Registered-Only + Scraped Jobs Cleanup

## Summary

The Companies list currently scans ALL jobs to build name-only entries. This will be changed to query only the `companies` table (4 registered companies). Separately, the stale scraping infrastructure will be fully shut down.

## File-by-File Changes

### 1. `src/components/admin/CompaniesListView.tsx`

**Replace the entire `fetchCompanies` function** (lines 62-113). Remove the jobs-scanning loop entirely.

New logic:
```
SELECT id, name FROM companies → count jobs per company_id → display
```

- Query `companies` table for `id, name`
- For each company, query `jobs` count where `company_id = company.id` and not deleted
- Build array sorted by job count descending
- Remove `companyIdToName` map, the `while(hasMore)` pagination loop, and all `company_name` aggregation logic
- Every entry will have a real `id` — the `{company.id && ...}` guard on Remove & Block stays correct naturally
- Remove the "Registered" badge (all entries are registered now, badge is redundant)
- Update card title from "All Companies" to "Registered Companies"

### 2. Database: Unschedule stale cron jobs (via insert tool)

Remove these 3 stale/duplicate cron jobs:
- **jobid 4** `daily-scrape-summary` — calls deleted `send-daily-scrape-summary`
- **jobid 6** `nightly-duplicate-cleanup` — duplicate of jobid 5
- **jobid 7** `crawl-govt-portal-daily` — calls deleted `crawl-govt-portal`, root cause of scraped jobs

Keep: jobid 3, 5, 8, 9, 11 (legitimate)

### 3. Delete deployed edge functions

- `crawl-govt-portal`
- `send-daily-scrape-summary`

### 4. Soft-delete scraped jobs (via insert tool)

```sql
UPDATE jobs SET is_deleted = true WHERE source = 'scraped' AND (is_deleted IS NULL OR is_deleted = false)
```

142 rows affected.

### 5. Migration: Add DB trigger guard

```sql
CREATE OR REPLACE FUNCTION public.block_orphan_scraped_inserts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source = 'scraped' AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Scraped jobs must have a company_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_orphan_scraped ON public.jobs;
CREATE TRIGGER trg_block_orphan_scraped
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.block_orphan_scraped_inserts();
```

## What is NOT touched

- No other admin tabs
- No public pages
- No blog/SEO/notification/job-posting flows
- No `CompanyApprovalList`, `BlockedCompaniesManager`, or other components
- No employer flows
- No RLS policies
- No edge function code in the repo

## Verification

1. Companies list will show exactly 4 registered companies from `companies` table
2. No name-only job-derived entries will appear
3. Stale cron jobs removed → no more scraped job inserts
4. Deployed stale functions deleted → cannot be invoked
5. 142 existing scraped jobs soft-deleted
6. DB trigger prevents future orphan scraped inserts
7. Remove & Block continues working for registered companies (unchanged)

