

# Blog AI Tools — Full Issue Detection and Fix System

## Scope
5 changes: 1 DB migration, 2 edge functions, 2 frontend components.

## Step 1: Database Migration

Create `blog_ai_telemetry` and `blog_ai_audit_log` tables with RLS.

```sql
create table if not exists blog_ai_telemetry (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  tool_name text not null,
  action text,
  target text,
  apply_mode text,
  status text,
  error_message text,
  item_count int,
  slug text,
  category text,
  tags text[],
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table blog_ai_telemetry enable row level security;
create policy "Admins can view telemetry" on blog_ai_telemetry for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated can insert telemetry" on blog_ai_telemetry for insert to authenticated with check (true);

create table if not exists blog_ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  before_value text not null default '',
  after_value text not null default '',
  apply_mode text not null default 'advisory',
  target_field text,
  slug text,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table blog_ai_audit_log enable row level security;
create policy "Admins can view audit log" on blog_ai_audit_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated can insert audit log" on blog_ai_audit_log for insert to authenticated with check (true);
```

## Step 2: `analyze-blog-compliance-fixes/index.ts`

**Expand whitelists:**
- `VALID_FIX_TYPES`: add `canonical_url`, `slug`, `meta_description`, `image_alt`, `faq`, `intro`, `conclusion`, `trust_signal`, `affiliate_links`, `internal_links`, `content_rewrite`
- `VALID_APPLY_MODES`: replace with normalized set `apply_field`, `append_content`, `prepend_content`, `insert_before_first_heading`, `replace_section`, `review_replacement`, `advisory`
- `EDITABLE_FIELDS`: add `canonical_url`, `slug` (both editable via `onApplyField` → `handleFormChange`)

**`normalizeFix` changes:**
- Add legacy map applied BEFORE whitelist: `field`→`apply_field`, `append`→`append_content`, `review-and-replace`→`review_replacement`, `manual`→`advisory`
- Add `confidence` field (default `'medium'`)
- Downgrade unknown values to `advisory`

**Expand accepted input:** `existingMeta.canonical_url`, `hasIntro`, `hasConclusion`, `headings`, `wordCount`, `featured_image`

**Expand `metaContext`** with those new fields.

**Rewrite prompt** to cover all issue categories (canonical URL, slug, meta description, image alt, FAQ, intro, conclusion, trust signals, affiliate links, internal links, content rewrites). Include specific generation rules (canonical = `https://truejobs.co.in/blog/{cleaned-slug}`, intro = `insert_before_first_heading`, trust = `review_replacement`, affiliate = `advisory`).

**Increase `maxOutputTokens`** to 4000.

## Step 3: `improve-blog-content/index.ts`

Add two new actions:
- `generate-intro` → returns `{ result: "<p>...</p>", applyMode: "insert_before_first_heading" }`
- `generate-conclusion` → returns `{ result: "<h2>Conclusion</h2><p>...</p>", applyMode: "append_content" }`

Expand `structure` output to include `suggestedInsertions[]` without breaking existing `proposedOutline`/`missingSections`.

## Step 4: `BlogPostEditor.tsx`

Add `canonical_url` to `formData`:
- Line 116-129: add `canonical_url: ''`
- Line 159-165 `resetForm`: add `canonical_url: ''`
- Line 171-186 `openEditDialog`: add `canonical_url: post.canonical_url || ''`
- Line 234-247 `buildPostData`: add `canonical_url: formData.canonical_url.trim() || null`

## Step 5: `BlogAITools.tsx`

### 5a. Expand `EDITABLE_FIELDS` (line 72)
Add `canonical_url`, `slug`.

### 5b. Update `BlogAIToolsProps.formData` (line 40-53)
Add `canonical_url?: string`.

### 5c. Add `normalizeApplyMode` helper (before component)
Maps legacy names: `field`→`apply_field`, `append`→`append_content`, `review-and-replace`→`review_replacement`, `manual`→`advisory`. Returns input unchanged if no mapping exists.

### 5d. Add telemetry + audit helpers (before component)
```ts
async function trackBlogToolEvent(ev) {
  try { await supabase.from('blog_ai_telemetry').insert({...ev, timestamp: new Date().toISOString()}); } catch(e) { console.warn(e); }
}
async function logBlogAiAudit(entry) {
  try {
    await supabase.from('blog_ai_audit_log').insert({
      ...entry,
      before_value: typeof entry.before_value === 'string' ? entry.before_value : JSON.stringify(entry.before_value),
      after_value: typeof entry.after_value === 'string' ? entry.after_value : JSON.stringify(entry.after_value),
      timestamp: new Date().toISOString(),
    });
  } catch(e) { console.warn(e); }
}
```

### 5e. Add deterministic content helpers
- `insertBeforeFirstHeading(editor, html)` — regex find first `<h[12]`, insert before; fallback prepend
- `hasExistingIntro(content)` — check for substantive text before first `<h1>`/`<h2>`
- `hasExistingConclusion(content)` — detect Conclusion/Final Thoughts/Summary/Key Takeaways headings (case-insensitive)
- `sentenceAlreadyExists(html, sentence)` — normalize both (lowercase, strip tags, collapse whitespace), check includes
- `contentBlockAlreadyExists(html, block)` — first 80 chars normalized check

### 5f. Expand `handleComplianceFixes` payload (line 336-346)
Add to `existingMeta`: `canonical_url: formData.canonical_url || null`, `hasIntro: currentMetadata?.hasIntro ?? false`, `hasConclusion: currentMetadata?.hasConclusion ?? false`, `headings: currentMetadata?.headings || []`, `wordCount: currentMetadata?.wordCount || 0`, `featured_image: formData.cover_image_url || null`.

### 5g. Expand `applyComplianceFix` (line 414-425)
**Normalize `applyMode` FIRST** via `normalizeApplyMode(fix.applyMode)`, then branch on normalized names only:
- `apply_field` — direct metadata apply (existing `metadata`+`field` logic). Skip if current value already matches.
- `append_content` — append to editor (existing logic). Guard with `contentBlockAlreadyExists`.
- `prepend_content` — prepend to editor. Guard with `hasExistingIntro` for intro-type fixes.
- `insert_before_first_heading` — use `insertBeforeFirstHeading` helper. Guard with `hasExistingIntro`.
- `replace_section` / `review_replacement` — use existing ComplianceFixCard review UI flow.
- `advisory` — display only, no action.

Also block duplicate FAQ insertion using `hasFaqHeading` + `contentBlockAlreadyExists`.

Add audit logging after each successful apply. Track telemetry on click.

### 5h. Validate/normalize compliance response before render (line 347)
After receiving `data` from the edge function, normalize each fix:
- Normalize `applyMode` via `normalizeApplyMode`
- Whitelist `fixType` — if unknown, set to `advisory`
- Ensure `issueLabel`, `explanation` are strings (default `''`)
- Ensure `priority` is `high`/`medium`/`low` (default `medium`)
- Filter out completely malformed items (no `issueLabel` AND no `explanation`) but do NOT crash the whole list — bad items downgrade to advisory individually.

### 5i. Update `ComplianceFixCard` (line 714-801)
- Normalize `applyMode` before computing `isApplyable`/`isAppendable`/etc.
- Expand `isApplyable` for new EDITABLE_FIELDS (canonical_url, slug)
- Add render paths: `prepend_content`/`insert_before_first_heading` → "Insert" button routed through existing `onInsertContent` callback (which parent handler routes by normalized applyMode)
- Show `confidence` badge when present
- No new props needed — parent `applyComplianceFix` already routes by applyMode

### 5j. Wrap all handlers with telemetry
Each of `handleGenerateSEO`, `handleGenerateFAQ`, `handleSuggestLinks`, `handleImproveStructure`, `handleRewriteSection`, `handleComplianceFixes`: track `tool_run_started` at beginning, `tool_run_finished` with safe `itemCount` at end.

Safe item counts per tool:
- seo: `Object.keys(data || {}).length`
- faq: `Array.isArray(data?.faqs) ? data.faqs.length : 0`
- internalLinks: `Array.isArray(validSuggestions) ? validSuggestions.length : 0`
- structure: `Array.isArray(data?.proposedOutline) ? data.proposedOutline.length : 0`
- rewriteSection: `data?.result ? 1 : 0`
- complianceFixes: `Array.isArray(data?.fixes) ? data.fixes.length : 0`

### 5k. Add audit logging to apply actions
`applySeoField`, `applyFaq`, `insertLinkSentence`, `insertHeadingScaffold`, `applyComplianceFix`, `applyRewrite` — stringify before/after consistently.

## Files Changed

| File | Scope |
|------|-------|
| Database migration | Create `blog_ai_telemetry` + `blog_ai_audit_log` with RLS |
| `supabase/functions/analyze-blog-compliance-fixes/index.ts` | Expanded whitelists, prompt, normalization, input |
| `supabase/functions/improve-blog-content/index.ts` | Add `generate-intro`, `generate-conclusion`, expand structure |
| `src/components/admin/BlogPostEditor.tsx` | Add `canonical_url` to formData/resetForm/openEditDialog/buildPostData |
| `src/components/admin/blog/BlogAITools.tsx` | Expanded apply modes, helpers, telemetry, audit, safeguards, validation |

## What is NOT changed
- No new edge functions
- No changes to `suggest-blog-internal-links`, `generate-blog-seo`, `generate-blog-faq`
- Existing working UI cards preserved
- Draft save unaffected
- AI provider unchanged (direct Gemini API)

