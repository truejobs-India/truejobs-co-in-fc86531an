

# Blog AI Tools Quality Upgrade — Plan

## Summary
Upgrade all 5 edge functions and BlogAITools.tsx to produce actionable, structured outputs with proper apply actions, following the 10 constraints from the user.

## Files to Change

### 1. `supabase/functions/suggest-blog-internal-links/index.ts`
- Add a hardcoded `KNOWN_SAFE_PATHS` array (~25 validated TrueJobs routes) used both in the prompt and as fallback
- Expand prompt to request `sentenceTemplate` and `suggestedPlacement` fields per suggestion
- Add `category`, `tags`, `slug` to accepted input (used in prompt context)
- After initial Gemini call, if fewer than 2 valid suggestions survive filtering, do a **fallback pass** that picks 3-4 from `KNOWN_SAFE_PATHS` based on simple keyword matching against article title/content — no second Gemini call, no fabricated paths
- Output schema: `{ path, anchorText, reason, sentenceTemplate, suggestedPlacement }`

### 2. `supabase/functions/analyze-blog-compliance-fixes/index.ts`
- Accept additional context: `slug`, `existingMeta` object (meta_title, meta_description, excerpt, featured_image_alt, cover_image_url presence, author_name, faqCount, internalLinkCount)
- Upgrade prompt to request structured output: `{ issueKey, issueLabel, priority, fixType, field, suggestedValue, explanation, applyMode }`
- Server-side normalization: whitelist `fixType` to `metadata | content-block | rewrite | advisory`, whitelist `applyMode` to `field | append | review-and-replace | manual`, whitelist `field` to known editable fields (`meta_title`, `meta_description`, `excerpt`, `featured_image_alt`, `author_name`). Unknown values downgrade to `fixType: "advisory"`, `applyMode: "manual"`

### 3. `supabase/functions/improve-blog-content/index.ts`
- For `structure` action: accept `headings`, `hasIntro`, `hasConclusion`, `wordCount`
- Upgrade output schema to: `{ result, changes[], proposedOutline[], missingSections[] }`
- `proposedOutline` is an ordered array of heading strings; `missingSections` lists sections to add

### 4. `supabase/functions/generate-blog-faq/index.ts`
- Accept `category`, `tags`, `slug` for better prompt context

### 5. `supabase/functions/generate-blog-seo/index.ts`
- Accept `slug`, `category`, `tags` in single mode for better keyword targeting in prompts

### 6. `src/components/admin/blog/BlogAITools.tsx` — Major UI upgrade

**Props change:** Add `category?: string | null` and `tags?: string[] | null` to `formData` interface.

**Richer payloads:** Pass `slug`, `category`, `tags` to all edge function calls. Pass `headings`, `hasIntro`, `hasConclusion`, `wordCount` from `currentMetadata` to structure call. Pass `existingMeta` context to compliance call. Use optional chaining — never block tool execution if analyzer data is null.

**Internal Links result UI:**
- Per suggestion: show path badge, anchor text, reason, sentence template with embedded link
- "Insert Sentence" button inserts the full `sentenceTemplate` with `<a href="path">anchorText</a>` embedded — NOT a bare `<a>` tag
- "Copy Sentence" button copies the template text to clipboard
- If 0 valid suggestions after filtering: show explanation ("No safe page paths could be confirmed for this article"), retry button, and generic linking guidance text
- Reuse existing `filterValidInternalLinks` as sole validator — no second relaxed validator

**Compliance Fixes result UI:**
- Render structured fix cards grouped by priority
- `fixType: "metadata"` + whitelisted field: show "Apply to Field" button (calls `onApplyField`)
- `fixType: "metadata"` + non-whitelisted field (e.g. `canonical_url`): show as structured suggestion only, no Apply button — because canonical_url is not in the editor's `formData`
- `fixType: "content-block"` + `applyMode: "append"`: show preview + "Append to Content" via editor instance
- `fixType: "rewrite"` + `applyMode: "review-and-replace"`: show target snippet + suggested replacement side-by-side (same pattern as Rewrite Selection), require explicit "Replace" click
- `fixType: "advisory"`: show as informational card, no action button

**Structure result UI:**
- Show `proposedOutline` as ordered heading list + `missingSections` list
- "Copy Outline" button
- "Insert Heading Scaffold" appends `<hr><h2>...</h2><p>[content here]</p>` for each outline item at the END of editor content (not overwriting), with clear separator

**FAQ result UI:**
- If `existingFaqCount > 0` AND content contains detectable FAQ markers (`<h2>` with "FAQ" or "Frequently Asked"): show "Append Additional FAQ", "Copy FAQ", "Dismiss"
- If FAQ detection is uncertain (no marker found even though count > 0): show only "Append Additional FAQ", "Copy FAQ", "Dismiss" — no "Replace FAQ"
- "Replace FAQ" only appears when an FAQ heading is reliably detected

### 7. `src/components/admin/BlogPostEditor.tsx`
- Pass `category` and `tags` from `editingPost` to `BlogAITools` formData (they exist on `BlogPost` but not currently in `formData`)

## Constraints honored
1. Insert Link inserts full sentence, not bare `<a>`
2. Fallback uses only hardcoded known-valid paths, never fabricated
3. `canonical_url` shown as suggestion-only (not in formData)
4. Rewrite-type compliance fixes use the same review workflow as Rewrite Selection
5. Structure scaffold appends below content with separator
6. "Replace FAQ" only when FAQ heading reliably detected
7. Analyzer outputs used via optional chaining, never blocking
8. Server-side whitelist for fixType/applyMode/field, unknown downgrades to advisory
9. Empty internal links state shows explanation + retry + guidance
10. Single validator (`filterValidInternalLinks`) remains source of truth

