

## Plan: Prompt 4 — Review, Edit, Publish & Finishing Touches

### What this builds
Complete the Azure Based Extraction pipeline with draft editing, selective publishing to `employment_news_jobs`, publish logging, and a functional Publish Log tab.

### Publish strategy

Drafts are published by inserting into the existing `employment_news_jobs` table with `status='pending'` and `source='Employment News (Azure)'`. This feeds into the existing enrichment pipeline without modifying it. No `upload_batch_id` is set (nullable). The `linked_live_job_id` on the draft tracks the created record.

```text
azure_emp_news_draft_jobs (draft)
  → edge function: azure-emp-news-publish-drafts
    → INSERT into employment_news_jobs (status='pending', source='Employment News (Azure)')
    → UPDATE draft: publish_status='published', linked_live_job_id=new_id
    → INSERT azure_emp_news_publish_logs
    → UPDATE issue publish_status
```

### New files

| File | Purpose |
|------|---------|
| `supabase/functions/azure-emp-news-publish-drafts/index.ts` | Publish one or many drafts to `employment_news_jobs` |
| `src/components/admin/emp-news/azure-based-extraction/PublishLogTab.tsx` | Publish log viewer with filters |

### Modified files

| File | Change |
|------|--------|
| `DraftJobsTab.tsx` | Add: checkbox selection, edit dialog, publish single/selected/all-passed buttons, confirmation dialog |
| `AzureEmpNewsWorkspace.tsx` | Replace publish placeholder with `PublishLogTab` |
| `supabase/config.toml` | Add `verify_jwt = false` for `azure-emp-news-publish-drafts` |

### Edge function: azure-emp-news-publish-drafts

Input: `{ draft_ids: string[] }` (one or many)

For each draft:
1. Fetch draft with `ai_cleaned_data`
2. Guard: skip if `publish_status='published'` already
3. Map fields to `employment_news_jobs` columns:
   - `org_name` ← `employer_name`
   - `post` ← `post_names` joined
   - `vacancies` ← `total_vacancies` (parse int)
   - `qualification`, `age_limit`, `salary`, `location`
   - `application_mode` ← `application_method`
   - `apply_link` ← `official_website`
   - `last_date`, `advertisement_number` ← `ad_reference`
   - `description` ← `summary`
   - `source` = `'Employment News (Azure)'`
   - `status` = `'pending'`
4. Insert into `employment_news_jobs`, get ID
5. Update draft: `publish_status='published'`, `linked_live_job_id=id`
6. Insert publish log: action='publish', status='success'
7. On failure: log action='publish', status='failed', message=error

After all drafts: update issue `publish_status` based on counts.

### DraftJobsTab enhancements

- **Checkbox column** for multi-select
- **Edit dialog**: editable fields for `draft_title`, `employer_name`, `post_names`, `total_vacancies`, `qualification`, `age_limit`, `salary`, `application_method`, `official_website`, `last_date`, `ad_reference`, `location`. Save edits to `ai_cleaned_data` via direct update.
- **Publish single**: button per row (for `passed` or `review_needed` drafts, not already published)
- **Publish selected**: button for checked drafts
- **Publish all passed**: bulk action with confirmation dialog
- **Confirmation dialog** for bulk publish showing count
- **Published badge** changes to green with link icon when `linked_live_job_id` is set

### PublishLogTab

- Issue selector
- Table: action, status (badge), draft title, message, created_at
- Filter: all / success / failed
- Empty state when no logs

### No DB migration needed
All tables already exist from Prompt 1.

### config.toml addition
```toml
[functions.azure-emp-news-publish-drafts]
verify_jwt = false
```

### Test checklist
- [ ] Edit a draft's fields and save — changes persist
- [ ] Publish a single passed draft — record appears in `employment_news_jobs` with `status=pending`
- [ ] Publish selected drafts via checkboxes
- [ ] Publish all passed drafts with confirmation
- [ ] `review_needed` drafts publishable but not included in "publish all passed"
- [ ] Already-published drafts cannot be re-published
- [ ] Publish log shows success/failed entries
- [ ] Issue `publish_status` updates correctly
- [ ] `linked_live_job_id` is set on published drafts
- [ ] Old Employment News system completely unaffected

### Assumptions
- Publish target is `employment_news_jobs` with `status='pending'` so existing enrichment pipeline picks them up
- `source='Employment News (Azure)'` distinguishes from classic pipeline entries
- No `upload_batch_id` needed (field is nullable)
- Edits update `ai_cleaned_data` JSON directly on the draft record before publish
- Failed/review_needed drafts can be force-published individually but excluded from bulk "publish all passed"

