

# Revised Phase 1: Routing, Broken Pages, Content-URL Mismatch (Corrected)

## Do Not Code Until This Revised Plan Is Approved

---

## Hard Policy: Weak or Misleading Public Links

**If any visible public navigation item, CTA, chip, card link, footer link, dropdown item, or homepage shortcut leads to a broken, placeholder, weak, misleading, or low-intent destination after verification, that link must be removed, hidden, disabled, or relabeled in Phase 1.** This applies to top navigation, footer, homepage chips, dropdowns, CTA buttons, cards, tools links, and all other public-facing clickable entry points. Do not leave users or Google crawling into weak or misleading pages.

---

## 1. Proven Code-Level Findings

### 1A. Broken tool links in PrepToolsBanner (10 confirmed broken)

| Current broken path | Correct route |
|---|---|
| `/tools/age-calculator` | `/govt-job-age-calculator` |
| `/tools/eligibility-checker` | `/govt-exam-eligibility-checker` |
| `/tools/salary-calculator` | `/govt-salary-calculator` |
| `/tools/typing-test` | `/typing-test-for-government-exams` |
| `/tools/exam-calendar` | `/govt-exam-calendar` |
| `/tools/photo-resizer` | `/photo-resizer` |
| `/tools/image-resizer` | `/image-resizer` |
| `/tools/pdf-tools` | `/pdf-tools` |
| `/tools/percentage-calculator` | `/percentage-calculator` |
| `/tools/fee-calculator` | `/govt-exam-fee-calculator` |

### 1B. Dead links in Navbar Tools dropdown (2 confirmed dead)
- "Polls" → `#`
- "Contests & Surveys" → `#`

**Fix**: Remove both items from the dropdown. Per the hard policy, placeholder links must not remain visible.

### 1C. Broken `/settings` link in Navbar (1 confirmed broken)
No `/settings` route exists. **Fix**: Change to `navigate('/profile')` (which does exist as a protected route).

### 1D. Weak "Exam Calendar" destinations (3 confirmed weak)
All currently point to generic `/sarkari-jobs`:
- `QuickAccessBar.tsx` line 7
- `Footer.tsx` line 87
- `GovtHeroBlock.tsx` line 13

**Fix**: All three → `/govt-exam-calendar` (dedicated tool page exists).

### 1E. Weak "Answer Keys" destinations (3 confirmed weak)
- `QuickAccessBar.tsx` line 8: "Answer Keys" → `/sarkari-jobs` (no filter)
- `Footer.tsx` line 86: "Answer Keys" → `/sarkari-jobs` (no filter)
- `GovtHeroBlock.tsx` line 11: "Answer Key" → `/sarkari-jobs` (no filter)

No dedicated Answer Keys page exists and no query-param filter produces a meaningful answer-key-specific view. Per the hard policy, these are misleading: a user clicking "Answer Keys" lands on a generic jobs listing with no answer-key content visible.

**Fix**: Remove "Answer Keys" from QuickAccessBar and GovtHeroBlock (they have 6 and 6 items respectively — removing one keeps the layout clean). Keep the Footer version but relabel it to "Sarkari Jobs" or remove it, since the Footer already links to `/sarkari-jobs` elsewhere. Decision: remove from all three to avoid misleading users.

### 1F. Weak "Syllabus" destination (1 confirmed weak)
- `GovtHeroBlock.tsx` line 12: "Syllabus" → `/sarkari-jobs` (no filter)

Same problem as Answer Keys — no syllabus-specific content at that destination. **Fix**: Remove from GovtHeroBlock quick links.

### 1G. Weak "Eligibility" destination (1 confirmed weak)
- `QuickAccessBar.tsx` line 10: "Eligibility" → `/sarkari-jobs` (no filter)

No eligibility-specific view at that destination. **Fix**: Change to `/govt-exam-eligibility-checker` (dedicated tool page exists).

---

## 2. Canonical Route Clarification: `/latest-govt-jobs` vs `/latest-govt-jobs-2026`

**Finding**: `/latest-govt-jobs-2026` does NOT exist anywhere in the codebase — zero matches. The canonical route is **`/latest-govt-jobs`** (App.tsx line 145, Footer, breadcrumbs, SEO cache, sitemap, cross-links all use this).

**Decision**:
- `/latest-govt-jobs` is the one true canonical route
- No `/latest-govt-jobs-2026` route exists or needs to be created
- All internal links already use `/latest-govt-jobs` — no changes needed
- If `/latest-govt-jobs-2026` is ever typed by a user, it falls to `SEOLandingResolver` → NotFound, which is acceptable (it was never linked from anywhere)

No ambiguity remains.

---

## 3. Bare-Intent Slug Redirects

These 5 slugs currently return 404 via the `/:slug` catch-all. Phase 1 must prevent those 404s.

| Slug | Redirect destination | Strength | Notes |
|---|---|---|---|
| `/exam-calendar` | `/govt-exam-calendar` | **Strong** — exact intent match to dedicated tool page | Final-quality redirect |
| `/results` | `/sarkari-jobs?status=result_declared` | **Acceptable** — filtered view shows result-declared jobs | Produces meaningful filtered state; acceptable as interim |
| `/admit-card` | `/sarkari-jobs?status=admit_card_released` | **Acceptable** — filtered view shows admit-card jobs | Produces meaningful filtered state; acceptable as interim |
| `/answer-key` | `/sarkari-jobs` | **Weak** — generic fallback, no answer-key-specific content | Temporary damage control only. Later phases should create a dedicated or semi-dedicated Answer Keys landing page. This is NOT a final SEO-quality solution. |
| `/syllabus` | `/sarkari-jobs` | **Weak** — generic fallback, no syllabus-specific content | Temporary damage control only. Later phases should create a dedicated Syllabus landing page. This is NOT a final SEO-quality solution. |

**Implementation**: Add all 5 to the `REDIRECTS` map in `SEOLandingResolver.tsx` (lines 45–48).

---

## 4. Public Route Verification Matrix

### Core Routes (3 routes)
| Route | Status |
|---|---|
| `/` | Working correctly at code level. Live stability needs verification (see Section 6). |
| `/sarkari-jobs` | Working correctly — explicit route, line 143 |
| `/latest-govt-jobs` | Working correctly — explicit route, line 145 |

### Category / Intent Routes via `/:slug` → SEOLandingResolver (5 routes)
| Route | Status |
|---|---|
| `/private-jobs` | Working correctly — explicit static route (line 142) takes priority over `/:slug` |
| `/remote-jobs` | Likely working — has categoryJobsData config. Needs live 7-point verification. |
| `/fresher-jobs` | Likely working — has categoryJobsData config. Needs live 7-point verification. |
| `/results` | **Broken** — no route, no data config. Fix: redirect (see Section 3) |
| `/admit-card` | **Broken** — no route, no data config. Fix: redirect |
| `/answer-key` | **Broken** — no route, no data config. Fix: redirect (weak) |
| `/syllabus` | **Broken** — no route, no data config. Fix: redirect (weak) |
| `/exam-calendar` | **Broken** — no route, no data config. Fix: redirect to `/govt-exam-calendar` |

### Tools / Utility Routes (14 routes)
| Route | Status |
|---|---|
| `/tools` | Working correctly — line 192 |
| `/tools/resume-builder` | Working correctly — line 194 |
| `/tools/resume-checker` | Working correctly — line 193 |
| `/govt-job-age-calculator` | Working correctly — line 195 |
| `/govt-exam-eligibility-checker` | Working correctly — line 202 |
| `/govt-salary-calculator` | Working correctly — line 197 |
| `/typing-test-for-government-exams` | Working correctly — line 201 |
| `/govt-exam-calendar` | Working correctly — line 204 |
| `/photo-resizer` | Working correctly — line 198 |
| `/image-resizer` | Working correctly — line 199 |
| `/pdf-tools` | Working correctly — line 200 |
| `/percentage-calculator` | Working correctly — line 196 |
| `/govt-exam-fee-calculator` | Working correctly — line 203 |
| `/outreach-assets` | Working correctly — line 205 |

### Trust / Legal Routes (6 routes)
| Route | Status |
|---|---|
| `/aboutus` | Working correctly — line 176 |
| `/contactus` | Working correctly — line 177 |
| `/privacypolicy` | Working correctly — line 174 |
| `/termsofuse` | Working correctly — line 175 |
| `/about` | Working correctly — legacy redirect, line 183 |
| `/contact` | Working correctly — legacy redirect, line 184 |

### Other Explicit Routes (8 routes)
| Route | Status |
|---|---|
| `/jobs` | Working correctly — line 139 |
| `/jobs/employment-news` | Working correctly — line 146 |
| `/jobs/employment-news/:slug` | Working correctly — line 147 |
| `/notifications` | Working correctly — line 148 |
| `/blog` | Working correctly — line 149 |
| `/blog/:slug` | Working correctly — line 151 |
| `/companies` | Working correctly — line 155 |
| `/companies/:slug` | Working correctly — line 156 |

### SEO Resolver Families (7 families, many slugs each)
| Family | Status |
|---|---|
| State pages (`/govt-jobs-{state}`) | Likely working — stateGovtJobsData config. Needs live sampling. |
| Category pages (25 entries) | Likely working — categoryJobsData config. Needs live sampling. |
| City pages (`/jobs-in-{city}`) | Likely working — cityJobsData config. Needs live sampling. |
| Department pages | Likely working — departmentJobsData config. Needs live sampling. |
| Qualification pages | Likely working — qualificationJobsData config. Needs live sampling. |
| Exam authority pages | Likely working — examAuthority data. Needs live sampling. |
| Exam cluster hubs | Likely working — hubs data. Needs live sampling. |

**Total routes reviewed**: 36 explicit routes + 7 SEO families (covering hundreds of slugs) — all listed in the matrix above.

---

## 5. Content-URL Mismatch Assessment

No obvious static-router collision found in code. Static routes are correctly ranked above the parameterized `/:slug` catch in React Router v6. However, live rendered output still needs verification for content-intent match.

For high-risk routes, Phase 1 should verify these 7 alignment points:
1. URL slug
2. Page title
3. H1
4. Visible content type
5. Main content body relevance
6. Canonical URL
7. Internal links context

**Routes requiring 7-point live verification**: `/private-jobs`, `/remote-jobs`, `/fresher-jobs`, sample state pages, sample qualification pages.

Code-level evidence suggests no mismatch, but this is not confirmed-correct until live verification.

---

## 6. Homepage Stability Assessment

No code-level route mapping issue found:
- `/` has an explicit eager-loaded route (line 129)
- Service worker fallback uses `createHandlerBoundToURL('/index.html')` — structurally reasonable

However, true homepage stability requires production verification for:
- Direct load
- Hard refresh
- Back-button navigation
- Query param loads
- Cached session / stale shell behavior
- Service worker mismatch after deployments
- Mobile and desktop rendering

These cannot be confirmed from code inspection alone.

---

## 7. Phase 1 Scope Boundary

### Will definitely fix now (code changes):
1. Fix 10 broken tool links in `PrepToolsBanner.tsx`
2. Remove 2 dead `href: '#'` items from `Navbar.tsx` Tools dropdown
3. Fix `/settings` → `/profile` in `Navbar.tsx`
4. Fix 3 weak "Exam Calendar" destinations → `/govt-exam-calendar` in QuickAccessBar, Footer, GovtHeroBlock
5. Remove 3 misleading "Answer Keys" links from QuickAccessBar, Footer, GovtHeroBlock
6. Remove misleading "Syllabus" link from GovtHeroBlock
7. Fix "Eligibility" chip in QuickAccessBar → `/govt-exam-eligibility-checker`
8. Add 5 bare-intent redirects in SEOLandingResolver REDIRECTS map

### Will verify before declaring complete:
- 7-point content match for `/private-jobs`, `/remote-jobs`, `/fresher-jobs`
- Sample SEO landing pages render correctly
- Homepage stability scenarios

### Marked for later phases:
- Dedicated Answer Keys landing page (currently weak redirect)
- Dedicated Syllabus landing page (currently weak redirect)
- Dedicated Results / Admit Card listing pages (currently acceptable filtered redirects)

---

## 8. Files to Change

| File | Changes |
|---|---|
| `src/components/home/PrepToolsBanner.tsx` | Fix 10 broken tool hrefs |
| `src/components/layout/Navbar.tsx` | Remove 2 dead `#` links; fix `/settings` → `/profile` |
| `src/components/home/QuickAccessBar.tsx` | Exam Calendar → `/govt-exam-calendar`; Eligibility → `/govt-exam-eligibility-checker`; remove Answer Keys |
| `src/components/home/GovtHeroBlock.tsx` | Exam Calendar → `/govt-exam-calendar`; remove Answer Key; remove Syllabus |
| `src/components/layout/Footer.tsx` | Exam Calendar → `/govt-exam-calendar`; remove Answer Keys |
| `src/pages/seo/SEOLandingResolver.tsx` | Add 5 redirects for bare intent slugs |

**6 files changed.**

---

## 9. Revised Summary

| Metric | Count |
|---|---|
| Confirmed broken links (leading to 404) | 11 (10 PrepToolsBanner + 1 /settings) |
| Confirmed dead links (href #) | 2 (Navbar) |
| Confirmed broken bare-slug routes | 5 (/results, /admit-card, /answer-key, /syllabus, /exam-calendar) |
| Misleading links to remove | 5 (3 Answer Keys + 1 Syllabus + 1 Eligibility→fix) |
| Weak links to improve | 4 (3 Exam Calendar + 1 Eligibility) |
| Routes reviewed at code level | 36 explicit routes + 7 SEO families — all listed in the matrix above |
| Routes still needing live 7-point verification | ~10 (content-intent match sampling) |
| Homepage stability: code-level issues | 0 — live verification still needed |
| Content-slug mismatches at code level | 0 — live verification still needed |
| Canonical route decision | `/latest-govt-jobs` is canonical; `/latest-govt-jobs-2026` does not exist |
| Weak redirects flagged for later improvement | 2 (`/answer-key`, `/syllabus`) |

