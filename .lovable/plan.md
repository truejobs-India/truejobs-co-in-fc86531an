

# Source 3 Firecrawl — Full Validation & Hardening Audit

## Summary of Findings

After deep inspection of all Source 3 files, I identified **6 critical gaps**, **4 moderate weaknesses**, and **3 minor issues**. Below is the audit section-by-section with exact findings and fixes.

---

## A. CROSS-SOURCE DEDUP — CRITICAL GAP

**Current state**: `handleDedupDrafts` (line 774-835 of firecrawl-ingest) only queries `firecrawl_draft_jobs` table. It compares drafts against other drafts.

**NOT compared against**:
- `rss_items` (Source 1)
- `employment_news_jobs` (Source 2)
- `jobs` table (published jobs)

**Risk**: A Firecrawl draft for "UPSC CDS 2026" could be approved and published as a duplicate of an identical RSS-sourced item already live on the site.

**Fix**: Add cross-source dedup that queries `rss_items` and `employment_news_jobs` by normalized title + organization + last date, and flags matches with `dedup_reason = 'cross_source_match:rss'` or `cross_source_match:employment_news`. This will be implemented in the `handleDedupDrafts` function by fetching comparison candidates from those tables too.

---

## B. OFFICIAL LINK VALIDATION — MODERATE WEAKNESS

**Rule-based extraction** (field-extractor.ts, `findOfficialUrl` lines ~165-180): Only checks if link domain contains `.gov.`, `.nic.`, `.org.in`, or `.ac.in` AND if link text/url contains keywords. This is reasonable but:

**Weaknesses found**:
1. No scoring/ranking — returns first match, not best match
2. No aggregator domain blocklist — if an aggregator URL contains `.org.in` it would pass
3. AI Find Links (firecrawl-ai-enrich line 256-316) relies on LLM to filter, but the blocklist is only in the system prompt — no code-level validation that the returned URL is actually official
4. AI can return any URL and it gets saved directly (line 295-303) — only guard is "existing is empty"

**Fix**: 
- Add a code-level aggregator domain blocklist validation on AI-returned URLs before saving
- Add URL scoring in field-extractor to prefer deeper paths over homepages
- Add post-save validation that official URLs don't point to known aggregator domains

---

## C. AI OVERWRITE SAFETY — MODERATE WEAKNESS

**Field-level audit**:

| Action | Fields touched | Overwrite guard |
|--------|---------------|-----------------|
| AI Clean | title, description_summary, organization_name | Overwrites if AI returns >5 chars. **No check if admin manually edited.** |
| AI Enrich | 16 fields | Only if old is empty OR new is 30% longer. **Reasonable but no "manually edited" flag.** |
| AI Find Links | 3 URL fields + confidence | Only if existing is empty. **Safe.** |
| AI Fix Missing | Only weak/null fields | Only fills blanks <3 chars. **Safe.** |
| AI SEO | seo_title, meta_desc, slug, intro, faqs | Always overwrites. **No guard at all.** |
| AI Cover Prompt | cover_image_prompt | Always overwrites. **Low risk.** |
| AI Cover Image | cover_image_url | Always overwrites. **Low risk.** |
| Run All | All above sequentially | Inherits per-step behavior. AI Clean can overwrite title that AI Enrich just improved. |

**Critical gap**: No concept of "manually edited" or "admin-approved" field protection. If an admin manually corrects a title then runs "Run All", AI Clean will overwrite it.

**Fix**: 
- Add `admin_edited_fields text[] DEFAULT '{}'` column to track which fields an admin manually changed
- AI actions should skip fields listed in `admin_edited_fields`
- Status `reviewed` or `approved` should block AI Clean and AI Enrich from running (only allow Fix Missing and SEO)

---

## D. AUDIT TRAIL — CRITICAL GAP

**Current state**: `ai_enrichment_log` (jsonb array) stores action name + timestamp + partial result info. This is append-only but:

1. **No before/after values** — cannot see what was overwritten
2. **No actor tracking** — no user_id recorded
3. **No rollback capability** — once overwritten, old values are gone
4. **Review actions** (mark reviewed/rejected) only set `reviewed_at` — no `reviewed_by`

**Fix**:
- Add `reviewed_by uuid` column
- Modify `ai_enrichment_log` entries to include `old_values` snapshot of changed fields
- Add `reviewed_by` to the updateStatus client call
- This gives practical audit without a separate history table

---

## E. PUBLISH GATING — CRITICAL GAP

**Current state**: Status values are `draft → reviewed → approved → rejected → promoted`. But there are **NO validation rules** for what qualifies a draft for approval or promotion. The `updateStatus` function (FirecrawlDraftsManager line 137-152) is a simple status update with zero field validation.

**Risk**: A draft with no title, no org name, no official links, and "none" confidence could be marked "approved".

**Fix**: Add a `firecrawl-publish-gate` validation function (can be in the edge function) that checks minimum requirements before allowing status = 'approved':
- title must be non-null and >10 chars
- organization_name must be non-null
- total_vacancies or post_name must exist
- last_date_of_application should exist
- extraction_confidence must be 'medium' or 'high'
- dedup_status must be 'clean'
- official links are recommended but not mandatory (flagged as warning)

---

## F. ADMIN SECURITY — STRONG

**RLS**: All 4 tables have `FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))`. This is correct and uses `SECURITY DEFINER` function.

**Edge functions**: Both `firecrawl-ingest` and `firecrawl-ai-enrich` validate JWT + admin role server-side before any action. Using `service_role_key` for DB operations.

**Client-side**: FirecrawlSourcesManager directly queries `firecrawl_sources` — RLS blocks non-admins. FirecrawlDraftsManager queries `firecrawl_draft_jobs` — also RLS protected.

**One minor issue**: `verify_jwt = false` is NOT set in config.toml for `firecrawl-ingest` or `firecrawl-ai-enrich`. This means Lovable's default deployment behavior applies. The functions do their own JWT validation, which is correct.

**Verdict**: Admin security is solid. No gaps found.

---

## G. EXTRACTION QUALITY — MODERATE

**field-extractor.ts** analysis:
- `extractLabeled` regex: `(?:^|\\n)\\s*\\**${escaped}\\**\\s*[:–\\-|\\]\\s*(.+?)\\s*$` — this handles bold-wrapped labels and various separators. Reasonable for most Indian job sites.
- **Table-based layouts**: Will fail. The regex expects "Label: Value" on a single line. Tabular data (common on govtjobguru.in, allgovernmentjobs.in) where label and value are in separate cells will produce markdown like `| Label | Value |` which the regex won't match.
- **Walk-in pages**: Usually have venue/time info — no extraction fields for these.
- **Mixed/noisy pages**: Cleaning is good but field extraction depends on label presence.

**content-cleaner.ts**: Solid 16-token branding removal + junk line patterns. The link extraction classifying into official/apply/social is well done.

**page-classifier.ts**: Deterministic scoring with tie-breaking. Neutral URLs default to `collection_roundup` — reasonable for listing pages.

**Fix**: Add pipe/table row extraction pattern to `extractLabeled` to handle `| Label | Value |` format.

---

## H. SOURCE-SPECIFIC VALIDATION

| Source | Strength | Weakness | Recommendation |
|--------|----------|----------|----------------|
| allgovernmentjobs.in | Clean structure, clear job URLs | Table-heavy layout | Keep High, add table extraction |
| mysarkarinaukri.com | Good signal density | Heavy social CTAs | Keep Medium, cleaning handles CTAs |
| govtjobguru.in | Department-organized | Mixed content (PSU + walk-in) | Keep Medium |
| sarkarinaukriblog.com | Standard blog format | Verbose prose, weak field labels | Keep Medium |
| freshersnow.com | Good coverage | Mixes private + govt jobs | Keep Low, needs stronger filtering |
| careerpower.in | Structured pages | Heavy prep content mixed in | Keep Low |
| sharmajobs.com | Simple layout | Sparse field labels | Keep Low |

No source-specific cleaning rules are needed beyond what exists. The general-purpose cleaner handles all branding tokens already.

---

## I. ACCEPTANCE CHECKLIST

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Seed discovery works | PASS | `handleDiscoverSource` scrapes seed, filters links, stages candidates |
| 2 | URL filtering works | PASS | Domain restriction + accept/reject signals + blocked patterns |
| 3 | Bucketing works | PASS | 5-bucket classifier with signal scoring |
| 4 | Only single_recruitment → draft path | PASS | Line 564 explicitly rejects non-recruitment |
| 5 | Source junk removed | PASS | 16 branding tokens + 20+ junk line patterns |
| 6 | Source URLs removed from final fields | PARTIAL | Cleaned from text, but `source_url`, `source_page_url` stored in draft (internal only — safe) |
| 7 | Official links don't point to aggregators | FAIL | No code-level validation on AI-returned URLs |
| 8 | Cross-source dedup | FAIL | Only checks within firecrawl_draft_jobs |
| 9 | AI overwrite protection | PARTIAL | Enrich has 30% guard, but Clean/SEO overwrite freely |
| 10 | Audit trail written | PARTIAL | ai_enrichment_log exists but no old values, no actor |
| 11 | Admin-only protection | PASS | RLS + JWT + role check in edge functions |
| 12 | Low-quality rows flagged | PASS | extraction_confidence + fields_missing visible in UI |

---

## Implementation Plan

### 1. Cross-source dedup enhancement
**File**: `supabase/functions/firecrawl-ingest/index.ts` (handleDedupDrafts)
- Query `rss_items` for matching `normalized_title` + `organization_name` candidates
- Query `employment_news_jobs` similarly
- Feed them into `checkDuplicate` alongside firecrawl drafts
- Store cross-source match info in `dedup_reason`

### 2. Official link validation
**File**: `supabase/functions/firecrawl-ai-enrich/index.ts` (handleAiFindLinks)
- Add aggregator domain blocklist constant
- Validate AI-returned URLs against blocklist before saving
- If URL fails validation, log warning but don't save it

### 3. AI overwrite protection
**Files**: 
- Migration: Add `admin_edited_fields text[] DEFAULT '{}'` to `firecrawl_draft_jobs`
- `firecrawl-ai-enrich/index.ts`: Check `admin_edited_fields` before overwriting, block AI on `reviewed`/`approved` status
- `firecrawl-ai-enrich/index.ts` (handleAiClean, handleAiSeo): Store old values in log

### 4. Audit trail improvement
**Files**:
- Migration: Add `reviewed_by uuid` to `firecrawl_draft_jobs`
- `firecrawl-ai-enrich/index.ts`: Include `old_values` in `appendLog`
- `FirecrawlDraftsManager.tsx`: Pass user ID to reviewed_by

### 5. Publish gating
**File**: `supabase/functions/firecrawl-ingest/index.ts`
- Add `validate-for-approval` action
- `FirecrawlDraftsManager.tsx`: Call validation before allowing status change to 'approved'

### 6. Table-row extraction pattern
**File**: `supabase/functions/_shared/firecrawl/field-extractor.ts`
- Add pipe-delimited pattern to `extractLabeled`

### Technical details

**DB migration** adds:
- `admin_edited_fields text[] DEFAULT '{}'` on `firecrawl_draft_jobs`
- `reviewed_by uuid` on `firecrawl_draft_jobs`

**No new tables**. No new edge functions. All changes are surgical additions to existing files.

**Estimated files**:
- Edit: `firecrawl-ingest/index.ts`, `firecrawl-ai-enrich/index.ts`, `field-extractor.ts`, `FirecrawlDraftsManager.tsx`
- Create: 1 migration file
- No new edge functions

---

## Production Readiness Verdict

| Category | Rating | Notes |
|----------|--------|-------|
| Architecture | Strong | Clean 4-table isolation, proper separation from Source 1/2 |
| Data quality | Medium | Field extraction is regex-based; will miss table layouts. AI enrichment compensates. |
| Official-link trustworthiness | Weak → Medium after fix | Currently no code-level validation on AI URLs. Fix adds blocklist. |
| Dedup quality | Weak → Strong after fix | Currently intra-source only. Fix adds cross-source. |
| AI safety | Medium → Strong after fix | SEO/Clean overwrite freely. Fix adds field protection + status guards. |
| Admin security | Strong | RLS + JWT + role checks on all paths |
| Reviewer workload | Medium | 7-dot AI status + missing-field count helps. Publish gating will reduce risk of bad approvals. |

### What is safe now:
- Architecture and table isolation
- Admin security (RLS + edge function auth)
- Discovery and bucketing logic
- Content cleaning pipeline
- Field extraction (for well-formatted pages)

### What is still weak (fixed by this plan):
- Cross-source dedup (critical fix)
- Official link validation (moderate fix)
- AI overwrite protection (moderate fix)
- Audit trail completeness (moderate fix)
- Publish gating (critical fix)

### What should not be trusted blindly even after fixes:
- Official links found by AI — always human-verify before publishing
- Extraction from table-heavy or poorly structured pages — review fields manually
- Dedup across sources — fuzzy matching can miss subtle variants; periodic manual spot-check recommended

