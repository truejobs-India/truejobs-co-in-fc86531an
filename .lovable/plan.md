

# Phase 2 Plan: Internal Links Auto-Apply

## Root Cause

The AI prompt instructs Gemini to use `replace_section` for internal-link fixes. The `handleFixAll` loop has no auto-apply handler for `replace_section` — it falls through to `reviewRequired`. This means every internal-link fix requires manual review, even though the actual fix is just adding a few links.

## Strategy

Convert internal-link fixes from destructive `replace_section` to safe additive `append_content`, then allow the fixAll loop to auto-apply them with strict validation and sanitization.

## Changes

### File 1: `supabase/functions/analyze-blog-compliance-fixes/index.ts`

**A. Prompt update (lines 163-164)**

Add explicit instruction:
```
- For internal link fixes: use fixType "internal_links" with applyMode "append_content". Return suggestedValue as a small HTML block with heading "Related Resources" containing 3-5 internal link items as an unordered list. Do NOT use replace_section for internal links.
```

**B. Server-side safety net in `normalizeFix` (after line 87)**

If `fixType === 'internal_links'` and `applyMode` is `replace_section` or `review_replacement`, force it to `append_content`. This ensures even if the AI ignores the prompt instruction, internal links never use destructive modes.

### File 2: `src/components/admin/blog/BlogAITools.tsx`

**C. Add import for `isValidInternalPagePath` (line 4)**

Update existing import from `blogLinkValidator` to also import `isValidInternalPagePath`.

**D. Add HTML sanitizer helper (~line 165)**

Small function `sanitizeLinkBlockHtml(html: string): string` that:
- Parses with regex (no DOM needed for this tiny subset)
- Allows only: `<h3>`, `<p>`, `<ul>`, `<li>`, `<a href="...">` 
- Strips all attributes except `href` on `<a>` tags
- Removes `<script>`, `<style>`, event handlers, `<iframe>`, `<img>`, etc.
- Returns cleaned HTML or empty string if nothing valid remains

**E. Add link extraction + dedup helpers (~line 175)**

```typescript
function extractHrefsFromHtml(html: string): string[] {
  // Returns all href values from <a> tags
}

function linkAlreadyInContent(content: string, href: string): boolean {
  // Checks if article already contains an <a> pointing to this href
}

function hasRelatedResourcesBlock(content: string): boolean {
  // Checks if article already has a "Related Resources" or "Related Articles" heading
}
```

**F. Internal links handler in fixAll loop (after line 571, before `reviewRequired.push`)**

Add a new block in the else branch:
```typescript
const APPEND_ALLOWLIST = new Set(['conclusion', 'faq', 'content-block', 'internal_links']);
```

For `internal_links` specifically within the `append_content` path:
1. Check `hasRelatedResourcesBlock` — skip if already exists
2. Sanitize the AI HTML with `sanitizeLinkBlockHtml`
3. Extract all hrefs from sanitized HTML
4. Filter: keep only hrefs passing `isValidInternalPagePath`
5. Filter: remove hrefs already in `formData.content` via `linkAlreadyInContent`
6. Cap at 6 links max
7. If 0 valid new links remain → skip silently
8. Rebuild clean HTML block with only valid new links
9. Append via `editorInstance.commands.insertContent`
10. Log audit entry
11. Push to `autoFixed`

**G. `contentBlockAlreadyExists` guard still applies** — prevents exact duplicate blocks on re-run.

## Sanitization Rules

| Allowed | Blocked |
|---------|---------|
| `<h3>`, `<p>`, `<ul>`, `<li>`, `<a>` | `<script>`, `<style>`, `<iframe>`, `<img>`, `<div>`, `<span>`, all others |
| `href` attribute on `<a>` only | `onclick`, `onload`, `class`, `style`, `id`, `data-*`, all other attributes |
| Relative paths starting with `/` | `javascript:`, `mailto:`, `tel:`, `data:`, full URLs, empty hrefs |

## Validation Rules

1. Path must pass `isValidInternalPagePath` (existing validator)
2. No external URLs (blocked by validator)
3. No duplicate hrefs within the block
4. No hrefs already present in article content
5. Max 6 links per block
6. Block must have at least 1 valid link to insert

## Internal Links Flow

```text
Edge function prompt → AI returns:
  fixType: "internal_links"
  applyMode: "append_content"    ← forced by prompt + server normalization
  suggestedValue: "<h3>Related Resources</h3><ul><li>...</li></ul>"

Frontend fixAll loop:
  1. Match: mode=append_content, fixType=internal_links
  2. Guard: hasRelatedResourcesBlock → skip if exists
  3. Sanitize HTML (whitelist tags only)
  4. Extract hrefs → validate each with isValidInternalPagePath
  5. Deduplicate against existing article content
  6. Cap at 6 links
  7. Rebuild clean HTML with valid links only
  8. Append to article end
  9. Audit log + autoFixed
```

## Files Modified

1. `supabase/functions/analyze-blog-compliance-fixes/index.ts` — prompt + normalization safety net
2. `src/components/admin/blog/BlogAITools.tsx` — sanitizer, validators, fixAll handler for internal_links

## Regression Checklist

1. `internal_links` with `append_content` → auto-applies clean link block
2. Duplicate links not added (checked against existing content)
3. Invalid/external links rejected by `isValidInternalPagePath`
4. Unsafe HTML sanitized (scripts, styles, event handlers stripped)
5. Running Fix All twice → `hasRelatedResourcesBlock` + `contentBlockAlreadyExists` prevent duplication
6. `replace_section` for non-link fixes → still goes to `reviewRequired`
7. Existing intro/FAQ/conclusion auto-apply (Phase 1) unaffected
8. Max 6 links enforced
9. Empty/all-duplicate results → silent skip, no broken HTML inserted

