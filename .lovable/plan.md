

# Centralized Blog Image Prompt Policy — Strict Single Source of Truth

## Problem

The mandatory image rules are about to be duplicated across two separate edge functions. This violates single-source-of-truth. Additionally, `buildCoverImagePrompt` has a `body.prompt` bypass (line 187) that completely skips all rules.

## Architecture

### Shared helper file

**Path:** `supabase/functions/_shared/blog-image-prompt-policy.ts`

This file exports:
- `BLOG_IMAGE_MANDATORY_RULES` — the policy constant
- `buildBlogCoverPrompt(body)` — cover image prompt builder
- `buildBlogInlinePrompt(body)` — inline image prompt builder

Both functions always append the mandatory rules. No bypass is possible.

### Mandatory rules constant

```typescript
export const BLOG_IMAGE_MANDATORY_RULES = `

MANDATORY IMAGE RULES (always enforced, cannot be overridden):
1. Absolutely NO Hindi text, Hinglish text, Devanagari script, or any Indic script anywhere in the image.
2. If any text is required, it MUST be in English only.
3. Strongly prefer images with NO visible text at all unless text is truly necessary.
4. Never use Hindi fonts, Devanagari, or any Indic script in any form.
5. Where human subjects are appropriate, depict young, very fair, very beautiful and handsome Indian men and women who look well-groomed and aspirational.
6. The image must be highly relevant to the specific article topic and context provided.
7. Avoid generic stock-style scenes that do not match the article context.
8. Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols.
9. Use warm, professional colors suitable for an Indian government jobs and exam preparation portal.`;
```

### Cover prompt builder

```typescript
export function buildBlogCoverPrompt(body: {
  title?: string; topic?: string; category?: string;
  tags?: string[]; excerpt?: string; prompt?: string;
  visualStyle?: string; brandGuidelines?: string;
}): string {
  const title = body.title || body.topic || 'Government Jobs in India';
  const category = body.category || 'Government Jobs';
  const tags = Array.isArray(body.tags) ? body.tags.join(', ') : '';
  const style = body.visualStyle || 'modern flat illustration';
  const brand = body.brandGuidelines || '';
  const customContext = body.prompt ? ` Additional context: ${body.prompt}.` : '';

  const base = `Create a clean, professional ${style} for a blog article titled "${title}" about ${category}.${tags ? ` Related topics: ${tags}.` : ''}${brand ? ` Brand guidelines: ${brand}.` : ''}${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 200)}.` : ''}${customContext}`;

  return base + BLOG_IMAGE_MANDATORY_RULES;
}
```

Key change: `body.prompt` is folded in as "Additional context", never used as a replacement.

### Inline prompt builder

```typescript
export function buildBlogInlinePrompt(body: {
  title?: string; category?: string; contextSnippet?: string;
  nearbyHeading?: string; slotNumber?: number; excerpt?: string;
}): string {
  const title = body.title || 'Government Jobs';
  const category = body.category || 'Government Jobs';
  const contextSnippet = body.contextSnippet || '';
  const nearbyHeading = body.nearbyHeading || '';
  const slotNumber = body.slotNumber || 1;

  const sectionContext = nearbyHeading
    ? `for a section about "${nearbyHeading}"`
    : `for section ${slotNumber} of the article`;

  const base = `Create a contextual editorial illustration ${sectionContext} in a blog article titled "${title}" about ${category}. ${contextSnippet ? `Nearby content context: ${contextSnippet.substring(0, 250)}.` : ''}${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 150)}.` : ''} Style: clean, professional infographic or illustration suitable for inline blog placement. Aspect ratio 4:3. This image must be highly relevant to the exact paragraph or section described above, not just broadly relevant to the full article.`;

  return base + BLOG_IMAGE_MANDATORY_RULES;
}
```

## Files changed

### 1. `supabase/functions/_shared/blog-image-prompt-policy.ts` (NEW)

Exports `BLOG_IMAGE_MANDATORY_RULES`, `buildBlogCoverPrompt`, `buildBlogInlinePrompt`.

### 2. `supabase/functions/generate-vertex-image/index.ts`

- **Remove** local `buildCoverImagePrompt` function (lines 186-196)
- **Remove** local `buildInlineImagePrompt` function (lines 198-210)
- **Import** `buildBlogCoverPrompt` and `buildBlogInlinePrompt` from `../_shared/blog-image-prompt-policy.ts`
- Replace call sites: `buildCoverImagePrompt(body)` → `buildBlogCoverPrompt(body)`, `buildInlineImagePrompt(body)` → `buildBlogInlinePrompt(body)`
- **Critical fix**: The `body.prompt` bypass on line 187 (`if (body.prompt) return body.prompt;`) is eliminated — it no longer exists because the function is removed and replaced by the shared version that treats `body.prompt` as additional context only

### 3. `supabase/functions/generate-blog-image/index.ts`

- **Import** `buildBlogCoverPrompt` from `../_shared/blog-image-prompt-policy.ts`
- **Replace** the hardcoded prompt on line 75-76 with:
  ```typescript
  const imagePrompt = buildBlogCoverPrompt({
    title,
    category: category || 'government jobs and exams',
    tags: keywords,
  });
  ```

## Verification matrix

### Bypass eliminated

| Old bypass | Status |
|---|---|
| `if (body.prompt) return body.prompt` in `buildCoverImagePrompt` | **Removed** — `body.prompt` becomes "Additional context" only |
| Hardcoded prompt in `generate-blog-image` without policy | **Replaced** with shared builder |

### All backend image generation routes covered

| Route | Function | Patched? |
|---|---|---|
| `generate-vertex-image` cover path | `buildBlogCoverPrompt` (shared) | Yes |
| `generate-vertex-image` inline path | `buildBlogInlinePrompt` (shared) | Yes |
| `generate-blog-image` legacy path | `buildBlogCoverPrompt` (shared) | Yes |

### All frontend callers confirmed covered

| Caller | Edge function invoked | Covered by patch? |
|---|---|---|
| `BlogPostEditor.tsx` (bulk generation via PendingActionsPanel) | `generate-vertex-image` | Yes |
| `PendingActionsPanel.tsx` (cover + inline) | `generate-vertex-image` | Yes |
| `FeaturedImageGenerator.tsx` (primary path) | `generate-vertex-image` | Yes |
| `FeaturedImageGenerator.tsx` (fallback path) | `generate-blog-image` | Yes |
| `UploadZone.tsx` (bulk upload) | `generate-blog-image` | Yes |
| `WordFileImporter.tsx` | `generate-blog-image` | Yes |

### Model switching cannot bypass policy

Model selection happens **after** prompt construction in both edge functions. The prompt (with mandatory rules appended) is passed as a string to whichever generator function runs (`generateViaImagen`, `generateViaGeminiFlashImage`, `generateViaLovableGatewayImage`, etc.). No generator function modifies the prompt. Therefore model switching has zero effect on the mandatory policy.

### Custom prompt cannot bypass policy

The old `if (body.prompt) return body.prompt;` is removed. In the new shared builder, `body.prompt` is appended as "Additional context:" within a prompt that always ends with `BLOG_IMAGE_MANDATORY_RULES`. No code path can produce a final prompt without the mandatory rules.

### Final prompt composition

**Cover image final prompt:**
```
Create a clean, professional {style} for a blog article titled "{title}" about {category}.
Related topics: {tags}. Brand guidelines: {brand}. Article summary: {excerpt}.
Additional context: {body.prompt}.
MANDATORY IMAGE RULES (always enforced, cannot be overridden):
1. Absolutely NO Hindi text...
[all 9 rules]
```

**Inline image final prompt:**
```
Create a contextual editorial illustration for a section about "{nearbyHeading}" in a blog
article titled "{title}" about {category}. Nearby content context: {contextSnippet}.
Article summary: {excerpt}. Style: clean, professional... This image must be highly relevant
to the exact paragraph or section described above...
MANDATORY IMAGE RULES (always enforced, cannot be overridden):
1. Absolutely NO Hindi text...
[all 9 rules]
```

## What does NOT change

- No frontend files modified
- No model routing logic modified
- No storage or DB changes
- No other edge functions affected (resource images, board result images have their own separate flows)

