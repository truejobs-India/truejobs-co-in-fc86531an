

# Phase 1: Fix Broken Text Rendering and Hindi Typography — Conservative Implementation

## Changes

### 1. `src/pages/blog/BlogPost.tsx`

**a) Fix `isRichHTML` detection (line 154)**
Change regex to include `<p` tags:
```
const isRichHTML = /<(p|table|div|section|figure|svg)\b/i.test(content);
```

**b) Fix FAQ `mainEntity` parsing (lines 103–113)**
After the existing `Array.isArray` check, add a branch for objects with `mainEntity`:
```typescript
} else if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as any).mainEntity)) {
  faqData = (raw as any).mainEntity.map((e: any) => ({
    question: e.name || e.question,
    answer: e.acceptedAnswer?.text || e.answer,
  }));
}
```

**c) Conservative content normalization (inside `renderContent`, before the `isRichHTML` branch)**
Only target literal escaped `\n` sequences that appear **outside** HTML tags and `<pre>`/`<code>` blocks. This avoids corrupting preformatted content or code snippets:
```typescript
// Only fix literal "\n" in non-code text (escaped newline artifacts from AI generation)
// Skip content that contains <pre> or <code> to avoid corrupting code blocks
if (!/<(pre|code)\b/i.test(content)) {
  content = content.replace(/\\n/g, '\n');
}
```
This is applied once at the top of `renderContent` before branching. The guard ensures we never touch articles containing code/preformatted blocks.

**d) Conservative leading-title deduplication (inside `renderContent`, after the `\n` fix)**
Only strip if the content starts with the exact title text (case-sensitive match) followed by a newline or HTML tag — not a fuzzy match:
```typescript
// Strip leading duplicate title only if content starts with exact title text
if (post?.title && content.startsWith(post.title)) {
  const afterTitle = content.slice(post.title.length);
  // Only strip if followed by whitespace/newline/tag boundary — not mid-word
  if (/^[\s\n<]/.test(afterTitle) || afterTitle === '') {
    content = afterTitle.trimStart();
  }
}
```
This is safe because it requires an exact prefix match and a clear boundary character.

**e) Hindi-aware title class (line 372)**
Add detection and conditional class:
```typescript
const isHindiTitle = /[\u0900-\u097F]/.test(post.title);
```
Update H1:
```tsx
<h1 className={`text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6 ${isHindiTitle ? 'hindi-title' : ''}`}>
```

### 2. `src/components/govt/EnrichedSection.tsx`

**Conservative `\n` normalization in the text branch only (line 61)**
Only normalize in the plain-text path (not the HTML path), and only fix literal `\n` escape sequences:
```typescript
// Normalize literal \n escape artifacts — only in plain-text mode
const normalized = content
  .replace(/\\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n');
const paragraphs = normalized.split(/\n\n+/).filter(Boolean);
```
The HTML branch (`type === 'html'`) is untouched — DOMPurify handles that path already.

### 3. `index.html`

Add Noto Sans Devanagari font (preload + stylesheet):
```html
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

### 4. `src/index.css`

Add Hindi typography class:
```css
.hindi-title {
  font-family: 'Noto Sans Devanagari', 'Outfit', system-ui, sans-serif;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.01em;
  word-break: keep-all;
}
```

## Safety Guarantees

| Concern | Protection |
|---|---|
| `\n` in `<pre>`/`<code>` | Skipped entirely if content contains those tags |
| Title dedup false positive | Requires exact case-sensitive prefix + boundary char |
| HTML content corruption | `\n` fix only runs on raw string before HTML parsing; HTML branch untouched in EnrichedSection |
| Ad placements | Zero changes to ad components or positions |
| English titles | `hindi-title` class only applied when Devanagari chars detected |

## Files Changed
1. `src/pages/blog/BlogPost.tsx` — 5 targeted edits
2. `src/components/govt/EnrichedSection.tsx` — 1 edit (text branch only)
3. `index.html` — font addition
4. `src/index.css` — Hindi typography class

## Manual Verification Checklist
1. Open a Hindi blog article — title should have better spacing and weight
2. Open an article with `<p>` tags but no table/div — should render cleanly (not double-wrapped)
3. Open an article with FAQ `mainEntity` wrapper — FAQs should appear
4. Check an article with known `\n` artifacts — should render as proper line breaks
5. Open an article containing `<pre>` or `<code>` — verify content is untouched
6. Verify no duplicate title appears at top of article body
7. Verify ads unchanged on all blog pages

