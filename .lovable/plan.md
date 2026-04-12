

# Plan: Two Targeted Fixes for Readiness Display Bug and FAQ Count Sync

## Fix 1: Readiness Display Bug
**File**: `src/lib/blogArticleAnalyzer.ts`  
**Line ~350** in `getReadinessStatus()`:  
Replace `!metadata.content` with `metadata.wordCount === 0`. This fixes the systemic bug where the blog table sets `content: ''` for performance, causing every unpublished article to show "Not Ready".

## Fix 2: Pre-fix FAQ Count Sync
**File**: `src/hooks/useBulkAutoFix.ts`  
In `processOneArticle`, before the edge function call: if `post.faq_count` is 0 but `post.content` contains H3/H4 question headings (ending in `?`), count them, update the DB, and set the local value before proceeding.

## No other changes
- No threshold, weight, or scoring changes
- No unrelated refactors

## Verification
- Blog table badges reflect real readiness instead of universal "Not Ready"
- FAQ count synced for articles with existing FAQ content
- GPSC article can be re-tested

