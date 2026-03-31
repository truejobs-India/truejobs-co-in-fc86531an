

# Revised Quality Rebuild Plan — Tightened Version

## 1. Executive Revision Summary

**What was good in the first plan:**
- Correct root-cause diagnosis: companies have 3 sparse profiles + 0 active jobs; sample papers have 34 entries with empty `content`; books/PYP/guides have 0 inventory
- Correct identification that `/free-guides` is already functional and needs no changes
- Template-level approach (not one-off cosmetics) is correct
- No fake data, no URL deletion — correct constraints

**What needed strengthening:**
1. Company contract was vague — "less empty" is not "meaningfully rebuilt"
2. Empty-family plan said "rich empty states" without defining what sections actually appear
3. Sample paper detail plan relied on a metadata fallback card alone — still thin
4. Noindex relaxation was hand-wavy, not a strict decision matrix
5. Hub matching said "more lenient / fuzzy" without deterministic rules

**What changed in this revision:**
- Each family now has an explicit **minimum content contract** listing every visible section
- Company cards and detail pages have defined field-by-field rendering rules with fallback chains
- Empty families (books, PYP, guides) have concrete section blueprints — not generic "helpful states"
- Sample paper detail pages get 4 new structural sections using only real stored data
- Indexability is governed by a strict boolean matrix, not vibes
- Hub matching uses a defined 3-field priority cascade with no fuzzy injection

---

## 2. Revised Company Family Contract

### A. Company Listing Card Contract (`/companies`)

Every card renders these fields in priority order:

| Field | Source (registered) | Source (job-derived) | If missing |
|---|---|---|---|
| Company name | `companies.name` | `jobs.company_name` | Never missing |
| Logo | `companies.logo_url` → `AICompanyLogo` | `AICompanyLogo` (initials) | Always has initials fallback |
| Industry | `companies.industry` | Not available | Hide row |
| Location | `companies.location` | Derived from `jobs.city/location` | Hide row |
| Summary | `companies.description` (2-line clamp) | Not available | Hide row |
| Openings indicator | `jobs` count where `status=active` | Count from aggregation | Show "0 open positions" — never hide |
| Verification badge | `companies.is_verified` | Not available | Hide badge |
| CTA | "View Company →" linking to detail | Same | Always present |

**New addition for sparse listing:** When total results < 6, add a **"Explore More Opportunities"** section below the grid with 3 internal link cards:
- "Government Jobs" → `/sarkari-jobs`
- "Private Jobs" → `/private-jobs`  
- "Employment News" → `/jobs/employment-news`

This prevents the page from feeling dead when inventory is low, without faking companies.

### B. Company Detail Page Contract (`/companies/:slug`)

Every detail page renders these sections **always**, with safe fallbacks:

| Section | Content | Fallback when data missing |
|---|---|---|
| **Header** | Name + logo + verified badge + industry badge + location + size + founded year + website link | Name + AICompanyLogo always render. Other fields hide individually. Minimum visible: name + logo. |
| **About** | `companies.description` | Show: "{Company} is listed on TrueJobs as an employer. Profile details will be updated as they become available." — honest, not invented. |
| **Quick Stats** | Open positions count, job types count, locations count | Always show "Open Positions: {n}". Other stats only if jobs > 0. |
| **Open Positions** | Job cards with title, location, type, salary, CTA | If 0 jobs: show contextual empty state (below). |
| **Browse More** (new) | 3 internal link cards: "Browse Government Jobs", "Browse Private Jobs", "Browse All Companies" | Always rendered. Provides exit paths. |

**Zero-jobs empty state** (replaces current generic "no active job openings"):
```
No active openings from {company.name} right now.
Browse similar opportunities:
  → Government Jobs (/sarkari-jobs)
  → Private Jobs (/private-jobs)
  → All Companies (/companies)
```

### C. What remains weak if data stays sparse

- Unregistered companies (job-derived) will always show name + initials logo + job count only. No description, no industry. This is honest but visually minimal.
- With 0 active jobs in `jobs` table, job-derived companies won't appear at all (they come from active jobs). The listing will show only 3 registered companies.
- **This is a data problem, not a template problem.** The template will render richly as soon as data exists.

### D. Files affected

- `src/pages/companies/Companies.tsx` — sparse-listing support section, empty-state improvement
- `src/pages/companies/CompanyDetail.tsx` — always-render About section, browse-more section, zero-jobs contextual empty state

---

## 3. Revised Empty-Family Usefulness Contract

### `/books` — Zero inventory

**Page structure (always rendered):**

1. **Breadcrumb**: Home › Books
2. **Hero heading**: "Books for Government Exam Preparation"
3. **Intro paragraph**: "We're building a library of free PDF books for competitive exam preparation. Browse available study materials below, or explore our other resources."
4. **Hub navigation badges**: All 5 book hubs rendered as clickable badges (Reasoning, Quant, General Awareness, English, General Science) — each links to `/books/hub/{slug}`. Even with 0 inventory, these provide structure and internal linking value.
5. **Cross-resource section** (new, always rendered):
   - "Available Study Materials" heading
   - 3 cards linking to populated families:
     - "Sample Papers" → `/sample-papers` with count "(34 available)"
     - "Free Guides" → `/free-guides` with description "10 downloadable preparation guides"
     - "Previous Year Papers" → `/previous-year-papers`
6. **Preparation hub links** (new):
   - "Government Jobs" → `/sarkari-jobs`
   - "Latest Employment News" → `/jobs/employment-news`

**Why worth being public:** Hub badges provide SEO-valuable internal links to category pages. Cross-resource section provides genuine utility by directing users to content that exists. The page structure is ready to populate instantly when books are added.

### `/previous-year-papers` — Zero inventory

**Page structure (always rendered):**

1. **Breadcrumb**: Home › Previous Year Papers
2. **Hero heading**: "Previous Year Question Papers — Free PDF Download"
3. **Intro paragraph**: "Access previous year question papers for government exams. We're adding papers for SSC, Railway, Banking, UPSC and more."
4. **Hub navigation badges**: All 6 PYP hubs rendered (SSC CGL, SSC CHSL, RRB NTPC, Railway, SSC, Banking) — internal linking structure.
5. **Cross-resource section**: Same pattern as books — link to sample papers, free guides.
6. **Exam category cards** (new): Static cards for SSC, Railway, Banking, UPSC showing the hub intro text and "Coming Soon" indicator. These are derived from `RESOURCE_HUBS.previous_year_paper` config — no fake data, just the existing hub metadata rendered as browse-able cards.

**Why worth being public:** 6 hub badge links + exam category cards create meaningful internal linking. Users understand what will be available and can navigate to existing resources.

### `/guides` — Zero inventory

**Page structure (always rendered):**

1. **Breadcrumb**: Home › Guides
2. **Hero heading**: "Free Study Guides for Government Exams"
3. **Intro paragraph**: "Download preparation guides, study strategies, and exam-specific tips. We're expanding this section — in the meantime, check out our ready-to-use guides below."
4. **Hub navigation badges**: All 3 guide hubs (Exam Strategy, Syllabus & Pattern, Preparation Tips).
5. **Featured link to `/free-guides`** (new, prominent): Card with "10 Free Preparation Guides Available Now — Download PDF" linking to `/free-guides`. This is the key differentiator — `/guides` has a real sibling page with actual content.
6. **Cross-resource section**: Links to sample papers, employment news.

**Why worth being public:** Direct pathway to `/free-guides` (10 real downloadable PDFs) makes this page immediately useful. Hub badges provide internal linking structure.

### Files affected

- `src/components/resources/ResourceListing.tsx` — type-specific intro text, cross-resource section when inventory is 0, hub badges always visible

---

## 4. Revised Sample Paper Detail Contract

### Minimum visible sections for `/sample-papers/:slug`

Every sample paper detail page will always render these sections, regardless of whether `content` is empty:

| Section | Source | Renders when |
|---|---|---|
| 1. **Badges** | `category`, `exam_name`, `subject` | Any field non-null |
| 2. **Title** (h1) | `title` | Always |
| 3. **File metadata bar** | PDF label, `file_size_bytes`, `page_count`, `language`, `updated_at` | Always (PDF label always shown) |
| 4. **Download count** | `download_count` | Always |
| 5. **Download CTA** | Button → download page | Always (if `file_url` exists) |
| 6. **Resource Details card** (new) | Structured table: Exam (`exam_name`), Category (`category`), Subject (`subject`), Language (`language`), Pages (`page_count`), File Size, Year (`exam_year`/`edition_year`) | Always rendered. Rows with null values hidden individually. Minimum: Language row always shows (default 'hindi'). |
| 7. **Who Should Use This** (new) | Safe derived text: "This {typeLabel} is useful for candidates preparing for {exam_name or category or 'government'} exams. Download the PDF for offline practice." | Always. Uses real fields only. Falls back to generic exam prep framing if both exam_name and category are null. |
| 8. **Prose content** | `content` (HTML) | Only if non-empty |
| 9. **FAQ accordion** | `faq_schema` | Only if array has items |
| 10. **Second Download CTA** | Same button | Always |
| 11. **Related Resources** | `RelatedResources` component (same category + type) | Only if results > 0 |
| 12. **Browse Hub link** (new) | If `category` matches a hub slug, show "Browse more {hub.label} →" linking to `/sample-papers/hub/{slug}` | Only if category maps to a known hub |
| 13. **Cover image** (sidebar) | `cover_image_url` or default | Always |
| 14. **Tags** (sidebar) | `tags` array | Only if non-empty |

### Fallback logic when `content` is empty

- Sections 1-7 always render using stored metadata fields
- Section 8 (prose) is skipped — no placeholder text inserted
- The page has visible body content from sections 6 + 7 even without prose
- This means every sample paper detail page has at minimum: title + metadata bar + download CTA + resource details card + who-should-use section + related resources

### Files affected

- `src/pages/resources/ResourceDetail.tsx` — add Resource Details card section, Who Should Use section, Browse Hub link

---

## 5. Resource Detail Indexability Decision Matrix

### Strict decision rule

A resource detail page is **indexable** (noindex = false) when ALL of the following are true:

| Condition | Check | Rationale |
|---|---|---|
| `is_published` | `=== true` | Unpublished pages must never be indexed |
| `is_noindex` | `=== false` or null | Explicit admin override |
| `file_url` | Non-null, non-empty | The page must offer a downloadable file — that IS the content value |
| `title` | Non-null, non-empty | Must have a title |
| `excerpt` OR `meta_description` | At least one non-null, non-empty | Must have some descriptive text for search snippets |

A page is **noindex** if ANY condition fails.

### What is explicitly NOT required for indexability

- `word_count >= 500` — **removed**. PDF resource pages derive value from the downloadable file, not prose length. The new Resource Details card + Who Should Use section provide sufficient on-page content.
- `meta_title` — **removed as hard requirement**. Title is used as fallback. Nice to have, not a gate.
- `content` non-empty — **not required**. Sections 6+7 from the detail contract ensure visible body content exists.

### Updated `shouldNoindex` logic

```typescript
const shouldNoindex = 
  !resource.is_published || 
  resource.is_noindex || 
  !resource.file_url || 
  !resource.title ||
  (!resource.excerpt && !resource.meta_description);
```

### Files affected

- `src/pages/resources/ResourceDetail.tsx` — line 77, replace current `shouldNoindex` formula

---

## 6. Deterministic Hub Matching Plan

### Current problem

`ResourceHub.tsx` line 48 uses:
```
.or(`category.ilike.%${hubSlug}%,exam_name.ilike.%${hubSlug}%,subject.ilike.%${hubSlug}%`)
```

This is a fuzzy substring match. Hub slug `ssc` matches category "SSC" but also any exam_name containing "SSC" anywhere. For hubs like `railway` or `banking` this is mostly fine, but `state-psc` will match nothing because the DB doesn't have "state-psc" as a substring in any field.

### Deterministic matching rules

**Step 1: Define explicit hub-to-DB mapping**

Add a `dbFilters` property to each `HubConfig` in `resourceHubs.ts`:

```typescript
export interface HubConfig {
  label: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  dbFilters: {
    field: 'category' | 'exam_name' | 'subject';
    values: string[];  // exact case-insensitive matches
  }[];
}
```

Example for sample_paper hubs:
```
ssc: { dbFilters: [{ field: 'category', values: ['SSC'] }, { field: 'exam_name', values: ['SSC CGL', 'SSC CHSL', 'SSC MTS'] }] }
railway: { dbFilters: [{ field: 'category', values: ['Railway'] }, { field: 'exam_name', values: ['RRB NTPC', 'RRB Group D'] }] }
defence: { dbFilters: [{ field: 'category', values: ['Defence'] }] }
```

**Step 2: Query construction order**

1. Check `dbFilters[0]` (primary field, usually `category`) — exact ilike match against each value
2. Check `dbFilters[1]` (secondary field, usually `exam_name`) — exact ilike match
3. Combine with `.or()` — all filter values across all fields joined

**Step 3: When no match = no match**

If a hub's `dbFilters` produce 0 results, show the empty state. Do NOT fall back to looser matching. The empty state already has cross-links and hub badges (from section 3).

**Step 4: No irrelevant injection**

Because filters use explicit value lists (not substring wildcards on the hub slug), a hub like `state-psc` with `dbFilters: [{ field: 'category', values: ['State PSC', 'UPPSC', 'MPPSC', 'BPSC'] }]` will only match resources explicitly tagged with those categories — not random resources containing "state" somewhere.

### Fallback behavior

- Hub page with 0 results: shows hub intro text + "No resources in this category yet" + hub badges for sibling hubs + link to main listing page
- This is the existing behavior from `ResourceHub.tsx` empty state, which will be improved in Phase 3

### Files affected

- `src/lib/resourceHubs.ts` — add `dbFilters` to `HubConfig` interface and all hub entries
- `src/pages/resources/ResourceHub.tsx` — replace `.or()` substring query with `dbFilters`-driven query construction

---

## 7. Revised Implementation Sequence

### Phase 1: Hub matching determinism
- Update `resourceHubs.ts` with `dbFilters` on all hubs
- Update `ResourceHub.tsx` query to use `dbFilters`
- **Validate before coding:** Confirm actual `category` values in `pdf_resources` (known: "Teaching" ×28, "General" ×4, "CBSE" ×1, "Defence" ×1) — map these to hub filters accurately

### Phase 2: Resource detail strengthening
- Update `ResourceDetail.tsx`: add Resource Details card, Who Should Use section, Browse Hub link
- Update `shouldNoindex` formula
- **Test:** Verify any sample paper detail page shows 6+ visible sections even with empty `content`

### Phase 3: Resource listing empty-family rebuild
- Update `ResourceListing.tsx`: type-specific intros, cross-resource sections, always-visible hub badges
- **Test:** `/books`, `/previous-year-papers`, `/guides` each show structured useful content

### Phase 4: Company family rebuild
- Update `CompanyDetail.tsx`: always-render About, browse-more section, contextual empty state
- Update `Companies.tsx`: sparse-listing support section
- **Test:** Company detail pages for all 3 registered companies show complete structure

### Phase 5: Validate
- All 4 resource listing pages render correctly
- All sample paper detail pages have visible body content
- All company pages feel complete
- Hub pages show deterministic results
- No noindex on pages that should be indexed (sample papers with file URLs)
- No indexable pages that should be noindex

### Test matrix

| Route | Expected after rebuild |
|---|---|
| `/companies` | 3 company cards + explore-more section |
| `/companies/astro-krishna-global` | Full layout with About fallback, browse-more, 0-jobs contextual state |
| `/sample-papers` | 34 cards, sample-paper-specific intro |
| `/sample-papers/{any-slug}` | 6+ visible sections including Resource Details + Who Should Use |
| `/sample-papers/hub/ssc` | Deterministic match on category="SSC" resources |
| `/books` | Hub badges + cross-resource section + 0-inventory structure |
| `/previous-year-papers` | Hub badges + exam category cards + cross-resource section |
| `/guides` | Hub badges + prominent `/free-guides` link + cross-resource section |
| `/books/hub/reasoning` | Empty state with sibling hub badges |

