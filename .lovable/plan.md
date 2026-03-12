

# Prompt 5 Implementation: SEO Route Policy Registry & Admin Classification Dashboard

## Summary
Create the single-source-of-truth policy registry for route classification, with an admin dashboard showing evidence (why) and policy decisions (what) separately. Fallback-classified routes are treated as warnings requiring review.

## Files to Create (5)

### 1. `src/components/admin/seo-policy/seoRoutePolicyTypes.ts`
Shared types:
- `RouteCategory = 'public-seo' | 'public-noindex' | 'app-only'`
- `PolicySource = 'page-type-policy' | 'app-only-pattern' | 'fallback'`
- `PageTypePolicy { category, expectedIndexability, isCacheServed, includeInSitemap, breadcrumbExpected, schemaExpected[], notes? }`
- `EvidenceCriterion { key, label, passed, detail }` — input facts
- `PolicyOutput { category, expectedIndexability, includeInSitemap, isCacheServed, canonicalUrl, policySource }` — derived decisions
- `PolicyConflict { type, message, severity }`
- `EvaluatedRoute { slug, title, pageType, evidence[], policy, conflicts[], reasonSummary, evidencePassed, evidenceFailed }`

### 2. `src/components/admin/seo-policy/seoRoutePolicyRegistry.ts`
Central config:

- `PAGE_TYPE_POLICIES: Record<string, PageTypePolicy>` — one entry per type from `PAGE_TYPES` in cacheTypes.ts:
  - **public-seo** (index, cache, sitemap): standalone, city, state-govt, category, industry, department, qualification, blog, govt-exam, employment-news, all authority-*, exam-hub, previous-year-paper, all custom-*, all combo-*, selection-state, discovery-hub
  - **public-noindex** (noindex, cache, no sitemap): deadline-today, deadline-week, deadline-month

- `APP_ONLY_PATTERNS: string[]` — pattern-based with wildcard support:
  `/admin/*`, `/employer/*`, `/dashboard/*`, `/profile/*`, `/login`, `/signup`, `/phone-signup`, `/forgot-password`, `/saved-jobs`, `/enrol-now`, `/thankyou`, `/offline`

- `isAppOnlyRoute(slug): boolean` — matches exact paths and `/*` wildcard prefixes

- `getPageTypePolicy(pageType): PageTypePolicy | null`

- `buildCanonicalUrl(slug): string` — empty/root → `SITE_URL` (no trailing slash), otherwise `SITE_URL/${slug}`

- Derived exports: `NOINDEX_TYPES` (Set) and `BREADCRUMB_EXPECTED_TYPES` (Set) computed from registry entries, replacing local constants in seoValidationEngine.ts

### 3. `src/components/admin/seo-policy/seoRoutePolicyEngine.ts`

**`evaluateEvidence(slug, title, pageType, inventoryEntry?): EvidenceCriterion[]`** — 9 input-fact checks:
1. **Publicly accessible** — not matched by `isAppOnlyRoute(slug)`
2. **Has standalone search intent** — not ephemeral/deadline page type
3. **Has meaningful unique content** — title present AND introContent present (from inventory); app-only routes detail "N/A — app route"
4. **Content metadata present** — metaDescription exists in inventory
5. **Not user-specific** — not a personalized/auth-gated route (checks slug patterns like saved-jobs, profile, dashboard)
6. **Not admin/internal route** — not matching admin/employer patterns
7. **Canonical route constructible** — slug defined or is homepage root
8. **Not thin/ephemeral by policy** — page type not in NOINDEX_TYPES
9. **Approved page type** — has explicit entry in PAGE_TYPE_POLICIES (not fallback)

**`derivePolicy(slug, pageType, evidence): PolicyOutput`**:
- If `isAppOnlyRoute(slug)` → app-only, noindex, no sitemap, no cache. `policySource = 'app-only-pattern'`
- Else if `getPageTypePolicy(pageType)` exists → use its settings. `policySource = 'page-type-policy'`
- Else → fallback: public-seo, index, cache, sitemap. `policySource = 'fallback'`
- Canonical via `buildCanonicalUrl(slug)`

**`detectConflicts(evaluatedRoute): PolicyConflict[]`** — 8 types:

| Conflict | Severity |
|---|---|
| public-seo + sitemap=false | error |
| public-seo + noindex | error |
| app-only in SEO inventory | warning |
| Missing canonical | warning |
| cache-served + app-only | error |
| sitemap + noindex | error |
| inventory-without-policy (in inventory but no PAGE_TYPE_POLICIES entry) | error |
| Fallback classification (policySource='fallback') | warning |

The **fallback** conflict is distinct: message = "Route classified via fallback — no explicit policy mapping exists. Review and add a page type policy." Shown with high visibility in the dashboard.

**`generateReasonSummary(evidence, policy): string`** — natural-language explanation from evidence results + policy source. Fallback routes get: "REVIEW NEEDED: This route was classified via fallback logic..."

**`evaluateRoute(slug, title, pageType, inventoryEntry?): EvaluatedRoute`** — orchestrator.

**`evaluateAllRoutes(inventory: PageData[]): EvaluatedRoute[]`** — evaluates all inventory entries + synthesized app-only pattern routes.

### 4. `src/components/admin/seo-policy/SEORoutePolicyDashboard.tsx`
Single component with inline report dialog:

**Summary cards** (top row):
- Total Routes, Public SEO, Public Noindex, App Only, Routes with Conflicts, Fallback Routes (highlighted in amber), Cache-Served, Sitemap-Included

**Fallback routes** get a dedicated amber-highlighted summary card so they are never silently accepted.

**Filters**: category dropdown, page type dropdown, policy source dropdown, indexability, sitemap yes/no, cache-served yes/no, "only with conflicts" toggle, "only fallback" toggle, search by slug/title

**Table columns**: Title, Slug, Page Type, Category (colored badge), Policy Source (badge — fallback gets amber/warning styling), Indexability, Sitemap, Cache, Evidence (passed/total), Conflicts, Actions (View Report, Open Live Route)

Fallback rows rendered with amber left border and warning icon for high visibility.

**Policy Report Dialog** — two clearly labeled sections:
- **Evidence** (header: "Why this route qualifies"): checklist of 9 criteria with check/X icons + detail text
- **Policy Decision** (header: "What was decided"): category, indexability, sitemap, cache-served, canonical URL, policy source badge, reason summary
- Conflict warnings as alert banners at top of dialog
- Fallback routes show a prominent amber alert: "This route was classified via fallback logic. Add an explicit policy mapping."
- "Open Live Route" link to `SITE_URL/{slug}`

### 5. `src/components/admin/seo-policy/seoRoutePolicyExport.ts`
- `exportPolicyCSV(routes, filename)`: columns = slug, title, pageType, category, policySource, expectedIndexability, includeInSitemap, isCacheServed, canonical, reasonSummary, evidencePassed, evidenceFailed, conflictCount
- `exportPolicyJSON(routes, filename)`: full EvaluatedRoute array
- Uses same `downloadBlob` helper pattern as cacheExport.ts

## Files to Modify (2)

### `src/pages/admin/AdminDashboard.tsx`
- Add `Shield` to lucide imports (line 9-25)
- Add import: `import { SEORoutePolicyDashboard } from '@/components/admin/seo-policy/SEORoutePolicyDashboard';`
- Add tab trigger after the "SEO" trigger (after line 287):
  ```tsx
  <TabsTrigger value="seo-policy" className="flex items-center gap-2">
    <Shield className="h-4 w-4" />
    <span className="hidden sm:inline">SEO Policy</span>
  </TabsTrigger>
  ```
- Add tab content (after the SEO tab content, around line 351):
  ```tsx
  <TabsContent value="seo-policy">
    <SEORoutePolicyDashboard />
  </TabsContent>
  ```

### `src/components/admin/seo-cache/seoValidationEngine.ts`
- Remove lines 8-19 (local `NOINDEX_TYPES` and `BREADCRUMB_EXPECTED_TYPES` constants)
- Add import: `import { NOINDEX_TYPES, BREADCRUMB_EXPECTED_TYPES } from '../seo-policy/seoRoutePolicyRegistry';`
- All other code stays identical — these are drop-in replacements with same Set interface

## Fallback Visibility Design
Per the user's request, fallback classification is treated conservatively:
1. **Summary card**: dedicated amber "Fallback Routes" count card
2. **Table rows**: amber left border + warning icon on fallback rows
3. **Policy source badge**: amber/warning styling for 'fallback'
4. **Conflict**: every fallback route gets a warning-level conflict automatically
5. **Reason summary**: prefixed with "REVIEW NEEDED:"
6. **Report dialog**: prominent amber alert banner
7. **Filter**: dedicated "only fallback" toggle to quickly find them

