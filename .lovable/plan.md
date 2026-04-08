

# AdSense Revenue Optimization — Revised Final Plan

## 1. Final Approval-Ready Plan

Three files changed. Three goals: (A) hide blank ad holes via robust fill detection, (B) add two targeted high-RPM placements, (C) defer ad labels until fill is confirmed.

---

## 2. Exact File Scope

| File | Change |
|---|---|
| `src/components/ads/AdPlaceholder.tsx` | Add 3-state fill detection with viewport-aware unfilled timing, MutationObserver fill confirmation, hide-if-empty collapse, deferred ad label |
| `src/pages/blog/BlogPost.tsx` | Add second in-content ad for long articles (>3000 chars) between FAQ section and author box |
| `src/pages/jobs/JobDetail.tsx` | Add second in-content ad between Responsibilities card and Skills card |

No other files changed. No routing, SEO, Cloudflare, or unrelated system changes.

---

## 3. AdPlaceholder Fill Detection Logic

Add `useState<'loading' | 'filled' | 'unfilled'>('loading')` to the component.

**After a successful `push({})`:**
1. Start a `MutationObserver` on the `<ins>` element watching `childList`, `subtree`, and `attributes`
2. On each mutation, check:
   - `data-adsbygoogle-status === 'done'`
   - `<ins>` contains child nodes (iframe or div) with `offsetHeight > 0`
3. If both → set `adStatus = 'filled'`, disconnect observer
4. Safety timeout (see Section 4 for timing) → if observer hasn't confirmed fill, do one final check. If still no evidence → `adStatus = 'unfilled'`
5. If all retries exhaust without a successful `push({})` → `adStatus = 'unfilled'`
6. Observer disconnected on unmount and on status resolution

**This is a strong practical heuristic, not guaranteed truth.** AdSense may use shadow DOM or delayed rendering in edge cases. Mandatory live validation is required post-implementation (see Section 11).

**Render by state:**
- `loading`: render wrapper with min-height reservation, **no "Advertisement" label** — silent CLS-safe placeholder
- `filled`: render wrapper **with** "Advertisement" label, keep min-height
- `unfilled`: return `null` — complete collapse, no label, no borders, no holes

---

## 4. Viewport-Aware Unfilled Decision Logic

A fixed 4-second timeout from page load is unsafe for below-the-fold slots. Slots that haven't entered the viewport yet may fill only after scroll.

**Implementation:**

Add an `IntersectionObserver` (threshold 0, rootMargin `200px`) on the wrapper `<div>`. Track `hasBeenVisible` ref.

**Above-the-fold slots** (slot enters viewport within ~1s of mount):
- `hasBeenVisible` becomes true quickly
- After `push({})` succeeds, start the MutationObserver fill check
- Safety timeout: **5 seconds after push** to decide unfilled
- This is generous enough for normal AdSense latency

**Below-the-fold slots** (slot has NOT entered viewport yet):
- Do NOT start the unfilled decision timer until `hasBeenVisible` becomes true
- Once the slot enters viewport (IntersectionObserver fires), start the same 5-second safety window from that moment
- If the user never scrolls to the slot, it stays in `loading` state with reserved height — this is acceptable because it's invisible to the user anyway

**Retry exhaustion without viewport entry:**
- If all 8 retries exhaust and the slot was never visible, keep `loading` (invisible to user, no harm)
- If retries exhaust and the slot WAS visible but no fill confirmed → `unfilled` → collapse

**Revenue protection:** This approach never prematurely collapses a below-the-fold slot that hasn't had a fair chance to fill.

---

## 5. Final JobDetail Second-Ad Location and Reason

**Inspected current JobDetail layout (lines 470–614):**

```text
Quick Info Card
Government Job Details Card
Description Card
─── AdPlaceholder variant="banner" (line 546) ───
Requirements Card
Responsibilities Card
─── [NEW: AdPlaceholder variant="in-content"] ───
Skills Card
Benefits Card
─── AdPlaceholder variant="in-content" (line 613, existing) ───
```

**Chosen location:** Between Responsibilities card (ends line 573) and Skills card (starts line 576).

**Rejected alternative:** "Above Important Links" — there is no "Important Links" section in JobDetail.tsx. The previous plan referenced a section that does not exist (verified via code search: zero matches for "Important Links" in JobDetail.tsx).

**Why this location is correct:**
- It is ~27 lines of rendered content away from the banner ad at line 546 (Requirements + Responsibilities cards between them)
- It is ~40 lines of rendered content away from the existing in-content ad at line 613 (Skills + Benefits cards between them)
- Maximum spacing from both existing ad slots — no clustering
- Far from the Apply CTA (which is in the sidebar, not the main column)
- Only renders when `job.description?.length > 500` to avoid ad-heavy short pages

---

## 6. BlogPost Second-Ad Placement and Reason

**Inspected current BlogPost layout (lines 520–600):**

```text
Table of Contents
Article Content
─── AdPlaceholder variant="in-content" (line 532, gated >1000 chars) ───
FAQ Section
─── [NEW: AdPlaceholder variant="in-content"] ───
Separator
Author Box
RelatedBlogs
CategoryCluster
Bottom CTAs
```

**Chosen location:** Between FAQ section (ends ~line 547) and the Separator (line 549). Gated by `post.content?.length > 3000`.

**Why:** The FAQ section is a natural content boundary. Placing the ad after FAQ and before the author sign-off gives maximum distance from the first in-content ad (which is above the article body's midpoint). Only fires on genuinely long articles.

---

## 7. Bot-Readable Rendering Verification Position

**Code inspected:** `public/_worker.js` lines 306–347.

**Current behavior (verified from code):**
- The worker checks `isSEORoute(pathname)` and calls `serve-public-page` edge function to get `head_html` and `body_html`
- These are merged into the SPA shell via `mergeHTML()`
- On cache miss or error, it falls back to the bare SPA shell

**What is NOT verified from code alone:**
- Whether `serve-public-page` actually returns rich, contextually meaningful content for all major route families
- Whether the merged HTML output includes enough text density for AdSense contextual matching
- Which exact route patterns `isSEORoute()` matches

**Position:** Before concluding no change is needed, the implementation phase must include a live verification step: fetch 3-4 representative URLs as a bot user-agent and inspect whether the returned HTML contains meaningful page content. If it does → no change. If it doesn't → propose smallest fix in the existing worker/edge-function path.

**This claim is currently INFERRED, not verified.** Marked as such in Section 9.

---

## 8. Safety/Compliance Verification Position

**What was verified from code:**
- Ad spacing: the Apply button is in the sidebar (line 619–673), physically separate from main-column ads. Blog CTAs are below ad zones.
- No `<AdPlaceholder>` is placed adjacent to navigation elements (verified in Layout.tsx structure)
- The "Advertisement" label exists only in `AdPlaceholder.tsx` (searched for "Advertisement" across all .tsx files — only hits are in AdPlaceholder.tsx, legal pages using the word in prose, and EmploymentNewsJobDetail using "Advertisement No." as a data label)

**What is NOT verified:**
- Whether any download/sample-paper pages have copyright-risk presentation patterns — this requires live page inspection, not just code search
- Whether current consent handling is legally sufficient for all visitor regions

**Position:** No code change is proposed for compliance. The ad label fix (Phase 1) and spacing verification (above) address the immediate monetization-safety concerns. Download/copyright review is flagged as a remaining manual check item.

---

## 9. High Confidence Claim Review

| # | Claim | Evidence Source | Evidence Detail | Why High Confidence | What Could Make It Wrong | Verified or Inferred |
|---|---|---|---|---|---|---|
| 1 | No internal widgets are labeled "Advertisement" | Code search across all .tsx files | Only `AdPlaceholder.tsx` contains the ad label component. Legal pages use the word in legal prose, not as UI labels. `EmploymentNewsJobDetail` uses "Advertisement No." as a data field label, not an ad marker. | Direct text search is exhaustive for this pattern | A future commit could add a mislabeled widget | **Verified** (code search) |
| 2 | Existing placement coverage spans 31+ page families | Code search for `AdPlaceholder` imports | Found in 63 files across homepage, job detail, blog, exam, category, listing, and tool pages | Direct import search is exhaustive | Some imports might be commented out or conditionally dead | **Verified** (code search) |
| 3 | Only AdminDashboard sets `noAds={true}` | Code search for `noAds` | Found in 3 files; only AdminDashboard passes the prop | Direct search | A new page could add it without updating this plan | **Verified** (code search) |
| 4 | Anchor/vignette control is dashboard-only | Code search for "anchor", "vignette", "interstitial" in codebase | No code references to these format types exist | AdSense Auto Ads manages these server-side via the script tag | Google could add client-side API for format control that we're missing | **Verified** (code search) |
| 5 | Cloudflare Worker provides bot-readable content | Code inspection of `_worker.js` lines 306-347 | Worker calls `serve-public-page` and merges response into SPA shell | Code path exists and is logically sound | The edge function might return thin/empty content for some routes; actual output not live-tested | **Inferred** (code only, no live output check) |
| 6 | No consent/compliance code change needed now | Code search + existing legal pages | Terms of Use and Disclaimer pages exist with AdSense disclosure. No consent banner code exists in codebase. | Legal disclosure is present | Regional privacy laws (GDPR for EU visitors) may require active consent; site serves primarily Indian audience where this is less urgent | **Inferred** (legal judgment, not verified against all jurisdictions) |

---

## 10. Assumption Audit

| Assumption | Why Still Assumption | Risk | What Would Verify |
|---|---|---|---|
| MutationObserver reliably detects AdSense fill across all ad formats | AdSense may render inside shadow DOM or use delayed iframe injection in some formats | Medium | Live testing on prod with all 4 variant types, inspecting actual DOM structure after fill |
| `data-adsbygoogle-status === 'done'` plus child height > 0 is a reliable fill signal | This is the standard AdSense attribute but Google could change behavior | Medium | Live prod testing across multiple page loads and ad inventory states |
| IntersectionObserver with 200px rootMargin is sufficient lead time for lazy ad loading | AdSense may need more or less viewport proximity to trigger fill | Low | Live testing of below-fold ad slots with scroll behavior |
| `serve-public-page` returns contextually rich HTML for all major routes | Only code path was inspected, not actual output | Medium | Fetch representative URLs with bot UA and inspect HTML content density |
| 3000-char threshold is appropriate for second blog ad | Average article length not checked in database | Low | Run `SELECT AVG(LENGTH(content)) FROM blog_posts WHERE status='published'` |
| No download/sample-paper pages have copyright-risk presentation | Not inspected live | Medium | Manual review of 3-4 representative download/resource pages |

---

## 11. Required Live Verification Checklist

**Post-implementation, verify on production domain:**

### Fill Detection Validation
- [ ] Load a job detail page — confirm at least one ad transitions from `loading` to `filled` with visible "Advertisement" label
- [ ] Confirm unfilled slots collapse to zero height with no visible wrapper
- [ ] Confirm no "Advertisement" label appears before fill confirmation

### CLS Verification
CLS risk is **reduced** by this implementation (unfilled slots collapse instead of staying as permanent blank holes), but **not fully eliminated** — a delayed collapse still causes a layout shift. This requires explicit live measurement.
- [ ] Homepage: measure CLS before/after using Chrome DevTools Performance tab
- [ ] Blog post page: measure CLS, especially for the second in-content ad on long articles
- [ ] Job detail page: measure CLS for the new mid-content ad placement
- [ ] Mobile (375px): repeat CLS checks — mobile is highest risk for visible shifts

### Page-by-Page Verification
- [ ] **Homepage** — ads serve or collapse cleanly, no blank holes, no label on unfilled slots
- [ ] **Job listing page** — same checks
- [ ] **Job detail page #1** — verify both in-content ads (existing + new), banner, sidebar
- [ ] **Job detail page #2** — verify on a short job (new ad should not appear if description < 500 chars)
- [ ] **Blog index** — ads serve or collapse
- [ ] **Blog post #1 (long)** — verify both in-content ads appear
- [ ] **Blog post #2 (short, <3000 chars)** — verify second ad does NOT appear
- [ ] **Category/archive page #1** — ads serve or collapse
- [ ] **Category/archive page #2** — same
- [ ] **Mobile view** — layout remains readable, no ad too close to CTA/nav

### Bot-Readable Output Check
- [ ] Fetch 2 representative URLs with bot UA (`curl -A Googlebot <url>`) and confirm HTML contains meaningful page content, not just empty SPA shell

---

## 12. Final Remaining Risks Before Approval

1. **Fill detection is heuristic, not absolute.** MutationObserver + status check is the best practical approach but requires live validation. Edge cases (shadow DOM, delayed iframe) may exist.

2. **CLS is reduced, not eliminated.** A slot that renders at 250px min-height during `loading` and then collapses to 0 on `unfilled` creates a layout shift. The mitigation is that this is better than the current permanent 250px blank hole. True CLS elimination would require not reserving height at all (which hurts filled ads) or knowing fill outcome before render (impossible).

3. **Bot-readable rendering quality is inferred from code inspection only.** The worker code path exists and is logically correct, but actual output richness has not been live-verified.

4. **Compliance position is pragmatic, not comprehensive.** No consent banner exists. For an India-focused site this is low-risk, but EU visitors remain uncovered.

5. **Dashboard actions required separately** (not code):
   - Move anchor ads to bottom-only in AdSense console
   - Reduce vignette frequency to low or disable
   - Review Auto Ads overlay to check for duplication with manual slots

