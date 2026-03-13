

# Implementation Plan: Fix All, Enrich Now, Bulk Generation

The plan has been thoroughly reviewed and approved. All code changes stay inside the existing Blog section. Here is the final implementation summary:

## Files to Create/Modify

| # | File | Action |
|---|------|--------|
| 1 | `supabase/functions/generate-blog-article/index.ts` | **NEW** — article generation from topic, secured with same `verifyAdmin` pattern |
| 2 | `supabase/config.toml` | Add `[functions.generate-blog-article]` with `verify_jwt = false` |
| 3 | `supabase/functions/improve-blog-content/index.ts` | Add `enrich-article` action (8000 tokens, preview-before-apply) |
| 4 | `src/components/admin/BlogPostEditor.tsx` | Add per-row Fix All/Enrich buttons, Fix All dialog, Enrich dialog, Bulk generation collapsible |
| 5 | `src/components/admin/blog/BlogAITools.tsx` | Add Fix All orchestrator + Enrich Now button inside editor AI panel |

## Key Implementation Details

### Edge Function: `generate-blog-article`
- Exact same `verifyAdmin()` pattern as `analyze-blog-compliance-fixes` and `improve-blog-content`
- Uses Gemini 2.5 Flash, 8000 maxOutputTokens, temperature 0.5
- Returns JSON: `{ title, slug, content, metaTitle, metaDescription, excerpt, category, tags }`
- Prompt optimized for SEO, AdSense safety, no fabricated claims

### Edge Function: `improve-blog-content` — new `enrich-article` action
- Accepts `title, content, category, tags, targetWordCount`
- Returns `{ result: "<enriched HTML>", wordCount, changes[] }`
- 8000 maxOutputTokens — frontend shows preview before apply

### BlogPostEditor.tsx Changes
- **Per-row buttons**: "Fix All With AI" (Sparkles) and "Enrich Now" added to each article row's actions column (line ~796)
- **Fix All Dialog**: Runs compliance analysis, auto-applies safe metadata (meta_title, meta_description, excerpt, featured_image_alt, canonical_url, slug, author_name) directly to DB, shows review/unresolved items. Never touches article body.
- **Enrich Dialog**: Shows word limit selector (1200/1500/1800/2200/custom), calls enrich-article, shows scrollable preview, requires explicit "Apply" to save
- **Bulk Generator**: Collapsible section between SEO toolbar (line ~659) and search bar. Textarea for topics, category select, word count selector, sequential generation with 2s delay, per-topic status badges (Queued/Generating/Success/Failed), saves as drafts only
- New state: `fixAllDialogPost`, `fixAllResults`, `enrichDialogPost`, `enrichWordLimit`, `enrichResult`, `bulkTopics`, `bulkResults`, `isBulkGenerating`, `showBulkGenerator`

### BlogAITools.tsx Changes
- **Fix All button** at top of AI tools panel — runs orchestrator within editor context using `onApplyField` for safe metadata, existing helpers with duplicate guards for safe content
- **Enrich Now button** alongside existing tools — inline word limit selector, preview panel, explicit apply
- **Fix All results summary** inline in results collapsible: auto-fixed (green), review required (yellow), unresolved (gray)
- New state: `fixAllRunning`, `fixAllResults`, `enrichResult`, `enrichLoading`, `enrichWordLimit`

### Fix All Orchestrator Logic
1. Call `analyze-blog-compliance-fixes` with article data
2. Normalize response via existing `normalizeComplianceFixes`
3. Separate into: auto-apply (safe metadata fields where current value is empty/poor) | review required (content insertions, rewrites) | unresolved (advisory, low-confidence)
4. Auto-apply safe metadata, never touch article body
5. Show summary with counts
6. Log telemetry + audit

### Safeguards Preserved
- All existing duplicate guards (intro, conclusion, FAQ, content blocks)
- `normalizeApplyMode` before all branching
- Response validation via `normalizeComplianceFixes`
- No auto-rewrite of article body
- Enrich requires explicit confirmation
- Bulk saves as drafts only
- Telemetry + audit logging for all new actions

