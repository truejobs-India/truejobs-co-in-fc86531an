

# Prompt 4 Implementation: SEO Validation & Consistency Layer

## Scope
Create a validation engine, summary dashboard, page-level report modal, and export utility. Add a "Validation" tab to the existing SEO Cache Manager. Handle missing-cache pages as a distinct validation state, show last-run timestamp, and keep rebuild vs revalidate actions visually distinct.

## Files to Create (4)

### 1. `src/components/admin/seo-cache/seoValidationEngine.ts`
Core validation logic:

- **EXPECTED_INDEXABILITY** map: `deadline-today/week/month` → noindex; all others → index
- **BREADCRUMB_EXPECTED_TYPES** set: all types except standalone and deadline-*
- **JOB_POSTING_PAGE_TYPES** whitelist: reuse from existing cacheValidation.ts
- **jaccardWordSimilarity(a, b)**: lowercase, strip punctuation, word-set Jaccard coefficient
- **extractTextFromHtml(html)**: strip tags, return plain text
- **extractH1(body)**: regex extract H1 content text
- **extractTitle(head)**: regex extract title text
- **extractCanonical(head)**: regex
- **extractRobotsContent(head)**: regex
- **countFaqInHtml(html)**: count FAQPage question items in JSON-LD
- **extractInternalSlugs(body)**: extract hrefs starting with / or SITE_URL, normalize to slug

**`validatePage(page: CachePage): PageValidationReport`**:
- If `page.status === 'missing'` (no cached HTML): return a single fail check "Page not cached — no HTML to validate" with fix "Rebuild this page". Skip all other checks. This avoids false failures from running HTML checks on null content.
- Otherwise, run all checks below grouped by category:

**SEO Basics** checks:
- title-present, meta-desc-present, canonical-present
- self-canonical-correct: compare to `SITE_URL/{slug}`
- robots-indexability-correct: compare to EXPECTED_INDEXABILITY map. Unknown page types → info "Unknown page type, defaulting to index expectation"
- crawlable-links-present

**Schema** checks:
- breadcrumb-expected: if page type in BREADCRUMB_EXPECTED_TYPES and no BreadcrumbList schema → warning
- faq-schema-expected: if inventory has faqItems.length > 0 and no FAQPage schema → warning
- job-posting-valid: JobPosting only on whitelist types
- schema-parseable: all JSON-LD blocks parseable

**Content Quality** checks:
- content-word-count: >100 pass, 50-100 warning, <50 fail
- internal-links-present: if inventory has crossLinks but body has 0 internal links → warning
- stale-threshold: DB-backed (blog/govt-exam/employment-news) >7d warn/>30d fail; programmatic >30d warn/>90d fail

**Consistency** checks (only run if inventoryEntry exists):
- title-intent: Jaccard of cached title vs inventory title. Detail: "Similarity: 0.72 (pass >= 0.60)". Pass >=0.6, warn 0.3-0.6, fail <0.3
- h1-match: Jaccard of cached H1 vs inventory h1. Pass >=0.5, warn 0.25-0.5, fail <0.25
- faq-count-match: exact pass, ±1 warn, >=2 fail
- internal-links-overlap: Jaccard of slug sets. >=0.5 pass, 0.25-0.5 warn, <0.25 info
- canonical-consistency: cached canonical vs expected
- major-mismatch: composite of applicable checks only (title+H1 always; FAQ only if inventory has items; breadcrumb only if expected type). 3+ fails → fail, 2 → warning

Each check returns `{ id, label, severity, detail, fix, category }`.

**`async validateAllPages(pages, loadHtmlFn, onProgress): Promise<PageValidationReport[]>`**:
- Process in batches of 10
- For missing pages: return missing-page report without loading HTML
- For cached pages: load HTML via loadHtmlFn, run validatePage
- Call `onProgress(completed, total)` after each batch
- `await new Promise(r => setTimeout(r, 0))` between batches for UI responsiveness

### 2. `src/components/admin/seo-cache/SEOValidationDashboard.tsx`
Receives props: `allMergedPages`, `inventory`, `loadPageHtml`, `handleRebuildSlugs`

**State**: `reports: PageValidationReport[]`, `isRunning`, `progress: {done, total}`, `lastRunAt: Date | null`, `dismissedSlugs: Set<string>`, `showAllPages: boolean`, filter dropdowns for severity/category/issueType

**Layout**:
- Header: "Run Full Validation" button (with progress bar when running), last run timestamp ("Last validated: 2 min ago"), Export CSV / Export JSON buttons
- Overview cards: Total Validated, Pass, Warning, Fail counts
- Category breakdown: 4 mini-cards (SEO Basics / Schema / Content Quality / Consistency) each with fail + warn counts
- Top Issues: sorted list of issue types by frequency (e.g., "Content thin: 12, Missing breadcrumb: 8")
- Filter bar: severity dropdown, category dropdown, issue type dropdown
- Toggle: "Show all pages" switch (default off = issues only)
- Results table: Slug, Page Type, Issues count, Worst Severity (icon), Actions
  - Actions column has two visually distinct buttons:
    - "View Report" (outlined, eye icon) — opens ValidationPageReport modal
    - "Rebuild" (secondary, wrench icon) — triggers handleRebuildSlugs
  - Dismissed rows shown with reduced opacity, can be un-dismissed
- Bulk actions bar (when rows selected): Rebuild Selected, Revalidate Selected

### 3. `src/components/admin/seo-cache/ValidationPageReport.tsx`
Dialog modal. Props: `report: PageValidationReport | null`, `open`, `onClose`, `onRebuild`, `onRevalidate`, `onDismiss`

- Header: slug, page type, summary (X pass, Y warn, Z fail)
- Checks grouped by category with section headers
- Each check: severity icon (green check / yellow triangle / red X), label, detail text, fix recommendation text in muted style
- Footer actions — visually distinct:
  - "Rebuild Page" button (secondary color, wrench icon) — calls onRebuild
  - "Revalidate" button (outline, refresh icon) — calls onRevalidate
  - "Dismiss until next run" button (ghost, with tooltip: "Temporarily hides this page from the issues list. Resets when validation is re-run.")

### 4. `src/components/admin/seo-cache/validationExport.ts`
- `exportValidationCSV(reports, filename)`: one row per failing/warning check — columns: slug, pageType, severity, category, check_label, detail, recommended_fix
- `exportValidationJSON(reports, filename)`: full report array
- Both use the same `downloadBlob` pattern from existing cacheExport.ts

## Files to Modify (2)

### `src/components/admin/seo-cache/cacheTypes.ts`
Add at end:
```typescript
export type ValidationSeverity = 'pass' | 'warning' | 'fail';
export type ValidationCategory = 'seo-basics' | 'schema' | 'content-quality' | 'consistency';

export interface ValidationCheckResult {
  id: string;
  label: string;
  severity: ValidationSeverity;
  detail: string;
  fix: string;
  category: ValidationCategory;
}

export interface PageValidationReport {
  slug: string;
  pageType: string;
  title: string;
  checks: ValidationCheckResult[];
  worstSeverity: ValidationSeverity;
  failCount: number;
  warnCount: number;
  passCount: number;
}
```

### `src/components/admin/seo-cache/SEOCacheManager.tsx`
- Import SEOValidationDashboard
- Add "Validation" tab between "Global Audit" and "Build Log"
- Pass `allMergedPages`, `inventory`, `loadPageHtml`, `handleRebuildSlugs` as props

## Polish Items
- **Missing-cache pages**: detected early in `validatePage` — returns single "not cached" fail, skips HTML checks
- **Last run timestamp**: stored as `lastRunAt` state, displayed as relative time ("Last validated: 3 min ago")
- **Rebuild vs Revalidate distinction**: Rebuild uses secondary/wrench icon and triggers cache regeneration; Revalidate uses outline/refresh icon and re-runs validation checks only. Both in dashboard table and page report modal.
- **Unknown page types**: surfaced as info-level "Unknown page type, defaulting to index expectation"
- **Similarity scores in detail text**: e.g., "Similarity: 0.45 (warning threshold: 0.30-0.60)"
- **Default to issues-only view** with "Show all pages" toggle
- **Major mismatch composite**: only considers checks expected for the page type

