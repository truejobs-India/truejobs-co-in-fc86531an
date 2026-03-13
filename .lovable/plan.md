

# Blog AI Tools + Analyzer Transparency — Final Plan v4

Five minor corrections applied to the approved v3 plan:

## Corrections

### 1. File count fix
Part G: **New (7)** — 5 edge functions + `BlogAITools.tsx` + `BlogScoreBreakdown.tsx`.

### 2. Safe editor callback with teardown cleanup
`RichTextEditor` will use:
```tsx
onEditorReady?: (editor: Editor | null) => void
```
On mount/editor-ready: `onEditorReady(editor)`. On unmount (useEffect cleanup): `onEditorReady(null)`. This prevents stale references in `BlogAITools` — rewrite selection checks `if (!editorInstance)` before proceeding.

### 3. ParsedArticle.faqCount confirmed
`ParsedArticle` in `blogParser.ts` line 21 defines `faqCount: number`. The bulk flow's `parsedToMeta()` already maps it at line 44 of `ArticleEditPanel.tsx`. No change needed — the existing plumbing is correct.

### 4. SEO tab uses seo.totalScore directly
The analyzer at `blogArticleAnalyzer.ts` line 328 already computes `totalScore = Math.round((passCount / checks.length) * 100)`. The SEO tab in `BlogScoreBreakdown` will display `seo.totalScore` as the single source of truth and will NOT recompute from passCount/totalChecks. The formula note will read: "Score derived from pass rate across all checks" for transparency.

### 5. Content append uses editor instance, not stale formData
`BlogAITools` FAQ append will NOT do `formData.content + html`. Instead:
- If `editorInstance` is available: `editorInstance.commands.insertContent(faqHtml)` at the end of the document
- The editor's `onUpdate` callback will propagate the change to form state naturally
- This ensures the append always operates on the live editor content, not potentially stale React state

All other aspects of the v3 plan remain unchanged. Ready for implementation.

