
Goal: verify the real model used for the jobs currently stuck in Emp News enrichment, and outline the permanent fix.

What I verified
- I checked the actual `employment_news_jobs` rows in the database.
- Current blocked set = `33` jobs total:
  - `30` with status `pending`
  - `3` with status `enrichment_failed`
- For the blocked rows, the stored `enrichment_error` shows the real model/provider that last failed.
- Every currently blocked row I inspected points to the same model family:
  - `Azure OpenAI gpt-5-mini returned empty response`
  - `Azure OpenAI gpt-5-mini timeout after 60s`
- I also checked the code path:
  - `src/components/admin/EmploymentNewsManager.tsx` sends `aiModel: enrichAiModel`
  - that value is loaded from shared local storage via `getLastUsedModel('text', 'gemini-flash')`
  - `supabase/functions/enrich-employment-news/index.ts` maps that model to the actual provider call
- I checked whether there is any durable per-attempt model history in the database. There is not.
  - `employment_news_jobs` has `enrichment_error` and `enrichment_attempts`
  - it does not have `last_enrichment_model`, `last_provider`, or an attempt-history table
- I also checked for dedicated enrich-function analytics/edge request history; there was no useful retained log output there for this function.

Conclusion
- For the jobs that are blocked right now, the real last attempted model was `azure-gpt5-mini`, not Gemini Flash or DeepSeek.
- I cannot truthfully prove older Gemini/DeepSeek failures for past attempts because the app does not persist enrichment attempt history; it only keeps the latest error string on the job row.
- So your pushback was valid: the system currently lacks proper observability for cross-model verification.

Root cause
1. Current stuck jobs
- The blocked jobs are failing on `azure-gpt5-mini`.
- The failure signatures are exactly:
  - empty response
  - timeout at 60s

2. Why the UI may not match what you remember
- The Emp News enrichment model is loaded from shared text-model local storage.
- That means the job enrichment flow can silently use whatever text model was last selected in admin, unless changed again before running.

3. Why this was hard to verify
- There is no persistent model-attempt audit trail for enrichment jobs.
- The latest error overwrites the previous one, so older Gemini/DeepSeek attempts are not reconstructable from DB.

Implementation plan
1. Fix the active `azure-gpt5-mini` failure path
- Update token-budget logic so `azure-gpt5-mini` gets the same high output budget as other GPT-5 style models.
- Increase the GPT-5 Azure wrapper timeout from 60s to 120s.
- This addresses the two real current failure signatures.

2. Add permanent enrichment audit tracking
- Create a dedicated table such as `employment_news_enrichment_runs` with one row per attempt:
  - job_id
  - selected_model_id
  - provider
  - api_model
  - max_tokens
  - status
  - error_message
  - duration_ms
  - attempted_at
- Write to this table on every enrichment attempt, success or failure.
- This will make future “which model actually failed?” questions fully answerable.

3. Store last-attempt metadata on the job row too
- Add lightweight columns on `employment_news_jobs`:
  - `last_enrichment_model`
  - `last_enrichment_provider`
  - `last_enrichment_api_model`
  - `last_enrichment_at`
- This gives fast visibility in the admin list without needing to open history.

4. Make the admin UI explicit
- In the Emp News drafts table, show the last attempted model and latest error.
- In the enrichment action area, show the currently selected model clearly before run.
- This reduces confusion caused by shared persisted model selection.

5. Recover the currently stuck jobs
- After the shared fixes are applied, reset the blocked rows for retry.
- Re-run only the `33` blocked jobs.
- Verify that the blocked count drops and new audit rows show the actual model/provider per job.

Technical details
- Verified code path:
  - `src/components/admin/EmploymentNewsManager.tsx`
  - `src/components/admin/AiModelSelector.tsx`
  - `supabase/functions/enrich-employment-news/index.ts`
  - `supabase/functions/_shared/word-count-enforcement.ts`
  - `supabase/functions/_shared/azure-openai.ts`
- Verified DB fact:
  - current blocked jobs all carry `azure-gpt5-mini` error strings
- Verified observability gap:
  - no persistent enrichment model history exists today
  - so older Gemini/DeepSeek attempts cannot be conclusively reconstructed after being overwritten

Expected result after implementation
- The current stuck jobs stop failing due to the GPT-5 Azure config issue.
- Future enrichments will always record exactly which model/provider/api-model was used.
- You will be able to verify, from the database itself, whether a failure came from Gemini Flash, DeepSeek, GPT-5 Mini, or anything else.
