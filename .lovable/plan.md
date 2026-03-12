

# Blog System: Gemini-Only + Markdown Support — Implementation Plan

## Dependency
Add `marked` package.

## 7 Files to Change

### 1. `supabase/functions/generate-blog-image/index.ts`
Replace lines 80–238 (three model strategies + alt-text block) with single Gemini 2.5 Flash call:

- Update top comment to "Uses only gemini-2.5-flash via direct Google API"
- Append `" Also provide a concise alt text description under 150 characters."` to `imagePrompt`
- Set `const modelUsed = "gemini-2.5-flash"`
- Single fetch to `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with `responseModalities: ["TEXT", "IMAGE"]`
- Loop `candidates[].content.parts[]`: first `inlineData` → image, first text 10–200 chars → alt
- Non-2xx with "not available"/"region"/"not supported" in error body → 422 `IMAGE_GEN_REGION_UNAVAILABLE`
- 2xx but no `inlineData` → same 422
- Other fetch/Gemini errors → 500 with actual message
- Keep lines 1–79 (auth/validation/prompt) and 240–280 (upload/response/catch) intact

### 2. `src/components/admin/blog/FeaturedImageGenerator.tsx`
Lines 47–48: Insert region check before `if (!data?.imageUrl)`:
```typescript
if (data?.code === 'IMAGE_GEN_REGION_UNAVAILABLE') {
  toast({ title: 'Region unavailable', description: 'AI cover image generation is currently unavailable in the deployed edge region. Please upload a cover image manually.', variant: 'destructive' });
  return;
}
```

### 3. `src/lib/blogParser.ts`
- Add `import { marked } from 'marked'` and `import DOMPurify from 'dompurify'`
- Add `sourceFormat?: 'docx' | 'md'` to `ParsedArticle`
- Rename `parseDocxFile` → `parseDocxFileInternal` (private), add `sourceFormat: 'docx'` to return
- Add `parseMarkdownFileInternal(file, existingSlugs)`: frontmatter extraction via `/^---\n([\s\S]*?)\n---/`, manual key:value parsing, `marked.parse()` → `DOMPurify.sanitize()` → same DOMParser + helpers, frontmatter overrides derived values, preserve `coverImageAlt` from frontmatter, `sourceFormat: 'md'`
- Add `parseArticleFile(file, existingSlugs)` routing by extension
- Export `parseArticleFile` and `const parseDocxFile = parseArticleFile`

### 4. `src/components/admin/bulk-blog/UploadZone.tsx`
- Import `parseArticleFile` and `supabase`
- Filter: `ext === 'docx' || ext === 'md'`
- Error: "Only .docx and .md files are supported"
- Use `parseArticleFile` in loop
- After parsing, collect `.md` articles needing covers (sourceFormat === 'md', no coverImageUrl, has title+slug)
- Concurrency-3 semaphore + `Promise.allSettled` for auto-cover
- On success: set coverImageUrl, coverImageAlt only if not already from frontmatter, extraction.coverImage = 'green'
- After all settled: one summary toast for failures
- Update accept, drag text, support text

### 5. `src/components/admin/blog/WordFileImporter.tsx`
- Import `parseArticleFile`, `ParsedArticle`
- Accept `.docx` and `.md` only
- Add props: `onArticleParsed?`, `onCoverGenerated?`
- For `.md`: `parseArticleFile()` → `onImport(article.content)` → `onArticleParsed?.(article)` → if title+slug, attempt cover gen → `onCoverGenerated?.(url, alt)` on success, toast warning on failure
- For `.docx`: keep mammoth flow unchanged
- Update label, accept, error text

### 6. `src/components/admin/BulkBlogUpload.tsx`
Line 174: "Upload .docx or .md files. SEO data extracted automatically."

### 7. `src/components/admin/bulk-blog/ArticleQueue.tsx`
Line 52: "Upload .docx or .md files to get started"

## After Implementation
- Redeploy `generate-blog-image`
- Verify build

