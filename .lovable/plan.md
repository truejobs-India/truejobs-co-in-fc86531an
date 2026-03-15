

# Implementation Plan: Dual-Model Blog Image System

## Files to Create/Modify

### 1. NEW: `src/lib/blogInlineImages.ts`

HTML-aware inline image utilities:

- **`detectInlineSlots(html: string, articleImages?: any)`**: Returns `InlineSlotStatus` with `slot1Filled`, `slot2Filled`, `totalParagraphs`, `canPlaceSlot1` (>=2 paragraphs), `canPlaceSlot2` (>=5 paragraphs), `skipReasons[]`.
  - Primary detection: search for `data-inline-slot="1"` / `data-inline-slot="2"` in HTML.
  - Fallback: check `articleImages?.inline` JSON for matching slot URLs.
  - Invalid URL detection: empty, whitespace, contains `placeholder`, `example.com`, `no-image`.
- **Paragraph counting**: Split HTML on closing block-level tags (`</p>`, `</div>`, `</blockquote>`, `</ul>`, `</ol>`, `</table>`, `</section>`). Count only blocks with >20 chars of stripped text as "substantial paragraphs." If structure is ambiguous or heavily malformed (e.g. no closing tags found), return `canPlaceSlot1: false` with skip reason.
- **`insertInlineImage(html, slotNumber, imgUrl, altText)`**: Find the nth substantial block's closing tag, insert `<figure class="inline-article-image" data-inline-slot="N"><img src="..." alt="..." loading="lazy" /></figure>` after it. If slot tag already exists, return html unchanged. If target paragraph not found, return null (caller handles skip).
- **`getContextForSlot(html, slotNumber, title, category)`**: Extract ~300 chars of text around target paragraph + nearest preceding `<h2>`/`<h3>` heading. Returns `{ nearbyText, nearbyHeading, articleTitle, category }`.
- **`isInvalidImageUrl(url)`**: Shared helper for cover + inline. Checks empty/null/whitespace, placeholder patterns, broken path patterns.

### 2. UPDATE: `supabase/functions/generate-vertex-image/index.ts`

- Accept new body fields: `purpose: "cover" | "inline"`, `contextSnippet: string`, `slotNumber: number`.
- Add `buildInlineImagePrompt(body)` function: uses title + contextSnippet + nearby heading for contextual editorial illustration prompt. Different tone from cover prompt.
- In handler: if `purpose === "inline"`, force `model` to Imagen path, use `aspectRatio: "4:3"`, use inline prompt builder, upload to `inline/{slug}-slot{slotNumber}.{ext}`.
- If `purpose === "cover"`, force `model` to Gemini Flash Image path, keep existing cover prompt + `16:9`.
- If no `purpose` specified, use existing routing (backward compatible).
- Add logging: `purpose`, `slotNumber`, `model`, `provider_branch`.

### 3. UPDATE: `src/components/admin/BlogPostEditor.tsx`

**New state:**
- `isBulkInlineRunning`, `bulkInlineProgress` (same shape as cover), `bulkInlineAbortRef`
- `perArticleLoading: Record<string, 'cover' | 'inline' | null>`

**Modify `handleBulkGenerateCoverImages`:**
- Hardcode `model: 'gemini-flash-image'` and `purpose: 'cover'` (ignoring selector).
- Add broken-URL detection via `isInvalidImageUrl()` alongside null/empty check.

**New `handleBulkGenerateInlineImages`:**
- Fetch all posts with `id, title, slug, content, category, tags, article_images`.
- For each post, run `detectInlineSlots(content, article_images)`.
- Skip fully-filled posts. Skip posts where structure is ambiguous.
- For each missing slot: call `generate-vertex-image` with `model: 'vertex-imagen'`, `purpose: 'inline'`, `slotNumber`, `contextSnippet` from `getContextForSlot()`.
- Insert `<figure>` via `insertInlineImage()`. If insertion returns null, skip with reason.
- Update `content` and `article_images` JSON in `blog_posts`.
- 3s delay, abort control, progress display with partial outcome reporting.

**New per-article buttons in table row (lines ~1447-1488):**
- Cover button: `ImageIcon`, generates via `gemini-flash-image` + `purpose: 'cover'` if `isInvalidImageUrl(post.cover_image_url)`. Green check if valid.
- Inline button: `Sparkles` icon with slot count badge (0/2, 1/2, 2/2). Generates missing slots via `vertex-imagen` + `purpose: 'inline'`. Reports partial outcomes via toast (e.g. "Slot 1 generated, slot 2 skipped: only 3 paragraphs").

**New "Inline" table column** (after Cover column): Shows slot status derived from content scan using `detectInlineSlots()`.

**New bulk inline button** in SEO Utility Toolbar (after cover button): "Generate Pending In-Between Images" with stop control.

**`article_images` sync:** After inserting inline images, write/merge JSON:
```json
{ "inline": [{ "slot": 1, "afterParagraph": 1, "url": "...", "alt": "...", "generatedAt": "ISO" }] }
```

### 4. No database migration needed
`article_images` JSON column already exists on `blog_posts`.

## Key Design Decisions

- **Source of truth**: `data-inline-slot` attributes in HTML content are primary. `article_images` JSON is synchronized metadata/cache.
- **Safety**: If HTML parsing yields ambiguous structure (no closing block tags found, or fewer than expected), skip with clear reason rather than forcing placement.
- **Broken image detection**: Only obvious-invalid patterns (null, empty, whitespace, known placeholder strings). No HTTP HEAD validation.
- **Model enforcement**: Cover buttons always use `gemini-flash-image`, inline buttons always use `vertex-imagen`, regardless of the manual selector dropdown.
- **Partial outcomes**: Per-article inline generation reports each slot result individually via toast.
- **Rendering**: `<figure class="inline-article-image" data-inline-slot="N">` is natively handled by Tailwind `prose` class used in blog content renderer.

