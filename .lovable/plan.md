

# Fix: SEO Cache Rebuild Still Hitting CPU Timeout

## Problem
The `seo-cache-rebuild` edge function continues to return "CPU Time exceeded" errors even after the previous reduction from 50 to 15 slugs per batch. Each slug involves DB fetches, HTML generation, SHA-256 hashing, hash comparison, and an upsert — collectively still too heavy for 15 slugs in one invocation.

## Solution
Reduce the client-side `BATCH_SIZE` from 15 to 5 slugs per request. This is a conservative value that should reliably stay within the edge function CPU budget. The rebuild will take more requests but each will complete successfully.

## File Changed
- `src/components/admin/seo-cache/SEOCacheManager.tsx` — change `BATCH_SIZE` from `15` to `5` (line 107)

