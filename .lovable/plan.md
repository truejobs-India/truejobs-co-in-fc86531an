

# Technical Audit: 6 Additional Checks

## SECTION 1: APPLY-LINK CONSISTENCY

**Status: Data-dependent, not a code bug. Consistent by template.**

All three detail templates handle apply links correctly:

- **GovtExamDetail.tsx (line 270):** `{exam.apply_link && <Button>Apply Online</Button>}` — conditional render. Also has `official_website` and `notification_pdf_url` links rendered separately in an "Important Links" card.
- **EmploymentNewsJobDetail.tsx (line 208):** `{job.apply_link && <Button>Apply Now</Button>}` — conditional render. Also shows `application_mode` as text in the info grid (line 136-140) but does NOT render a clickable link from `official_website` — only `apply_link`.
- **JobDetail.tsx:** Private-sector template. Uses `job.application_url` for "Apply Now" button, also conditional.

**Findings:**
- Apply-link presence is entirely data-dependent. If `apply_link` is null, no button renders. This is correct behavior, not a bug.
- **Gap in EmploymentNewsJobDetail:** Unlike GovtExamDetail (which also shows `official_website`), this template only renders `apply_link`. If a job has `official_website` but no `apply_link`, the user sees no official link at all. This is an inconsistency between templates.
- The "Apply Mode" field (line 136) shows text like "online" or "offline" but is NOT a link — it's informational only. This may have been what earlier reports flagged as "showing apply mode text without a real link."
- **Verdict:** Templates are technically correct but **EmploymentNewsJobDetail is weaker** than GovtExamDetail — it doesn't fall back to `official_website` when `apply_link` is missing.

---

## SECTION 2: FREE GUIDES / DOWNLOAD FLOW

**Status: Code is technically sound. Data-dependent.**

- `ResourceDownload.tsx` (line 65-81): Downloads via creating an `<a>` element with `href=resource.file_url` and programmatically clicking it. No auth check, no API call — direct browser download.
- The "Generating..." stuck state reported earlier is NOT caused by this download flow. It may relate to the AI image generation pipeline (`generate-vertex-image` edge function) which shows 429 rate-limit retries in logs — but that's for admin cover image generation, not user-facing downloads.
- Download works if `file_url` is populated. If null, a "File temporarily unavailable" toast fires (line 66-68).
- No login/auth gate blocks downloads.
- **Verdict:** Download flow is technically correct. Any "stuck" behavior is data-dependent (missing `file_url`) or a misattributed report about admin image generation.

---

## SECTION 3: REAL 404 STATUS VERIFICATION

**Status: Correctly implemented for multi-segment; soft-404 risk for single-segment.**

Worker logic (lines 409-423):
```
const status = isLikelyValid(pathname) ? 200 : 404;
```

- **Multi-segment unknown paths** (e.g., `/xyz/abc`): Return HTTP 404 with `X-Robots-Tag: noindex, nofollow` and `no-cache`. Correct.
- **Single-segment paths** (e.g., `/nonexistent-slug`): Always return HTTP 200 (line 111: `if (segments.length <= 1) return true`). React's `SEOLandingResolver` then tries to resolve via DB. If not found, React renders a client-side NotFound page — but the HTTP status is still 200. This is a **soft 404** for crawlers.
- **SEO routes with cache miss** (line 323-331): Return HTTP 200 with SPA shell even when `serve-public-page` returns 404. This means a valid SEO route pattern with no actual content still returns 200.
- **Verdict:** Multi-segment 404s are correct. Single-segment unknown URLs are soft 404s (HTTP 200 + client-side "not found" page). This is a known architectural trade-off documented in the worker strategy, but it means Google may index some garbage single-segment URLs with 200 status.

---

## SECTION 4: HOMEPAGE TITLE / H1 ALIGNMENT

**Status: Mismatch still exists, but not technically broken.**

- **`<title>`:** `Index.tsx` line 17-18 passes no `title` prop to `<SEO>`. So `SEO.tsx` line 40 uses `DEFAULT_TITLE`: "TrueJobs – Latest Govt & Private Jobs in India 2026 | Free Job Alert"
- **H1:** `GovtHeroBlock.tsx` renders: "Latest Government Jobs, Results, Admit Cards & Exams"
- **Mismatch:** Title says "Govt & Private Jobs" + "Free Job Alert". H1 says only "Government Jobs, Results, Admit Cards & Exams". Different intent scope.
- **Shell title** (`index.html`): "Smart Job Search India | TrueJobs" — a third different title visible to crawlers on uncached/shell-fallback routes.
- **Verdict:** Three different title/heading signals for the homepage. Not critical (Google will typically use `<title>` from hydrated page), but the shell title is the weakest signal and should be neutralized.

---

## SECTION 5: EMPLOYMENT NEWS LISTING DEPTH / PAGINATION

**Status: Technically adequate but lean.**

- `EmploymentNewsJobs.tsx`: Queries with `PER_PAGE = 20`, has pagination, shows total page count.
- **No total job count displayed** to users — only "Page X of Y" in pagination.
- Has search, category filter, state filter — functionally complete.
- No "X jobs found" result count indicator.
- Query uses `.eq('status', 'published')` — no expired-job filter (same issue as Sarkari listings).
- **Verdict:** Pagination and filtering are technically adequate. Missing: visible total count, and expired-job filtering. The listing is functional but doesn't communicate volume/depth to users or crawlers.

---

## SECTION 6: QUERY / SEARCH URL INDEXATION POLICY

**Status: Correct and intentional.**

- `robots.txt` lines 42-45:
  ```
  Disallow: /*?*sort=
  Disallow: /*?*page=
  Disallow: /*?*filter=
  Disallow: /*?*search=
  ```
- This blocks crawling of any URL with `sort`, `page`, `filter`, or `search` query parameters. This prevents duplicate content from paginated/filtered views.
- The actual listing pages themselves (e.g., `/jobs/employment-news`, `/sarkari-jobs`) are NOT blocked — only their query-parameterized variants.
- **Verdict:** This is correct and intentional. Canonical listing URLs are indexable; filtered/paginated variants are blocked. Technically sound for SEO.

---

## SEVERITY SUMMARY OF NEW FINDINGS

| # | Finding | SEO Risk | UX Risk | Complexity |
|---|---------|----------|---------|------------|
| 1 | EmploymentNewsJobDetail missing `official_website` fallback | Low | Medium | Low |
| 2 | Download flow | None (working) | None | N/A |
| 3 | Single-segment soft 404s (HTTP 200) | Medium | Low | Medium (architectural) |
| 4 | Homepage 3-way title mismatch | Medium | Low | Low |
| 5 | Employment News listing no total count, no expired filter | Medium | Medium | Low |
| 6 | Query URL indexation | None (correct) | None | N/A |

---

## ACTIONABLE FIXES TO PLAN

1. **EmploymentNewsJobDetail:** Add `official_website` fallback link when `apply_link` is null — match GovtExamDetail behavior.
2. **Homepage shell title:** Neutralize `index.html` title to just "TrueJobs" to prevent SEO signal conflict.
3. **Employment News listing:** Add total count display; add expired-job filter (`.gte('last_date_resolved', today)` or null-pass).
4. **Single-segment soft 404:** Architectural — no simple fix. Documented trade-off. Can be partially mitigated by having `SEOLandingResolver` emit a `noindex` meta tag when slug resolution fails (which it likely already does via NotFound page).
5. **No code changes needed** for download flow or query URL policy — both are correct.

