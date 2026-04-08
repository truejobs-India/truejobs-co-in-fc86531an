

# Fix: Literal `\n` Artifacts Leaking Into Blog Article Rendering

## Root Cause

The AI content generator outputs HTML with literal newline characters embedded inside tags — for example `<p>\n</p>`, `<p> \n\n</p>`, `<li><p>\n</p></li>`. These are stored as-is in the `content` column. 657 out of 659 published articles are affected.

The existing cleanup on line 173 of `BlogPost.tsx` only handles `\\n` (backslash-n escape sequences), not actual newline characters inside HTML tags. Since `isRichHTML` detects `<p>` tags and takes the HTML-passthrough branch, the newline-only paragraphs render as visible whitespace artifacts.

## Fix Strategy

Two-layer approach: fix rendering (immediate) + fix generation (prevent future articles from having the same issue).

### 1. Rendering fix — `src/pages/blog/BlogPost.tsx` → `renderContent()`

After line 174, add HTML cleanup that:
- Removes empty `<p>` tags that contain only whitespace/newlines: `<p>\n</p>`, `<p> \n\n</p>`, `<p></p>`
- Removes empty `<li><p>\n</p></li>` list items (these create blank bullet points)
- Collapses excessive whitespace between HTML tags
- Does NOT touch `<p>` tags that have actual text content

This runs before the `isRichHTML` check so both branches benefit.

### 2. Generation fix — `supabase/functions/generate-blog-article/index.ts`

Add a post-processing sanitization step after extracting the `content` field from the AI response. Before saving to the database, strip:
- `<p>` tags containing only whitespace
- Empty `<li>` wrappers
- Excessive whitespace between tags

This prevents future articles from storing the artifacts.

### 3. Also patch `EnrichedSection.tsx`

The HTML branch uses `dangerouslySetInnerHTML` without stripping empty paragraphs — add the same cleanup there.

## Detailed Changes

| File | Change |
|---|---|
| `src/pages/blog/BlogPost.tsx` | Add HTML sanitization regex after line 174 to strip empty `<p>`, empty `<li>` wrappers, and inter-tag whitespace |
| `supabase/functions/generate-blog-article/index.ts` | Add `sanitizeGeneratedHtml()` helper; apply it to extracted content before DB insert |
| `src/components/govt/EnrichedSection.tsx` | Apply same empty-tag cleanup in the HTML rendering branch |

No routing, storage, model selection, or other systems are affected.

