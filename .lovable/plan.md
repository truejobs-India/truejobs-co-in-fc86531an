

# Fix: "Rebuild All" CPU Timeout

## Problem
The `seo-cache-rebuild` edge function hits the "CPU Time exceeded" limit when processing batches of 50 slugs. Each slug requires a DB fetch, HTML generation, SHA-256 hash computation, hash comparison, and an upsert — collectively exceeding the edge function CPU budget.

## Solution
Reduce the client-side batch size from 50 to 15 slugs per request. This keeps each invocation well within CPU limits while still completing the full rebuild (just with more, smaller batches).

## File Changed
- `src/components/admin/seo-cache/SEOCacheManager.tsx` — change `BATCH_SIZE` from `50` to `15` (line 107)

