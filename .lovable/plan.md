

# Why the Test Email Failed + Fix

## Root Cause

The `admin-send-notification` edge function exists in the codebase but there are **zero invocation logs** for it in the analytics — meaning either:

1. **The function is not deployed** — most likely cause. The function code is in the repo but was never deployed (or was lost during a previous deployment cycle). When the frontend calls `supabase.functions.invoke('admin-send-notification', ...)`, Supabase returns a 404 or similar error, which the UI catches as "Send failed."

2. Both required secrets (`RESEND_API_KEY` and `LOVABLE_API_KEY`) are confirmed present, so credentials are not the issue.

## Fix

### Step 1: Deploy the edge function
Deploy `admin-send-notification` to make it callable.

### Step 2: Test and verify
Invoke the function to confirm it responds correctly (check for 200 status with proper auth).

### Step 3: Improve error messaging
The current `EmailSubscribersTab.tsx` catches errors generically with `err?.message || 'Send failed'`. The Supabase client may return an unhelpful error when the function doesn't exist. Add slightly better error logging to surface the actual failure reason.

## Files Changed
- No code file changes needed — just a deployment
- If deployment reveals runtime errors, fix them in `supabase/functions/admin-send-notification/index.ts`

## Scope
- Deploy one edge function
- Verify it works
- No other files or features touched

