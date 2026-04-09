

# Permanently Remove & Block Company — Final Gap Fixes + Implementation

## Gaps Fixed

**Gap 1 (Public blocklist exposure):** Removed the `"Anyone can check blocked companies"` SELECT policy for anon/authenticated. `blocked_companies` is now admin-only for all direct access. Frontend block checks use only the `is_company_blocked(p_name)` RPC which is `SECURITY DEFINER` and returns only a boolean — no table contents leak.

**Gap 2 (Storage cleanup):** Company assets are stored deterministically at `company-assets/{company_id}/*`. The RPC will list and delete all objects under the `{company_id}/` prefix inside the same transaction flow. This is safe because the path is keyed by UUID, no risk of cross-company deletion.

---

## Migration Summary

### Single migration — FKs + blocklist table + RPC

**FK fixes:**
- `jobs.company_id`: CASCADE → SET NULL
- `job_posting_drafts.company_id`: CASCADE → SET NULL, drop NOT NULL

**`blocked_companies` table:**
- Columns: `id`, `normalized_name` (unique), `original_name`, `aliases text[]`, `website_domain`, `reason`, `blocked_by`, `created_at`, `is_active`
- RLS: admin-only policy for ALL operations (no public/anon policy)

**`is_company_blocked(p_name text)` function:**
- `SECURITY DEFINER` — bypasses RLS internally
- Returns boolean only
- Checks `normalized_name` and `aliases` array for exact match
- Callable by anyone (safe — returns only true/false)

**`permanently_remove_and_block_company(...)` RPC:**
- `SECURITY DEFINER`, admin-only via `has_role` check
- Captures company `website_url`, `slug`, `logo_url`, `cover_image_url` BEFORE deletion
- Deletes jobs by `company_id` (GET DIAGNOSTICS for count)
- Deletes jobs by `lower(trim(company_name))` match (GET DIAGNOSTICS for count)
- Deletes drafts by `company_id`
- Deletes company row
- Inserts blocklist entry (ON CONFLICT updates)
- Purges SEO cache: exact slugs `'companies'` and `'companies/' || slug`
- Returns: counts + list of storage paths to delete (e.g. `["{id}/logo.png", "{id}/cover.png"]` derived from `logo_url`/`cover_image_url` columns)
- Does NOT delete storage objects itself (storage API not available in SQL)

**Storage deletion** happens client-side immediately after RPC success:
- Frontend calls `supabase.storage.from('company-assets').list(companyId + '/')` then `.remove(paths)`
- This is deterministic (UUID-prefixed folder), zero risk of cross-company deletion
- Result shown to admin: success or explicit failure with remaining paths

---

## File-by-File Summary

### New Files

| File | Purpose |
|------|---------|
| `src/utils/companyBlockCheck.ts` | Exports `isCompanyBlocked(name)` — calls `supabase.rpc('is_company_blocked', { p_name })`. No direct table read. |
| `src/components/admin/BlockedCompaniesManager.tsx` | Admin-only searchable list of blocked companies. Unblock with confirmation. |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/admin/CompaniesListView.tsx` | Add "Permanently Remove & Block" button per registered company. Confirmation dialog with: name, ID, linked job counts (by ID and by name), draft count, storage asset check, irreversible warning, type-to-confirm. On confirm: call RPC, then delete storage objects via Storage API, show result. Remove any old simple delete. |
| `src/components/admin/CompanyApprovalList.tsx` | Replace plain `handleReject` with "Reject & Block" calling the same RPC. |
| `src/pages/admin/AdminDashboard.tsx` | Add `BlockedCompaniesManager` to Companies tab. |
| `src/pages/auth/Signup.tsx` | Before `companies.insert`: call `isCompanyBlocked()` via utility. Block with error toast if matched. |
| `src/pages/employer/CompanyProfile.tsx` | Before company insert/update: same block check. |
| `src/components/employer/job-posting/JobPostingWizard.tsx` | Before job submit: check company name against blocklist via `isCompanyBlocked()`. |

### RLS/Policy Summary

| Table | Policy | Access |
|-------|--------|--------|
| `blocked_companies` | `"Admins manage blocked companies"` — ALL operations | Admin only |
| `blocked_companies` | No public/anon SELECT policy | None for non-admins |
| `is_company_blocked()` | SECURITY DEFINER function | Callable by anyone, returns boolean only |

### Storage Cleanup Summary

**Automatic and deterministic.** After RPC succeeds:
1. Frontend calls `supabase.storage.from('company-assets').list(companyId + '/')`
2. If objects found, calls `.remove()` on all paths under that prefix
3. Admin UI shows:
   - Success: "All company storage assets removed"
   - Partial failure: "Company removed and blocked. Storage cleanup failed for: [exact paths]. Remove manually from company-assets bucket."
4. Path pattern `{uuid}/logo.*`, `{uuid}/cover.*` — UUID-keyed, zero cross-company risk

### Verification Summary

1. No public SELECT on `blocked_companies` — non-admins cannot read the table
2. `is_company_blocked()` returns only boolean — no metadata leaks
3. Storage cleanup is automatic via deterministic UUID-prefixed paths
4. If storage delete fails, explicit paths shown to admin — no vague "manual if needed"
5. All previous protections intact: identifier capture before delete, correct GET DIAGNOSTICS counts, aliases support, exact cache purge, block checks on all entry points, type-to-confirm UI

