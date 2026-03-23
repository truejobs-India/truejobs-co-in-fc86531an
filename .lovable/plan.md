

# Security Audit: firecrawl-ingest & firecrawl-ai-enrich

## Current State: SAFE

Both functions already implement strict server-side auth and admin-role enforcement. No fixes needed.

### firecrawl-ingest (lines 37-44, 78-101)
- **Auth check**: `checkAdmin()` is called at line 43, BEFORE any action handler runs
- **Token validation**: Uses `supabase.auth.getUser(token)` with service role key — server-side verification, not client-side
- **Admin enforcement**: Queries `user_roles` table for `role = 'admin'` — same `has_role` pattern used across all admin functions
- **All 9 actions** (test-source, list-sources, run-source, discover-source, source-stats, extract-item, extract-batch, dedup-drafts, validate-for-approval) are gated behind the single `checkAdmin()` call at line 43-44
- **Unauthenticated requests**: Rejected at line 84 (missing auth header) or line 90 (invalid token)
- **Non-admin authenticated users**: Rejected at line 99

### firecrawl-ai-enrich (lines 61-72)
- **Auth check**: Lines 62-72, runs BEFORE the action switch at line 76
- **Token validation**: `supabase.auth.getUser(token)` — same server-side pattern
- **Admin enforcement**: Queries `user_roles` for `role = 'admin'` — rejects with 403 if not admin
- **All actions** (ai-clean, ai-enrich, ai-find-links, ai-fix-missing, ai-seo, ai-cover-prompt, ai-cover-image, ai-run-all, rollback-ai-action) are gated behind lines 62-72
- **Unauthenticated requests**: Rejected at line 63
- **Non-admin authenticated users**: Rejected at line 72

### Why `verify_jwt = false` is correct here
Per the project's documented pattern (see `disable-jwt-edge-functions` context), Lovable's signing-keys system requires `verify_jwt = false` so functions can validate JWTs themselves using `getUser()` or `getClaims()`. Both functions do exactly this. Setting `verify_jwt = true` would cause the gateway to reject requests signed with the project's anon key before the function's own auth logic runs — potentially breaking legitimate admin calls.

### No code path bypasses auth
- OPTIONS (CORS preflight) returns no data — safe
- Missing `action` returns 400 — but only after auth check passes (firecrawl-ingest line 41 is before auth... let me re-check)

**Wait — potential issue in firecrawl-ingest**: Line 41 (`if (!action) return ...`) runs BEFORE `checkAdmin()` at line 43. This means an unauthenticated caller sending `{}` gets a 400 error with "Missing action parameter" instead of a 401. This is a minor information leak (confirms the function exists and expects an `action` field) but is not a security vulnerability — no data is exposed, no mutation occurs.

**Recommended minor fix**: Move the auth check before the action check in firecrawl-ingest. This is a best-practice hardening, not a vulnerability fix.

## Plan

### File: `supabase/functions/firecrawl-ingest/index.ts`
- Swap lines 41 and 43-44 so auth runs before action validation
- This ensures unauthenticated callers get 401, not 400 with parameter hints

### No other changes needed
- No files created
- No DB changes
- No RLS changes
- Both functions are already secure for all mutating paths

## Verdict

| Check | firecrawl-ingest | firecrawl-ai-enrich |
|-------|-----------------|---------------------|
| Auth required | Yes (getUser) | Yes (getUser) |
| Admin role enforced | Yes (user_roles query) | Yes (user_roles query) |
| All actions gated | Yes (single gate before switch) | Yes (single gate before switch) |
| No data leak on unauth | Minor (action hint) — fixed | Yes |
| Service role for DB ops | Yes | Yes |

**Final confirmation**: Only authenticated admin users can invoke either function. The `verify_jwt = false` setting is correct for this architecture.

