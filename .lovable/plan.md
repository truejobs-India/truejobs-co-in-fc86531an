

# Security Fixes Implementation Plan

## Pre-Implementation Verification

From the provided schema context, I can confirm the exact current state:

### Fix 1 — `user_roles` INSERT Policy
- **Actual policy name:** `"Users can insert their own role on signup"`
- **Current WITH CHECK:** `(auth.uid() = user_id)` — no role restriction
- **Trigger:** `handle_new_user()` runs as SECURITY DEFINER, inserts `'job_seeker'` automatically — bypasses RLS
- **Frontend:** `AuthContext.tsx` line 131 does a second INSERT with `selectedRole` (either `'job_seeker'` or `'employer'`)
- **Duplicate risk:** The trigger always inserts `job_seeker`. If a user signs up as `job_seeker`, the frontend INSERT will hit a unique constraint (`user_id, role`). This is already handled — the `23505` error is caught or the trigger row already exists. For employer signup, the trigger inserts `job_seeker` and the frontend inserts `employer` — two different roles, no conflict.

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;
CREATE POLICY "Users can insert their own role on signup"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND role IN ('job_seeker'::app_role, 'employer'::app_role)
);
```

### Fix 2 — `email_subscribers` SELECT Policy
- **Actual policy name:** `"Subscribers can view their own subscription"`
- **Current USING:** `true` — exposes all rows to everyone including anon
- **Admin access:** Covered by `"Admins can manage all subscribers"` (ALL policy)
- **Frontend usage:** `EmailDigestCapture.tsx` only does INSERT, never SELECT
- **No user_id column** exists on this table

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "Subscribers can view their own subscription" ON public.email_subscribers;
```

Simply dropping it is sufficient — no replacement needed.

### Fix 3 — `app_settings` (Accepted Risk, No Change)
- Current keys: `telegram_channel_url`, scraping config — non-sensitive
- `TelegramAlertWidget.tsx` reads this table on public pages
- Restricting to admin-only would break the widget
- **Recommendation:** Future `is_public` boolean column for public/private split

### Fix 4 — `campaign_enrollments` (Accepted Risk, No Change)
- Public INSERT powers `/enrol-now` landing page — intentional design
- Admin-only SELECT/UPDATE — users cannot read others' data
- DELETE not allowed for anyone except admin
- **Recommendation:** Add CAPTCHA if spam becomes an issue

## Changes Summary

| Fix | Action | Method |
|-----|--------|--------|
| 1 | Database migration | Restrict INSERT to `job_seeker` + `employer` |
| 2 | Database migration | Drop permissive SELECT policy |
| 3 | No change | Accepted risk — documented |
| 4 | No change | Accepted risk — documented |

**Zero frontend code changes required.** Two SQL statements in one migration.

