

# Phase 5 Hardening — Remaining Gaps Fix

## Findings Summary

After deep inspection, these are the real remaining gaps:

### Gap 1: Official-Link Finding — Rule-based extraction is weak
**Current**: `findOfficialUrl` in `field-extractor.ts` returns the **first** matching link, not the best. No scoring. No aggregator blocklist at the rule-based layer. The AI layer has a blocklist but the rule-based layer doesn't.

**Fix**: 
- Add URL scoring in `findOfficialUrl` — prefer deeper paths (with `/recruitment/`, `/notification/`, `/pdf/`) over root homepages
- Add aggregator blocklist check at rule-based layer too (reuse same list from ai-enrich)
- Score and rank candidates, return highest-scored match

### Gap 2: Security — Edge functions missing `verify_jwt = false` in config.toml
**Current**: `firecrawl-ingest` and `firecrawl-ai-enrich` are NOT listed in `config.toml`. They do internal JWT validation, but without `verify_jwt = false` in config, Lovable's deployment may enforce JWT at the gateway level, potentially causing issues.

**Fix**: Add both functions to `supabase/config.toml` with `verify_jwt = false` (they handle auth internally).

**RLS**: All 4 tables have `FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))` — solid. Edge functions check JWT + admin role server-side — solid. No gaps found.

### Gap 3: No rollback mechanism for AI changes
**Current**: `old_values` are stored in `ai_enrichment_log` but there's no way to restore them. No UI or backend action for rollback.

**Fix**: Add a `rollback-ai-action` action to `firecrawl-ai-enrich` that reads the last log entry's `old_values` and restores them. Add a "Undo Last AI" button in the UI.

### Gap 4: Review flow lacks publish-readiness indicators in UI
**Current**: The drafts table shows confidence badge and missing field count, but doesn't visually surface critical blockers (no title, no org, duplicate, no official links) in an obvious way.

**Fix**: Add a "readiness" column in the table with color-coded indicator and tooltip showing blockers. Simple traffic-light: green (ready), yellow (warnings), red (blockers).

### Gap 5: Source-specific cleaning not implemented
**Current**: General-purpose cleaner handles all sources identically. Some sources have unique noise patterns.

**Fix**: Add source-specific junk patterns to `content-cleaner.ts`:
- FreshersNow: "Government Jobs India", "Govt Jobs Alert" headers
- CareerPower: "Adda247", "Bankersadda" brand mentions
- SarkariNaukriBlog: "SNB" brand token
- GovtJobGuru: "GJG" shortform
- MySarkariNaukri: "MSN" shortform
- AllGovernmentJobs: "AGJ" shortform
- SharmaJobs: "SJ" shortform

### Gap 6: `rss_items.current_status` filter uses wrong values
**Current**: Cross-source dedup queries `rss_items` with `.in('current_status', ['new', 'triaged', 'published'])`. But the valid enum values (from the trigger) are: `'new', 'updated', 'queued', 'reviewed', 'ignored', 'duplicate'`. There's no `'triaged'` or `'published'` status.

**Fix**: Change to `.in('current_status', ['new', 'updated', 'queued', 'reviewed'])`.

---

## Implementation Plan

### File 1: `supabase/functions/_shared/firecrawl/field-extractor.ts`
- Add `AGGREGATOR_DOMAINS` constant (import pattern from ai-enrich)
- Rewrite `findOfficialUrl` → `findBestOfficialUrl` with scoring: +3 for path-depth match, +2 for keyword match, -10 for aggregator domain, -2 for root/homepage-only URL
- Return highest-scoring candidate instead of first match

### File 2: `supabase/functions/_shared/firecrawl/content-cleaner.ts`
- Add source-specific branding tokens: `'snb'`, `'gjg'`, `'adda247'`, `'bankersadda'`, `'msn govt jobs'`, `'agj'`, `'sj govt jobs'`, `'government jobs india freshersnow'`

### File 3: `supabase/functions/firecrawl-ingest/index.ts`
- Fix cross-source dedup RSS query: change `['new', 'triaged', 'published']` → `['new', 'updated', 'queued', 'reviewed']`

### File 4: `supabase/functions/firecrawl-ai-enrich/index.ts`
- Add `rollback-ai-action` handler: reads last `ai_enrichment_log` entry with `old_values`, restores those fields, appends a rollback log entry

### File 5: `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx`
- Add readiness indicator column (traffic-light)
- Add "Undo Last AI" button in dropdown menu
- Show blocker tooltips

### File 6: `supabase/config.toml`
- Add `[functions.firecrawl-ingest]` and `[functions.firecrawl-ai-enrich]` with `verify_jwt = false`

### No DB migrations needed — all changes are code-level.

---

## What remains weak after fixes
- **Official links from AI**: Even with blocklist + scoring, AI can still hallucinate URLs. Always human-verify.
- **Extraction from poorly structured pages**: Regex-based extraction will miss non-standard layouts. AI Enrich compensates.
- **Cross-source dedup fuzzy matching**: Can miss close but not identical variants. Periodic manual spot-checks recommended.

## Final verdict
After these fixes, Source 3 is **safe for controlled production use** with admin review before any publishing.

